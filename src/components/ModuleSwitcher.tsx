"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, LayoutGrid } from "lucide-react";
import type { Rol } from "@prisma/client";
import {
  hubActivo,
  hubsParaRol,
  navItemsPara,
  puedeUsarModuleSwitcher,
} from "@/lib/modulos-acceso";

type Props = {
  rol: Rol | string;
  /** Mostrar menú Acciones (ticket, calendario, etc.). */
  showAcciones?: boolean;
};

/**
 * Barra de hubs entre módulos: scroll horizontal, resalta el activo,
 * y acciones secundarias en un menú desplegable.
 */
export function ModuleSwitcher({ rol, showAcciones = true }: Props) {
  const pathname = usePathname() || "/";
  const activo = hubActivo(pathname, rol);
  const hubs = hubsParaRol(rol);
  const acciones =
    showAcciones && (rol === "ADMIN" || rol === "SUPERVISOR")
      ? navItemsPara(rol, "acciones")
      : [];
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Centrar el hub activo en el scroll horizontal (móvil).
  useEffect(() => {
    const root = scrollerRef.current;
    if (!root || !activo) return;
    const el = root.querySelector<HTMLElement>(`[data-hub="${activo}"]`);
    el?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [activo]);

  if (!puedeUsarModuleSwitcher(rol) || hubs.length <= 1) return null;

  return (
    <div className="bg-infinity-900/95 border-b border-infinity-700/80 text-white">
      <div className="max-w-6xl mx-auto px-2 sm:px-4 py-1.5 flex items-center gap-2">
        <LayoutGrid
          className="w-4 h-4 text-infinity-300 shrink-0 hidden sm:block"
          aria-hidden
        />
        <div
          ref={scrollerRef}
          className="flex-1 min-w-0 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <nav
            aria-label="Módulos"
            className="flex items-center gap-1 w-max pr-1"
          >
            {hubs.map((hub) => {
              const isActive = hub.id === activo;
              return (
                <Link
                  key={hub.id}
                  href={hub.href}
                  data-hub={hub.id}
                  aria-current={isActive ? "page" : undefined}
                  className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition ${
                    isActive
                      ? "bg-white text-infinity-900 shadow-sm"
                      : "text-infinity-100 hover:bg-white/10"
                  }`}
                >
                  <span className="sm:hidden">{hub.shortLabel}</span>
                  <span className="hidden sm:inline">{hub.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {acciones.length > 0 && (
          <div className="relative shrink-0" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium bg-infinity-700 hover:bg-infinity-600 border border-infinity-500/50"
            >
              Acciones
              <ChevronDown
                className={`w-3.5 h-3.5 transition ${menuOpen ? "rotate-180" : ""}`}
              />
            </button>
            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 mt-1.5 w-56 rounded-xl border border-slate-200 bg-white text-slate-800 shadow-xl z-50 py-1 overflow-hidden"
              >
                {acciones.map((a) => (
                  <Link
                    key={a.id}
                    role="menuitem"
                    href={a.href}
                    className="block px-3 py-2.5 text-sm hover:bg-slate-50"
                    onClick={() => setMenuOpen(false)}
                  >
                    {a.labelResolved}
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
