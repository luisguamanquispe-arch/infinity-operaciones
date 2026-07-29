"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { fetchWithRetry } from "@/lib/compress-image";
import { hideCapacitorSplash } from "@/lib/hide-capacitor-splash";
import { BrandLogo } from "@/components/BrandLogo";

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
      void hideCapacitorSplash();
    }
  }, [esAppTecnico, router]);

  useEffect(() => {
    if (!esAppTecnico) return;
    const cap = (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    if (!cap?.isNativePlatform?.()) return;
    const id = window.setInterval(() => {
      fetch("/api/health", { cache: "no-store" }).catch(() => {});
    }, 8 * 60 * 1000);
    return () => window.clearInterval(id);
  }, [esAppTecnico]);

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
          headers: {
            "Content-Type": "application/json",
            ...(esAppTecnico ? { "X-Infinity-App": "tecnico" } : {}),
          },
          credentials: "include",
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
            password: password.trim(),
            ...(esAppTecnico ? { app: "tecnico" } : {}),
          }),
        },
        2
      );

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401 && esAppTecnico) {
          setError(
            data.error ||
              "Email o contraseña incorrectos. Si acaba de crear el técnico, use exactamente la clave definida en Gerencia → Técnicos. Puede restablecerla en Usuarios y claves."
          );
        } else if (res.status === 403 && esAppTecnico) {
          setError(data.error || "Esta cuenta no puede usar la app de técnicos.");
        } else {
          setError(data.error || "Error al iniciar sesión");
        }
        return;
      }

      if (esAppTecnico && data.user?.rol && data.user.rol !== "TECNICO") {
        setError("Esta app es solo para técnicos de campo.");
        await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
        return;
      }

      if (data.user?.rol === "TECNICO") {
        sessionStorage.setItem("infinity-app-tecnico", "1");
      }

      const dest =
        typeof data.redirect === "string" && data.redirect.startsWith("/")
          ? data.redirect
          : "/";
      window.location.assign(dest);
    } catch {
      setError("El servidor está iniciando. Espere unos segundos e intente de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center p-4 bg-gradient-to-br from-infinity-800 to-infinity-900 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div className="w-full max-w-md">
        <div className="text-center mb-8 flex flex-col items-center">
          <BrandLogo variant="hero" priority className="mb-5" />
          <p className="text-white font-semibold text-lg tracking-wide">
            {esAppTecnico ? "Técnicos" : "Operaciones"}
          </p>
          <p className="text-infinity-200 mt-1 text-sm max-w-xs">
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
