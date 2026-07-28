/** Transición entre rutas del módulo técnico sin pantalla negra. */
export default function TecnicoLoading() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-gradient-to-br from-infinity-800 to-infinity-900 text-white p-6">
      <p className="text-lg font-semibold">Infinity Técnicos</p>
      <p className="text-infinity-200 text-sm mt-2">Cargando panel…</p>
      <div className="w-8 h-8 border-2 border-white/25 border-t-white rounded-full animate-spin mt-6" />
    </div>
  );
}
