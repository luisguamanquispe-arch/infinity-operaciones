"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/supervisor/inventario", label: "Dashboard" },
  { href: "/supervisor/inventario/materiales", label: "Materiales" },
  { href: "/supervisor/inventario/stock", label: "Stock" },
  { href: "/supervisor/inventario/solicitudes", label: "Solicitudes" },
  { href: "/supervisor/inventario/solicitudes/nueva", label: "Nueva solicitud" },
  { href: "/supervisor/inventario/kardex", label: "Kardex" },
];

export function InventarioSubnav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap gap-2 mb-4" aria-label="Inventario">
      {LINKS.map((l) => {
        const active =
          l.href === "/supervisor/inventario"
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
