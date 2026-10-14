export default function CardDisplay({ last4, cardType }) {
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-xs text-[#aaa]">{`•••• •••• •••• ${last4}`}</span>
      {cardType && <span className="text-[10px] text-purple-400 font-semibold">{cardType}</span>}
    </div>
  )
}
