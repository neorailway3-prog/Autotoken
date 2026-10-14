import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TelegramClient, Api } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { computeCheck } from 'telegram/Password.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SESSION_FILE = path.join(__dirname, 'tg_session.json');
const ENV_FILE = path.join(__dirname, '.env');

let client = null;
let pending = null;

function readEnv() {
  let apiId = process.env.TG_API_ID || '';
  let apiHash = process.env.TG_API_HASH || '';
  try {
    if (fs.existsSync(ENV_FILE)) {
      const env = fs.readFileSync(ENV_FILE, 'utf8');
      const idMatch = env.match(/^TG_API_ID=(\d+)$/m);
      const hashMatch = env.match(/^TG_API_HASH=(.+)$/m);
      if (idMatch) apiId = idMatch[1];
      if (hashMatch) apiHash = hashMatch[1].trim();
    }
  } catch {}
  return { apiId, apiHash };
}

function readSessionFile() {
  try {
    if (fs.existsSync(SESSION_FILE)) {
      return JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
    }
  } catch {}
  return null;
}

function writeSessionFile(data) {
  fs.writeFileSync(SESSION_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function resetSessionFile() {
  try { fs.unlinkSync(SESSION_FILE); } catch {}
}

async function makeClient(sessionStr, apiId, apiHash, onDisconnect) {
  const c = new TelegramClient(new StringSession(sessionStr), Number(apiId), apiHash, {
    connectionRetries: 5,
    deviceModel: 'REDHAT Panel',
    appVersion: '1.0.0',
    systemVersion: 'Linux'
  });
  await c.connect();
  return c;
}

async function disconnectClient() {
  if (client) {
    try { await client.disconnect(); } catch {}
    client = null;
  }
  pending = null;
}

function toSafeError(e) {
  return (e && (e.errorMessage || e.message)) || 'Telegram error';
}

export async function tgGetStatus() {
  const { apiId, apiHash } = readEnv();
  const configured = !!(apiId && apiHash);
  const saved = readSessionFile();
  if (!configured || !saved) {
    return { configured, connected: false, name: null, phone: null, error: configured && !saved ? 'not logged in' : 'missing TG_API_ID/TG_API_HASH in .env' };
  }
  if (saved.apiId !== apiId || saved.apiHash !== apiHash) {
    return { configured, connected: false, name: null, phone: saved.phone, error: 'session belongs to different apiId — re-login' };
  }
  try {
    await disconnectClient();
    client = await makeClient(saved.session, apiId, apiHash);
    const me = await client.getMe();
    return {
      configured, connected: true,
      name: me.firstName || me.username || 'Telegram user',
      phone: saved.phone || null, id: String(me.id)
    };
  } catch (e) {
    const msg = toSafeError(e);
    if (/AUTH_KEY_UNREGISTERED|SESSION_REVOKED|USER_DEACTIVATED|401/.test(msg)) {
      resetSessionFile();
    }
    return { configured, connected: false, name: null, phone: saved.phone, error: msg };
  }
}

export async function tgStartLogin(phone) {
  const { apiId, apiHash } = readEnv();
  if (!apiId || !apiHash) return { ok: false, error: 'TG_API_ID / TG_API_HASH .env me add karo' };
  const clean = phone.replace(/[^\d+]/g, '');
  if (clean.length < 8) return { ok: false, error: 'Invalid phone number' };
  try {
    await disconnectClient();
    client = await makeClient('', apiId, apiHash);
    const res = await client.sendCode({ apiId: Number(apiId), apiHash }, clean);
    pending = { phone: clean, phoneCodeHash: res.phoneCodeHash };
    return { ok: true, phone: clean };
  } catch (e) {
    await disconnectClient();
    return { ok: false, error: toSafeError(e) };
  }
}

export async function tgVerifyCode(code) {
  if (!client || !pending) return { ok: false, error: 'Pehle phone number send karo' };
  try {
    const signIn = await client.invoke(new Api.auth.SignIn({
      phoneNumber: pending.phone,
      phoneCode: code.trim(),
      phoneCodeHash: pending.phoneCodeHash
    }));
    return await finalizeLogin(signIn, client);
  } catch (e) {
    if (e.errorMessage === 'SESSION_PASSWORD_NEEDED') {
      return { ok: false, passwordNeeded: true, error: '2FA password chahiye' };
    }
    if (e.errorMessage === 'PHONE_CODE_INVALID' || e.errorMessage === 'PHONE_CODE_EXPIRED') {
      return { ok: false, error: 'Wrong or expired code' };
    }
    await disconnectClient();
    return { ok: false, error: toSafeError(e) };
  }
}

export async function tgVerifyPassword(password) {
  if (!client || !pending) return { ok: false, error: 'Pehle phone number send karo' };
  try {
    const pwd = await client.invoke(new Api.account.GetPassword());
    const check = await computeCheck(pwd, password);
    const res = await client.invoke(new Api.auth.CheckPassword({ password: check }));
    return await finalizeLogin(res, client);
  } catch (e) {
    if (e.errorMessage === 'PASSWORD_HASH_INVALID') {
      return { ok: false, error: 'Wrong password', passwordNeeded: true };
    }
    await disconnectClient();
    return { ok: false, error: toSafeError(e) };
  }
}

async function finalizeLogin(res, c) {
  const me = await c.getMe();
  const api = readEnv();
  const phone = pending ? pending.phone : null;
  const session = c.session.save();
  writeSessionFile({ apiId: api.apiId, apiHash: api.apiHash, session, phone, name: me.firstName || null });
  pending = null;
  return { ok: true, name: me.firstName || null, phone };
}

export async function tgLogout() {
  try {
    if (client) {
      try { await client.invoke(new Api.auth.LogOut()); } catch {}
    }
  } catch {}
  await disconnectClient();
  resetSessionFile();
  return { ok: true };
}

export async function tgSendMessage(chatId, text, opts = {}) {
  let status = client ? null : await tgGetStatus();
  if (!client && status && !status.connected) {
    return { ok: false, error: status.error || 'Telegram user session not linked' };
  }
  let target = /^-?\d+$/.test(String(chatId)) ? Number(chatId) : String(chatId);
  try {
    const me = await client.getMe();
    if (String(target) === String(me.id)) {
      // apni hi id = Saved Messages — poller bot ko bhejo
      if (opts.botUsername && opts.botUsername.startsWith('@')) {
        target = opts.botUsername;
      } else if (opts.botPeerId) {
        target = Number(opts.botPeerId);
      } else {
        return { ok: false, error: 'chatId tumhari khud ki id hai (Saved Messages) — poller bot ka username (@xyz) ya token do' };
      }
    }
    await client.sendMessage(target, { message: text });
    return { ok: true };
  } catch (e) {
    const msg = toSafeError(e);
    if (/AUTH_KEY_UNREGISTERED|SESSION_REVOKED|USER_DEACTIVATED|401/.test(msg)) {
      resetSessionFile();
      await disconnectClient();
      return { ok: false, error: 'Session expired — panel me dobara login karo' };
    }
    if (/Could not find the input entity/i.test(msg)) {
      return {
        ok: false,
        error: `Target chat (${chatId}) iss account se kabhi contact nahi hua. Bot ka username (@xyz) Chat ID me daalo, ya poller bot ko pehle manually message karo.`
      };
    }
    if (/connection|network|reconnect|65537|typeerror/i.test(msg)) {
      await disconnectClient();
      const st = await tgGetStatus();
      if (st.connected) {
        try {
          await client.sendMessage(target, { message: text });
          return { ok: true };
        } catch (e2) {
          return { ok: false, error: toSafeError(e2) };
        }
      }
      return { ok: false, error: st.error || 'Connection lost' };
    }
    return { ok: false, error: msg };
  }
}

export async function tgDisconnect() {
  await disconnectClient();
}