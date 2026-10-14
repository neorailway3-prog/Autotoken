import { TriangleAlert, X } from '../icons'

export default function ErrorBanner({ message, onDismiss }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3 bg-red-950/40 border border-red-900/30 rounded-xl mx-6 mt-3">
      <TriangleAlert className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
      <p className="text-xs text-red-300 flex-1 leading-relaxed">{message}</p>
      <button onClick={onDismiss} className="text-red-600 hover:text-red-400 flex-shrink-0">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
