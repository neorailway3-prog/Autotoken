export default function BatteryIndicator({ percent }) {
  const color = percent >= 60 ? '#4ade80' : percent >= 30 ? '#facc15' : '#ef4444'
  const textColor = percent >= 60 ? '#86efac' : percent >= 30 ? '#fde68a' : '#ef4444'
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center">
        <div className="relative flex items-center rounded-[3px] border border-[#555]" style={{ width: 26, height: 12, padding: 2 }}>
          <div className="rounded-[1.5px] h-full transition-all duration-500" style={{ width: `${Math.max(5, percent)}%`, background: color }} />
        </div>
        <div style={{ width: 3, height: 5, background: '#555', borderRadius: '0 2px 2px 0', marginLeft: -1 }} />
      </div>
      <span className="text-xs font-semibold tabular-nums" style={{ color: textColor }}>{percent}%</span>
    </div>
  )
}
