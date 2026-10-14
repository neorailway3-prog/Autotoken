export default function SkeletonLoader() {
  return (
    <div className="bg-[#111111] border border-[#1f1f1f] rounded-2xl p-4 animate-pulse">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-[#1a1a1a]" />
        <div className="flex-1 space-y-2">
          <div className="h-3 bg-[#1a1a1a] rounded w-3/4" />
          <div className="h-2 bg-[#151515] rounded w-1/2" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="h-8 bg-[#151515] rounded-xl" />
        <div className="h-8 bg-[#151515] rounded-xl" />
      </div>
      <div className="h-10 bg-[#131313] rounded-xl" />
    </div>
  )
}
