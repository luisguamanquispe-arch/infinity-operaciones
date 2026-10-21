"use client";

import { AppHeader } from "@/components/AppHeader";
import { ParqueSubnav } from "@/components/parque/ParqueSubnav";
import {
  SUBTITULO_REPORTE_PARQUE,
  TIPOS_REPORTE_PARQUE,
  TITULO_REPORTE_PARQUE,
  type TipoReporteParque,
} from "@/lib/parque-automotor/labels";

const ORIENTACION: Record<TipoReporteParque, string> = {
  flota: "PDF vertical A4",
  combustible: "PDF horizontal A4",
  kilometraje: "PDF horizontal A4",
  mantenimiento: "PDF vertical A4",
  novedades: "PDF vertical A4",
  costos: "PDF horizontal A4",
  asignaciones: "PDF vertical A4",
  inspecciones: "PDF vertical A4",
};

export default function ReportesParquePage() {
  return (
    <div>
      <AppHeader title="Reportes" subtitle="Parque automotor" />
      <main className="max-w-6xl mx-auto p-4">
        <p className="text-xl font-semibold mb-1">Reportes corporativos</p>
        <ParqueSubnav />
        <p className="text-sm text-slate-600 mb-4">
          Exportaciones para gerencia, administración y auditoría. Los indicadores salen de
          registros reales. PDF e Excel requieren perfil ADMIN o SUPERVISOR.
        </p>
        <ul className="grid gap-3 md:grid-cols-2">
          {TIPOS_REPORTE_PARQUE.map((t) => (
            <li
              key={t}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col gap-3"
            >
              <div>
                <h2 className="font-semibold text-slate-900">{TITULO_REPORTE_PARQUE[t]}</h2>
                <p className="text-sm text-slate-600 mt-1">{SUBTITULO_REPORTE_PARQUE[t]}</p>
                <p className="text-xs text-slate-400 mt-2">{ORIENTACION[t]}</p>
              </div>
              <div className="flex flex-wrap gap-2 mt-auto">
                <a
                  className="inline-flex items-center px-3 py-1.5 rounded-lg bg-infinity-700 text-white text-sm font-medium hover:bg-infinity-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-infinity-500"
                  href={`/api/vehiculos/reportes/pdf?tipo=${t}`}
                  download
                  aria-label={`Descargar PDF de ${TITULO_REPORTE_PARQUE[t]}`}
                >
                  Descargar PDF
                </a>
                <a
                  className="inline-flex items-center px-3 py-1.5 rounded-lg border border-slate-300 text-slate-800 text-sm font-medium hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-infinity-500"
                  href={`/api/vehiculos/reportes/excel?tipo=${t}`}
                  download
                  aria-label={`Descargar Excel de ${TITULO_REPORTE_PARQUE[t]}`}
                >
                  Descargar Excel
                </a>
              </div>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
