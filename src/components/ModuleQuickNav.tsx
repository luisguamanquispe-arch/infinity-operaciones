"use client";

import Link from "next/link";
import {
  Bell,
  CalendarDays,
  Contact,
  FileText,
  Plus,
  Users,
} from "lucide-react";
import type { Rol } from "@prisma/client";
import {
  agruparNavItems,
  navItemsPara,
  type NavContext,
  type NavItemResolved,
  type NavTone,
} from "@/lib/modulos-acceso";

const TONE_COMPACT: Record<NavTone, string> = {
  primary:
    "bg-infinity-600 hover:bg-infinity-700 text-white border-transparent",
  violet: "bg-violet-700 hover:bg-violet-800 text-white border-transparent",
  teal: "bg-teal-700 hover:bg-teal-800 text-white border-transparent",
  emerald:
    "border-2 border-emerald-500 bg-emerald-50 text-emerald-900 hover:bg-emerald-100",
  amber:
    "border-2 border-amber-500 bg-amber-50 text-amber-900 hover:bg-amber-100",
  sky: "border border-sky-600 text-sky-700 hover:bg-sky-50",
  red: "border-2 border-red-400 bg-red-50 text-red-800 hover:bg-red-100 font-semibold",
  outline: "border border-infinity-600 text-infinity-700 hover:bg-infinity-50",
  purple: "border border-purple-600 text-purple-700 hover:bg-purple-50",
  white: "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50",
};

const TONE_GERENCIA: Record<NavTone, string> = {
  primary: "bg-infinity-600 hover:bg-infinity-700 text-white",
  violet: "border border-violet-700 text-violet-800 hover:bg-violet-50",
  teal: "border border-teal-700 text-teal-800 hover:bg-teal-50",
  emerald: "border border-emerald-600 text-emerald-800 hover:bg-emerald-50",
  amber: "border border-amber-600 text-amber-800 hover:bg-amber-50",
  sky: "border border-sky-600 text-sky-700 hover:bg-sky-50",
  red: "border-2 border-red-400 bg-red-50 text-red-800 font-semibold hover:bg-red-100",
  outline: "border border-infinity-600 text-infinity-700 hover:bg-infinity-50",
  purple: "border border-purple-600 text-purple-700 hover:bg-purple-50",
  white: "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50",
};

const TONE_TILE: Record<NavTone, string> = {
  primary: "bg-infinity-600 hover:bg-infinity-700 text-white",
  violet: "bg-violet-700 hover:bg-violet-800 text-white",
  teal: "bg-teal-700 hover:bg-teal-800 text-white",
  emerald: "bg-emerald-600 hover:bg-emerald-700 text-white",
  amber:
    "border-2 border-amber-500 bg-amber-50 text-amber-900 hover:bg-amber-100",
  sky: "bg-emerald-700 hover:bg-emerald-800 text-white",
  red: "border-2 border-red-400 bg-red-50 text-red-800",
  outline:
    "bg-white border-2 border-infinity-600 text-infinity-600 hover:bg-infinity-50",
  purple: "border border-purple-600 text-purple-700 hover:bg-purple-50",
  white: "bg-white border border-slate-300 text-slate-800 hover:bg-slate-50",
};

function HomeIcon({ name }: { name?: NavItemResolved["homeIcon"] }) {
  const cls = "w-5 h-5";
  switch (name) {
    case "calendar":
      return <CalendarDays className={cls} />;
    case "file":
      return <FileText className={cls} />;
    case "users":
      return <Users className={cls} />;
    case "contact":
      return <Contact className={cls} />;
    case "bell":
      return <Bell className={cls} />;
    case "plus":
    default:
      return <Plus className={cls} />;
  }
}

function ModuleLinkList({
  items,
  toneMap,
  size = "md",
  ariaLabel,
}: {
  items: NavItemResolved[];
  toneMap: Record<NavTone, string>;
  size?: "sm" | "md";
  ariaLabel: string;
}) {
  const pad = size === "sm" ? "px-3 py-1.5" : "px-3 py-2";
  return (
    <nav aria-label={ariaLabel} className="flex flex-wrap gap-2">
      {items.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          className={`inline-flex items-center gap-1.5 ${pad} rounded-lg text-sm font-medium ${toneMap[item.tone]}`}
        >
          {item.labelResolved}
        </Link>
      ))}
    </nav>
  );
}

/** Menú gerencial: agrupado por lógica de módulos (admin → campo → oficina → CRM). */
export function GerenciaQuickNav({ totalTecnicos }: { totalTecnicos?: number }) {
  const items = navItemsPara("ADMIN", "gerencia", { totalTecnicos });
  const groups = agruparNavItems(items);

  return (
    <div className="space-y-3" aria-label="Menú gerencial">
      {groups.map((g) => (
        <div key={g.group}>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
            {g.title}
          </p>
          <ModuleLinkList
            items={g.items}
            toneMap={TONE_GERENCIA}
            ariaLabel={g.title}
          />
        </div>
      ))}
    </div>
  );
}

/** Accesos del layout supervisor (misma matriz que las tiles del home). */
export function SupervisorQuickNav({
  rol = "SUPERVISOR",
}: {
  rol?: Extract<Rol, "ADMIN" | "SUPERVISOR">;
}) {
  const items = navItemsPara(rol, "supervisor");
  return (
    <ModuleLinkList
      items={items}
      toneMap={TONE_COMPACT}
      size="sm"
      ariaLabel="Módulos de operaciones"
    />
  );
}

/** CTAs grandes del home supervisor — misma fuente que QuickNav. */
export function SupervisorHomeTiles({
  rol = "SUPERVISOR",
}: {
  rol?: Extract<Rol, "ADMIN" | "SUPERVISOR">;
}) {
  const items = navItemsPara(rol, "home-tiles");
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {items.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          className={`flex items-center justify-center gap-2 py-3 font-semibold rounded-xl transition ${TONE_TILE[item.tone]} ${
            item.id === "clientes" ? "sm:col-span-2 lg:col-span-2" : ""
          }`}
        >
          <HomeIcon name={item.homeIcon} />
          {item.labelResolved}
        </Link>
      ))}
    </div>
  );
}

/** Enlace “volver al panel” según contexto (help-desk, etc.). */
export function PanelHomeLink({
  rol,
  className,
}: {
  rol: Rol | string | null | undefined;
  className?: string;
}) {
  if (!rol || rol === "HELP_DESK" || rol === "TECNICO" || rol === "CLIENTE") {
    return null;
  }
  const href = rol === "ADMIN" ? "/gerencia" : "/supervisor";
  const label = rol === "ADMIN" ? "Panel gerencial" : "Panel supervisor";
  return (
    <Link
      href={href}
      className={
        className ??
        "text-sm text-infinity-700 hover:underline font-medium"
      }
    >
      ← {label}
    </Link>
  );
}

export function navForContext(
  rol: Rol | string | null | undefined,
  context: NavContext,
  opts?: { totalTecnicos?: number }
) {
  return navItemsPara(rol, context, opts);
}
