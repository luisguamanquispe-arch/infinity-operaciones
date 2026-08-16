"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/supervisor/parque-automotor", label: "Resumen" },
  { href: "/supervisor/parque-automotor/vehiculos", label: "Vehículos" },
  { href: "/supervisor/parque-automotor/asignaciones", label: "Asignaciones" },
  { href: "/supervisor/parque-automotor/combustible", label: "Combustible" },
  { href: "/supervisor/parque-automotor/mantenimiento", label: "Mantenimiento" },
  { href: "/supervisor/parque-automotor/novedades", label: "Novedades" },
  { href: "/supervisor/parque-automotor/inspecciones", label: "Inspecciones" },
  { href: "/supervisor/parque-automotor/documentos", label: "Documentos" },
  { href: "/supervisor/parque-automotor/reportes", label: "Reportes" },
];

export function ParqueSubnav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap gap-2 mb-4" aria-label="Parque automotor">
      {LINKS.map((l) => {
        const active =
          l.href === "/supervisor/parque-automotor"
            ? pathname === l.href
            : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${
              active
                ? "bg-infinity-600 text-white border-infinity-600"
                : "border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
