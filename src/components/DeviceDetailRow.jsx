export default function DeviceDetailRow({ label, value, mono, highlight }) {
  return (
    <div className="flex items-start justify-between py-2.5 border-b border-[#1a1a1a] last:border-0">
      <span className="text-xs text-[#555] font-medium flex-shrink-0 w-32">{label}</span>
      <span className={`text-xs text-right break-all ${mono ? 'font-mono' : 'font-semibold'} ${highlight || 'text-[#ccc]'}`}>{value || '—'}</span>
    </div>
  )
}
