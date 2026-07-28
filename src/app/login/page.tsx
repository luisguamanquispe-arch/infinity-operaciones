import { LoginShell } from "./LoginShell";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ app?: string }>;
}) {
  const params = await searchParams;
  const esAppTecnico = params.app === "tecnico";
  return (
    <>
      {esAppTecnico && (
        <div
          id="cap-login-boot"
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-gradient-to-br from-infinity-800 to-infinity-900 text-white p-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
          aria-hidden="true"
        >
          <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center text-3xl mb-4">
            📡
          </div>
          <p className="text-lg font-semibold">Infinity Técnicos</p>
          <p className="text-infinity-200 text-sm mt-2 text-center">Conectando con el servidor…</p>
          <div className="w-8 h-8 border-2 border-white/25 border-t-white rounded-full animate-spin mt-6" />
        </div>
      )}
      <LoginShell esAppTecnico={esAppTecnico} />
    </>
  );
}
