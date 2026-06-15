"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Smartphone, Wifi } from "lucide-react";
import { fetchWithRetry } from "@/lib/compress-image";

interface LoginFormProps {
  esAppTecnico: boolean;
}

export function LoginForm({ esAppTecnico: esAppTecnicoInicial }: LoginFormProps) {
  const router = useRouter();
  const [esAppTecnico, setEsAppTecnico] = useState(esAppTecnicoInicial);

  useEffect(() => {
    if (esAppTecnicoInicial) {
      sessionStorage.setItem("infinity-app-tecnico", "1");
      return;
    }
    const cap = (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    const esNativa = cap?.isNativePlatform?.() ?? false;
    const esPwa = window.matchMedia("(display-mode: standalone)").matches;
    const sesionTecnico = sessionStorage.getItem("infinity-app-tecnico") === "1";
    if (esNativa || esPwa || sesionTecnico) {
      setEsAppTecnico(true);
      sessionStorage.setItem("infinity-app-tecnico", "1");
      if (!window.location.search.includes("app=tecnico")) {
        window.history.replaceState(null, "", "/login?app=tecnico");
      }
    }
  }, [esAppTecnicoInicial]);

  useEffect(() => {
    if (esAppTecnico) {
      router.prefetch("/tecnico");
      fetch("/api/health", { cache: "no-store" }).catch(() => {});
    }
  }, [esAppTecnico, router]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetchWithRetry(
        "/api/auth/login",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        },
        2
      );

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error al iniciar sesión");
        return;
      }

      if (esAppTecnico && data.user?.rol && data.user.rol !== "TECNICO") {
        setError("Esta app es solo para técnicos de campo.");
        await fetch("/api/auth/logout", { method: "POST" });
        return;
      }

      if (data.user?.rol === "TECNICO") {
        sessionStorage.setItem("infinity-app-tecnico", "1");
      }

      router.push(data.redirect);
      router.refresh();
    } catch {
      setError("El servidor está iniciando. Espere unos segundos e intente de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center p-4 bg-gradient-to-br from-infinity-800 to-infinity-900 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 mb-4">
            {esAppTecnico ? (
              <Smartphone className="w-8 h-8 text-white" />
            ) : (
              <Wifi className="w-8 h-8 text-white" />
            )}
          </div>
          <h1 className="text-2xl font-bold text-white">
            {esAppTecnico ? "Infinity Técnicos" : "Infinity Operaciones"}
          </h1>
          <p className="text-infinity-200 mt-1">
            {esAppTecnico
              ? "App de campo — soporte e instalaciones"
              : "Panel operativo ISP"}
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-xl p-6 space-y-4"
        >
          {error && (
            <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Correo electrónico
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-infinity-500 text-base"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-infinity-500 text-base"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-infinity-600 hover:bg-infinity-700 text-white font-semibold rounded-xl transition disabled:opacity-50 text-base"
          >
            {loading ? "Ingresando..." : "Iniciar sesión"}
          </button>
        </form>
      </div>
    </div>
  );
}
