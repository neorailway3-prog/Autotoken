import { useState } from 'react'
import { CreditCard, EyeOff, Eye } from '../icons'
import CardDisplay from './CardDisplay'

export default function CreditCardInfo({ card }) {
  const [showCvv, setShowCvv] = useState(false)
  return (
    <div className="p-3 rounded-xl bg-[#0f0a1a] border border-purple-900/30 border-l-2 border-l-purple-500/70">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-purple-500/15 border border-purple-500/25 flex items-center justify-center">
            <CreditCard className="w-3 h-3 text-purple-400" />
          </div>
          <span className="text-xs font-bold text-purple-400">{card.cardType || 'Card'}</span>
        </div>
        {card.expiry && <span className="text-[10px] text-[#555] font-mono">Exp: {card.expiry}</span>}
      </div>
      <CardDisplay last4={card.cardLast4} cardType={card.cardType} />
      {card.cvv && (
        <div className="flex items-center gap-2 mt-2">
          <span className="text-[10px] uppercase tracking-widest text-[#555]">CVV:</span>
          <span className="text-xs font-mono text-purple-300">{showCvv ? card.cvv : '•••'}</span>
          <button onClick={() => setShowCvv(!showCvv)} className="p-0.5 text-[#444] hover:text-purple-400 transition-colors">
            {showCvv ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
          </button>
        </div>
      )}
      <p className="text-[10px] text-[#2a2a2a] mt-2 leading-relaxed line-clamp-2">{card.rawSms.substring(0, 130)}</p>
    </div>
  )
}
