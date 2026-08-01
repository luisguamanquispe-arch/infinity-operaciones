"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import type { Rol } from "@prisma/client";
import { BrandLogo } from "@/components/BrandLogo";
import { ModuleSwitcher } from "@/components/ModuleSwitcher";
import {
  homePathPorRol,
  puedeUsarModuleSwitcher,
} from "@/lib/modulos-acceso";

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  /**
   * Barra de módulos:
   * - omitido / undefined: auto según ruta (gerencia, supervisor, help-desk, reportes)
   * - false: nunca
   * - true: forzar (carga rol vía API)
   * - Rol: usa ese rol sin fetch
   */
  modules?: boolean | Rol;
}

function rutaConModulos(pathname: string): boolean {
  if (pathname.startsWith("/tecnico") || pathname.startsWith("/login")) {
    return false;
  }
  return (
    pathname.startsWith("/gerencia") ||
    pathname.startsWith("/supervisor") ||
    pathname.startsWith("/help-desk") ||
    pathname.startsWith("/soporte-remoto") ||
    pathname.startsWith("/reportes")
  );
}

/**
 * Cabecera compartida. El logo lleva al panel home del rol.
 * En paneles de oficina/campo muestra el conmutador entre módulos.
 */
export function AppHeader({ title, subtitle, modules }: AppHeaderProps) {
  const router = useRouter();
  const pathname = usePathname() || "/";
  const auto = modules === undefined ? rutaConModulos(pathname) : modules !== false;
  const [rol, setRol] = useState<Rol | null>(
    typeof modules === "string" ? modules : null
  );

  useEffect(() => {
    if (!auto) {
      setRol(typeof modules === "string" ? modules : null);
      return;
    }
    if (typeof modules === "string") {
      setRol(modules);
      return;
    }
    let cancelled = false;
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d?.user?.rol) setRol(d.user.rol as Rol);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [auto, modules, pathname]);

  const homeHref = homePathPorRol(rol);
  const showSwitcher =
    auto && rol != null && puedeUsarModuleSwitcher(rol);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    const loginUrl = pathname.startsWith("/tecnico")
      ? "/login?app=tecnico"
      : "/login";
    router.push(loginUrl);
    router.refresh();
  }

  const logoHref = rol
    ? homeHref
    : pathname.startsWith("/tecnico")
      ? "/tecnico"
      : "/";

  return (
    <header className="sticky top-0 z-50 shadow-lg">
      <div className="bg-infinity-800 text-white px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Link
              href={logoHref}
              className="shrink-0 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              title="Ir al panel principal"
              aria-label="Ir al panel principal"
            >
              <BrandLogo variant="header" />
            </Link>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold truncate leading-tight">
                {title}
              </h1>
              {subtitle && (
                <p className="text-infinity-200 text-xs sm:text-sm truncate">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={logout}
            className="p-2 rounded-lg hover:bg-white/10 transition shrink-0"
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
      {showSwitcher && rol && (
        <ModuleSwitcher
          rol={rol}
          showAcciones={rol === "ADMIN" || rol === "SUPERVISOR"}
        />
      )}
    </header>
  );
}
