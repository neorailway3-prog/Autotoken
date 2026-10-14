import { IndianRupee, TrendingUp, TrendingDown, Phone as PhoneIcon, Signal } from '../icons'
import { formatIndianNumber } from '../utils/smsParser'

export default function BankBalanceCard({ balance }) {
  const isCredit = balance.transactionType === 'credit'
  return (
    <div className="p-3 rounded-xl bg-[#0a1410] border border-emerald-900/30 border-l-2 border-l-emerald-500/70">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
            <IndianRupee className="w-3 h-3 text-emerald-400" />
          </div>
          <div>
            <span className="text-xs font-bold text-emerald-400">{balance.bankName}</span>
            <span className="text-[10px] text-[#444] ml-1.5 font-mono">{balance.senderName}</span>
          </div>
          {balance.accountLast4 && <span className="text-[10px] font-mono text-[#555] bg-[#111] px-1.5 py-0.5 rounded">{'••'}{balance.accountLast4}</span>}
        </div>
        {balance.transactionType && (
          <span className={`flex items-center gap-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-full ${isCredit ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
            {isCredit ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {isCredit ? 'Credit' : 'Debit'}
          </span>
        )}
      </div>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[9px] uppercase tracking-widest text-[#555] mb-0.5">Available Balance</p>
          <p className="text-xl font-black text-white">
            <span className="text-emerald-400 text-sm mr-0.5">₹</span>{formatIndianNumber(balance.availableBalance)}
          </p>
        </div>
        {balance.transactionAmount && balance.transactionAmount !== balance.availableBalance && (
          <div className="text-right">
            <p className="text-[9px] uppercase tracking-widest text-[#555] mb-0.5">Transaction</p>
            <p className={`text-sm font-bold ${isCredit ? 'text-emerald-400' : 'text-red-400'}`}>
              {isCredit ? '+' : '-'}₹{formatIndianNumber(balance.transactionAmount)}
            </p>
          </div>
        )}
      </div>
      {(balance.phoneFromSms || balance.networkFromSms) && (
        <div className="flex items-center gap-3 mt-2 pt-2 border-t border-[#151f15]">
          {balance.phoneFromSms && (
            <div className="flex items-center gap-1">
              <PhoneIcon className="w-3 h-3 text-blue-400" />
              <span className="text-[10px] font-mono text-[#777]">{balance.phoneFromSms}</span>
            </div>
          )}
          {balance.networkFromSms && (
            <div className="flex items-center gap-1">
              <Signal className="w-3 h-3 text-purple-400" />
              <span className="text-[10px] text-[#777]">{balance.networkFromSms}</span>
            </div>
          )}
        </div>
      )}
      <p className="text-[10px] text-[#333] mt-2 leading-relaxed line-clamp-2">{balance.rawSms.substring(0, 130)}</p>
      {balance.detectedAt && <p className="text-[9px] text-[#2a2a2a] mt-1 font-mono">{balance.detectedAt}</p>}
    </div>
  )
}
