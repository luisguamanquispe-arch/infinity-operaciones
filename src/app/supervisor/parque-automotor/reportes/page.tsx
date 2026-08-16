"use client";

import { AppHeader } from "@/components/AppHeader";
import { ParqueSubnav } from "@/components/parque/ParqueSubnav";

const TIPOS = [
  "combustible",
  "kilometraje",
  "mantenimiento",
  "novedades",
  "costos",
  "asignaciones",
  "inspecciones",
] as const;

export default function ReportesParquePage() {
  return (
    <div>
      <AppHeader title="Reportes" subtitle="Parque automotor" />
      <main className="max-w-6xl mx-auto p-4">
        <h1 className="text-xl font-semibold mb-2">Reportes</h1>
        <ParqueSubnav />
        <p className="text-sm text-slate-600 mb-3">Exportación PDF (Excel no está habilitado en el sistema como exportador).</p>
        <ul className="space-y-2">
          {TIPOS.map((t) => (
            <li key={t}>
              <a className="text-infinity-700 underline" href={`/api/vehiculos/reportes/pdf?tipo=${t}`}>
                Descargar {t}.pdf
              </a>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
