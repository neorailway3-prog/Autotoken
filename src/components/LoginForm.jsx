import { useState, useEffect, useRef } from 'react'
import {
  Shield, Wifi, Plus, ChevronRight, Share2, Trash2, X, Upload, FileSearch,
  Copy as CopyIcon, Check, Zap, Link as LinkIcon
} from '../icons'
import { loadAccounts, saveAccounts, firebaseGet, generateShareLink, decodeShareLink } from '../utils/firebase'
import { parseApk } from '../utils/apkParser'
import CopyButton from './CopyButton'

export default function LoginForm({ onConnect }) {
  const [accounts, setAccounts] = useState([])
  const [showNewForm, setShowNewForm] = useState(false)
  const [fbUrl, setFbUrl] = useState('')
  const [fbKey, setFbKey] = useState('')
  const [error, setError] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [shareLink, setShareLink] = useState('')
  const [linkCopied, setLinkCopied] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [parsedData, setParsedData] = useState(null)
  const [parseError, setParseError] = useState('')
  const [parsedFileName, setParsedFileName] = useState('')
  const fileInputRef = useRef(null)

  useEffect(() => {
    const saved = loadAccounts()
    setAccounts(saved)
    const params = new URLSearchParams(window.location.search).get('s')
    if (params) {
      const decoded = decodeShareLink(params)
      if (decoded) {
        window.history.replaceState({}, '', window.location.pathname)
        const existing = saved.find(a => a.url === decoded.url)
        if (existing) {
          connectExisting(decoded.url, decoded.key)
        } else {
          connectShared(decoded.url, decoded.key, saved)
        }
      }
    }
  }, [])

  const connectShared = async (url, key, existingAccounts) => {
    setConnecting(true)
    setError('')
    try {
      await firebaseGet(url, key, 'clients')
      const newAccount = { id: Date.now(), url, key, date: new Date().toLocaleString() }
      const updated = [...existingAccounts, newAccount]
      saveAccounts(updated)
      setAccounts(updated)
      onConnect(url, key)
    } catch {
      setError('Shared connection failed. The link may be invalid or expired.')
    } finally {
      setConnecting(false)
    }
  }

  const connectExisting = async (url, key) => {
    setConnecting(true)
    setError('')
    try {
      await firebaseGet(url, key, 'clients')
      onConnect(url, key)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('PERMISSION_DENIED')) setError('Permission Denied: Use Database Secret key, not API key.')
      else if (msg.includes('Network error') || msg.includes('Failed to fetch')) setError('Network error. Check Firebase URL format.')
      else setError('Connection failed: ' + msg.slice(0, 120))
    } finally {
      setConnecting(false)
    }
  }

  const handleDeleteAccounts = (accountsList) => {
    saveAccounts(accountsList)
    setAccounts([...accountsList])
  }

  const handleConnectSaved = (account) => connectExisting(account.url, account.key)

  const handleShareCopy = (e, account) => {
    e.stopPropagation()
    setShareLink(generateShareLink(account.url, account.key))
    setLinkCopied(false)
  }

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareLink)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
  }

  const handleDeleteAccount = (e, id) => {
    e.stopPropagation()
    if (confirm('Delete this account permanently?')) {
      handleDeleteAccounts(accounts.filter(a => a.id !== id))
    }
  }

  const handleConnect = async () => {
    const url = fbUrl.trim().replace(/\/$/, '')
    const key = fbKey.trim()
    if (!url || !key) { setError('Please enter both URL and Key'); return }
    const existing = accounts.find(a => a.url === url)
    if (existing) {
      if (confirm('Account already exists. Switch to it?')) await connectExisting(existing.url, existing.key)
      return
    }
    const newAccount = { id: Date.now(), url, key, date: new Date().toLocaleString() }
    setConnecting(true)
    setError('')
    try {
      await firebaseGet(url, key, 'clients')
      const updated = [...accounts, newAccount]
      handleDeleteAccounts(updated)
      onConnect(url, key)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('PERMISSION_DENIED')) setError('Permission Denied: Use Database Secret key, not API key.')
      else if (msg.includes('Network error') || msg.includes('Failed to fetch')) setError('Network error. Check Firebase URL format.')
      else setError('Connection failed: ' + msg.slice(0, 120))
    } finally {
      setConnecting(false)
    }
  }

  const handleApkUpload = async (file) => {
    if (!file.name.endsWith('.apk') && !file.name.endsWith('.zip')) {
      setParseError('Only .apk files supported')
      return
    }
    setParsing(true)
    setParseError('')
    setParsedData(null)
    setParsedFileName(file.name)
    try {
      const result = await parseApk(file)
      if (!result || (!result.firebaseUrl && !result.apiKey)) {
        setParseError('Firebase config not found in this APK.')
        return
      }
      setParsedData(result)
      if (result.firebaseUrl) setFbUrl(result.firebaseUrl)
      if (result.apiKey) setFbKey(result.apiKey)
    } catch {
      setParseError('Failed to parse APK.')
    } finally {
      setParsing(false)
    }
  }

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (file) handleApkUpload(file)
    e.target.value = ''
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleApkUpload(file)
  }

  const clearParsed = () => {
    setParsedData(null)
    setParseError('')
    setParsedFileName('')
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden" style={{ background: 'radial-gradient(ellipse at 60% 0%, hsl(190 60% 12% / 0.5) 0%, transparent 60%), radial-gradient(ellipse at 0% 100%, hsl(290 30% 8% / 1) 0%, hsl(290 25% 5% / 1) 100%)' }}>
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(hsl(190 15% 92%) 1px, transparent 1px), linear-gradient(90deg, hsl(190 15% 92%) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
      <div className="absolute top-0 right-1/4 w-96 h-96 rounded-full blur-3xl opacity-10" style={{ background: 'radial-gradient(circle, #00f0ff, transparent)' }} />
      <div className="absolute bottom-0 left-1/4 w-80 h-80 rounded-full blur-3xl opacity-8" style={{ background: 'radial-gradient(circle, #b026ff, transparent)' }} />
      <div className="relative z-10 w-full max-w-md mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-4 theme-gradient shadow-lg shadow-cyan-900/40 p-[2px]">
            <img src="/logo.png" alt="Cyber Skull" className="w-full h-full rounded-full object-cover bg-black" />
          </div>
          <div className="flex flex-col items-center justify-center mt-10">
            <h1 className="relative text-4xl font-bold italic tracking-tight" style={{ fontFamily: "'Segoe UI', 'Roboto', 'Arial', sans-serif" }}>
              <span className="text-[#ef4444]">REDHAT</span> <span className="text-white">2.0</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-2">REDHAT 2.0 Panel</p>
          </div>
        </div>
        <div className="glass-card rounded-3xl p-7 shadow-2xl shadow-black/60">
          {!showNewForm && (
            <>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Wifi className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-semibold text-foreground">Saved Accounts</span>
                </div>
                <span className="text-xs text-muted-foreground bg-accent px-2 py-1 rounded-full">{accounts.length} {accounts.length === 1 ? 'account' : 'accounts'}</span>
              </div>
              <div className="space-y-2 max-h-52 overflow-y-auto pr-1 mb-4">
                {accounts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    <Wifi className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    No saved accounts
                  </div>
                ) : accounts.map(acc => (
                  <div key={acc.id} onClick={() => !connecting && handleConnectSaved(acc)} className="flex items-center gap-3 p-3 rounded-xl border border-border hover:border-cyan-500/40 hover:bg-cyan-950/20 cursor-pointer transition-all duration-200 group">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{acc.url}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 font-mono">{acc.date} · {acc.key.substring(0, 20)}…</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={e => handleShareCopy(e, acc)} className="p-1.5 rounded-lg bg-blue-950/60 border border-blue-900/40 text-blue-400 hover:bg-blue-900/60 transition-all" title="Share connection link">
                        <Share2 className="w-3 h-3" />
                      </button>
                      <button onClick={e => handleDeleteAccount(e, acc.id)} className="p-1.5 rounded-lg bg-red-950/60 border border-red-900/40 text-red-400 hover:bg-red-900/60 transition-all">
                        <Trash2 className="w-3 h-3" />
                      </button>
                      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-red-400 transition-colors" />
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={() => { setShowNewForm(true); setError(''); clearParsed(); setFbUrl(''); setFbKey('') }} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-border hover:border-cyan-500/50 hover:bg-cyan-950/10 text-muted-foreground hover:text-cyan-400 transition-all text-sm font-medium">
                <Plus className="w-4 h-4" />New Account
              </button>
            </>
          )}
          {showNewForm && (
            <div>
              <div className="flex items-center gap-2 mb-5">
                <button onClick={() => { setShowNewForm(false); setError(''); clearParsed(); setFbUrl(''); setFbKey('') }} className="p-1.5 rounded-lg hover:bg-accent transition-colors">
                  <ChevronRight className="w-4 h-4 rotate-180 text-muted-foreground" />
                </button>
                <h3 className="font-semibold text-foreground">New Firebase Account</h3>
              </div>
              <div className="mb-5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Extract from APK (optional)</label>
                {!parsedData && !parsing && (
                  <label htmlFor="apk-file-input" onDrop={handleDrop} onDragOver={e => e.preventDefault()} className="flex flex-col items-center justify-center gap-2 py-5 px-4 rounded-xl border-2 border-dashed border-[#2a2a2a] hover:border-purple-500/40 hover:bg-purple-950/10 cursor-pointer transition-all group select-none">
                    <div className="w-10 h-10 rounded-xl bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center group-hover:border-purple-500/30 transition-all">
                      <Upload className="w-5 h-5 text-[#555] group-hover:text-purple-400 transition-colors" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-[#666] group-hover:text-[#999] transition-colors">Upload APK File</p>
                      <p className="text-[11px] text-[#444] mt-0.5">Auto-extracts Firebase URL & API Key</p>
                    </div>
                    <input id="apk-file-input" ref={fileInputRef} type="file" accept=".apk,.zip" onChange={handleFileChange} onClick={e => e.stopPropagation()} className="hidden" />
                  </label>
                )}
                {parsing && (
                  <div className="flex flex-col items-center justify-center gap-3 py-6 rounded-xl border border-[#1f1f1f] bg-[#0d0d0d]">
                    <div className="w-8 h-8 border-2 border-orange-900/50 border-t-orange-500 rounded-full animate-spin" />
                    <div className="text-center">
                      <p className="text-sm font-semibold text-orange-400">Scanning APK…</p>
                      <p className="text-[11px] text-[#444] mt-0.5 font-mono truncate max-w-[220px]">{parsedFileName}</p>
                    </div>
                  </div>
                )}
                {parseError && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-red-950/30 border border-red-900/40">
                    <X className="w-4 h-4 text-red-400 flex-shrink-0" />
                    <p className="text-xs text-red-400">{parseError}</p>
                    <button onClick={clearParsed} className="ml-auto text-[#555] hover:text-[#888]"><X className="w-3.5 h-3.5" /></button>
                  </div>
                )}
                {parsedData && !parsing && (
                  <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/20 overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-2 border-b border-emerald-900/30 bg-emerald-950/30">
                      <FileSearch className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-xs font-semibold text-emerald-400">Extracted Successfully</span>
                      <button onClick={clearParsed} className="ml-auto text-[#444] hover:text-[#777]"><X className="w-3.5 h-3.5" /></button>
                    </div>
                    <div className="p-3 space-y-2">
                      <div>
                        <p className="text-[10px] text-[#555] uppercase tracking-wider mb-1">Firebase URL</p>
                        <div className="flex items-center gap-2 bg-[#0a0a0a] rounded-lg px-2.5 py-1.5 border border-[#1a1a1a]">
                          <span className="text-xs font-mono text-emerald-300 flex-1 truncate">{parsedData.firebaseUrl || 'Not found'}</span>
                          {parsedData.firebaseUrl && <CopyButton text={parsedData.firebaseUrl} />}
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] text-[#555] uppercase tracking-wider mb-1">API Key</p>
                        <div className="flex items-center gap-2 bg-[#0a0a0a] rounded-lg px-2.5 py-1.5 border border-[#1a1a1a]">
                          <span className="text-xs font-mono text-emerald-300 flex-1 truncate">{parsedData.apiKey || 'Not found'}</span>
                          {parsedData.apiKey && <CopyButton text={parsedData.apiKey} />}
                        </div>
                      </div>
                      {parsedData.projectId && (
                        <div>
                          <p className="text-[10px] text-[#555] uppercase tracking-wider mb-1">Project ID</p>
                          <div className="flex items-center gap-2 bg-[#0a0a0a] rounded-lg px-2.5 py-1.5 border border-[#1a1a1a]">
                            <span className="text-xs font-mono text-[#777] flex-1 truncate">{parsedData.projectId}</span>
                            <CopyButton text={parsedData.projectId} />
                          </div>
                        </div>
                      )}
                      <p className="text-[10px] text-emerald-600 mt-1">Fields auto-filled below ↓</p>
                    </div>
                  </div>
                )}
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Firebase Database URL</label>
                  <input type="text" value={fbUrl} onChange={e => setFbUrl(e.target.value)} placeholder="https://your-project.firebaseio.com"
                    className="w-full px-4 py-3 rounded-xl bg-[#151515] border border-[#2a2a2a] focus:border-red-500 focus:ring-1 focus:ring-red-500/20 outline-none text-sm text-white placeholder:text-[#555] transition-all font-mono" />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Authentication Key / Secret</label>
                  <input type="text" value={fbKey} onChange={e => setFbKey(e.target.value)} placeholder="Your Firebase secret key"
                    className="w-full px-4 py-3 rounded-xl bg-[#151515] border border-[#2a2a2a] focus:border-red-500 focus:ring-1 focus:ring-red-500/20 outline-none text-sm text-white placeholder:text-[#555] transition-all font-mono" />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={handleConnect} disabled={connecting}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-cyan-600 hover:bg-cyan-700 rounded-xl text-white font-semibold text-sm transition-colors disabled:opacity-50">
                  {connecting ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Connecting…</> : <><Zap className="w-4 h-4" /> Save & Connect</>}
                </button>
                <button onClick={() => { setShowNewForm(false); setError(''); clearParsed(); setFbUrl(''); setFbKey('') }}
                  className="px-5 py-3 rounded-xl bg-muted hover:bg-accent text-muted-foreground text-sm font-medium transition-colors">Cancel</button>
              </div>
            </div>
          )}
          {error && <p className="mt-4 text-center text-sm text-red-400">{error}</p>}
        </div>
        <p className="text-center text-xs text-muted-foreground/40 mt-6">REDHAT 2.0 · All connections are logged</p>
      </div>
      {shareLink && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
          onClick={() => setShareLink('')}>
          <div className="w-full max-w-md glass-card rounded-2xl p-6 shadow-2xl shadow-black/80" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-950 border border-blue-800/60 flex items-center justify-center">
                  <LinkIcon className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground text-sm">Share Connection</h3>
                  <p className="text-xs text-muted-foreground">Anyone with this link can connect directly</p>
                </div>
              </div>
              <button onClick={() => setShareLink('')} className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center gap-2 bg-muted/40 border border-border rounded-xl px-3 py-2.5 mb-4">
              <span className="text-xs font-mono text-muted-foreground flex-1 truncate select-all">{shareLink}</span>
              <button onClick={handleCopyLink} className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${linkCopied ? 'bg-emerald-950 border border-emerald-700/60 text-emerald-400' : 'bg-blue-950 border border-blue-800/60 text-blue-400 hover:bg-blue-900'}`}>
                {linkCopied ? <><Check className="w-3 h-3" /> Copied!</> : <><CopyIcon className="w-3 h-3" /> Copy</>}
              </button>
            </div>
            <div className="flex items-start gap-2 p-3 rounded-xl bg-yellow-950/30 border border-yellow-900/40">
              <Shield className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-yellow-400/80">This link contains your Firebase credentials. Only share with trusted people.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
