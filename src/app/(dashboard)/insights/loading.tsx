export default function InsightsLoading() {
  return (
    <div className="flex flex-col min-h-full">
      <div className="h-16 flex items-center px-6 border-b border-slate-200/60 bg-white/70">
        <div className="h-4 w-32 bg-slate-100 rounded animate-pulse" />
      </div>
      <div className="flex-1 p-6 space-y-6">
        <div className="h-8 w-48 bg-slate-100 rounded animate-pulse" />
        <div className="grid grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="h-96 bg-slate-100 rounded-xl animate-pulse" />
      </div>
    </div>
  )
}
