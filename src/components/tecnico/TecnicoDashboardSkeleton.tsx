export function TecnicoDashboardSkeleton() {
  return (
    <div className="min-h-dvh bg-slate-50 animate-pulse">
      <div className="bg-infinity-800 h-16" />
      <main className="max-w-6xl mx-auto p-4 space-y-6">
        <div className="bg-white rounded-xl border h-28" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-xl border h-20" />
          ))}
        </div>
        <div className="bg-white rounded-xl border h-40" />
        <div className="bg-white rounded-xl border h-64" />
        <div className="bg-white rounded-xl border h-48" />
      </main>
    </div>
  );
}
