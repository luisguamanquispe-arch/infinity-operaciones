/** Mientras Next.js carga /login (evita flash negro al salir del splash local). */
export default function LoginLoading() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-gradient-to-br from-infinity-800 to-infinity-900 text-white p-6">
      <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center text-3xl mb-4">
        📡
      </div>
      <p className="text-lg font-semibold">Infinity Técnicos</p>
      <p className="text-infinity-200 text-sm mt-2">Cargando…</p>
      <div className="w-8 h-8 border-2 border-white/25 border-t-white rounded-full animate-spin mt-6" />
    </div>
  );
}
