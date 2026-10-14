import { useState } from 'react'
import { Check, Copy as CopyIcon } from '../icons'

export default function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={handleCopy} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[#555] hover:text-white transition-all flex-shrink-0">
      {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <CopyIcon className="w-3 h-3" />}
    </button>
  )
}
