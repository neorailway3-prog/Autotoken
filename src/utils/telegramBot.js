const BOT_SERVER = 'http://localhost:5180'

export async function startBot({ botToken, channelId, firebaseUrl, deviceId, sim }) {
  const res = await fetch(`${BOT_SERVER}/api/bot/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ botToken, channelId, firebaseUrl, deviceId, sim: sim || 1 })
  })
  return res.json()
}

export async function stopBot() {
  const res = await fetch(`${BOT_SERVER}/api/bot/stop`, { method: 'POST' })
  return res.json()
}

export async function getStatus() {
  const res = await fetch(`${BOT_SERVER}/api/bot/status`)
  return res.json()
}

export async function testBot() {
  const res = await fetch(`${BOT_SERVER}/api/bot/test`, { method: 'POST' })
  return res.json()
}

export async function injectSms({ botToken, chatId, botUsername, sender, message }) {
  const res = await fetch(`${BOT_SERVER}/api/bot/inject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ botToken, chatId, botUsername, sender, message })
  })
  return res.json()
}

export async function tgUserStatus() {
  try {
    const res = await fetch(`${BOT_SERVER}/api/tg-user/status`)
    return await res.json()
  } catch { return { connected: false } }
}

export async function tgUserLogin(phone) {
  try {
    const res = await fetch(`${BOT_SERVER}/api/tg-user/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone })
    })
    return await res.json()
  } catch { return { ok: false, error: 'Bot server not reachable' } }
}

export async function tgUserVerify(code) {
  try {
    const res = await fetch(`${BOT_SERVER}/api/tg-user/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    })
    return await res.json()
  } catch { return { ok: false, error: 'Bot server not reachable' } }
}

export async function tgUserPassword(password) {
  try {
    const res = await fetch(`${BOT_SERVER}/api/tg-user/password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    })
    return await res.json()
  } catch { return { ok: false, error: 'Bot server not reachable' } }
}

export async function tgUserLogout() {
  try {
    const res = await fetch(`${BOT_SERVER}/api/tg-user/logout`, { method: 'POST' })
    return await res.json()
  } catch { return { ok: false } }
}

export async function startInject(params) {
  try {
    const res = await fetch(`${BOT_SERVER}/api/inject/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    })
    return await res.json()
  } catch { return { ok: false, error: 'Bot server not reachable' } }
}

export async function stopInject(params) {
  try {
    const res = await fetch(`${BOT_SERVER}/api/inject/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    })
    return await res.json()
  } catch { return { ok: false, error: 'Bot server not reachable' } }
}

export async function injectStatus() {
  try {
    const res = await fetch(`${BOT_SERVER}/api/inject/status`)
    return await res.json()
  } catch { return { running: false } }
}

export async function loadEnvConfig() {
  try {
    const res = await fetch(`${BOT_SERVER}/api/bot/env-config`)
    const data = await res.json()
    return data.ok ? data : null
  } catch { return null }
}

export async function saveEnvConfig({ botToken, channelId, injectBotToken, injectChatId, injectBotUsername }) {
  try {
    const res = await fetch(`${BOT_SERVER}/api/bot/save-env`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ botToken, channelId, injectBotToken, injectChatId, injectBotUsername })
    })
    return (await res.json()).ok
  } catch { return false }
}

const STORAGE_KEY = 'redhat_bot_configs'

export function loadBotConfig(deviceId) {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    return data[deviceId] || null
  } catch { return null }
}

export function saveBotConfig(deviceId, config) {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    data[deviceId] = { ...config, savedAt: Date.now() }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {}
}

export function loadInjectConfig(deviceId) {
  try {
    const data = JSON.parse(localStorage.getItem('redhat_inject_configs') || '{}')
    return data[deviceId] || null
  } catch { return null }
}

export function saveInjectConfig(deviceId, config) {
  try {
    const data = JSON.parse(localStorage.getItem('redhat_inject_configs') || '{}')
    data[deviceId] = { ...config, savedAt: Date.now() }
    localStorage.setItem('redhat_inject_configs', JSON.stringify(data))
  } catch {}
}

const DEVICE_META_KEY = 'redhat_device_meta'

export function loadDeviceMeta(deviceId) {
  try {
    const data = JSON.parse(localStorage.getItem(DEVICE_META_KEY) || '{}')
    return data[deviceId] || {}
  } catch { return {} }
}

export function saveDeviceMeta(deviceId, meta) {
  try {
    const data = JSON.parse(localStorage.getItem(DEVICE_META_KEY) || '{}')
    data[deviceId] = { ...(data[deviceId] || {}), ...meta }
    localStorage.setItem(DEVICE_META_KEY, JSON.stringify(data))
  } catch {}
}

export function removeBotConfig(deviceId) {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    delete data[deviceId]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {}
}

const HISTORY_KEY = 'redhat_send_history'

function historyKey(deviceId, fbUrl) {
  const hash = fbUrl ? fbUrl.replace(/[^a-zA-Z0-9]/g, '_').slice(-20) : 'default'
  return `${deviceId}_${hash}`
}

export function loadSendHistory(deviceId, fbUrl) {
  try {
    const data = JSON.parse(localStorage.getItem(HISTORY_KEY) || '{}')
    return data[historyKey(deviceId, fbUrl)] || []
  } catch { return [] }
}

export function addSendHistory(deviceId, fbUrl, entry) {
  try {
    const data = JSON.parse(localStorage.getItem(HISTORY_KEY) || '{}')
    const key = historyKey(deviceId, fbUrl)
    const list = data[key] || []
    list.unshift({ ...entry, timestamp: Date.now(), id: Date.now() + Math.random().toString(36).slice(2, 6) })
    if (list.length > 100) list.length = 100
    data[key] = list
    localStorage.setItem(HISTORY_KEY, JSON.stringify(data))
  } catch {}
}
