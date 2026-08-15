"use client";

import Link from "next/link";

export type ResumenSoportes = {
  total: number;
  ultimos30: number;
  ultimos90: number;
  anio: number;
  ultimoSoporte: { id: string; codigo: string; fecha: string; motivo: string | null } | null;
  tiempoPromedioMin: number | null;
  tiempoResolucionPromedioMin: number | null;
  problemaFrecuente: string | null;
  problemasFrecuentes: { motivo: string; cantidad: number }[];
  tecnicoMasFrecuente: { nombre: string; cantidad: number } | null;
  tecnicos: { nombre: string; cantidad: number }[];
  reincidencias: number;
  alerta: {
    nivel: "verde" | "amarillo" | "rojo";
    label: string;
    detalle: string;
    tickets30: number;
    reincidencia: boolean;
    cantidadesMotivoVentana: { motivo: string; cantidad: number }[];
    motivosRecurrentes: { motivo: string; cantidad: number }[];
  };
};

const ALERTA_UI = {
  verde: {
    dot: "🟢",
    box: "bg-emerald-50 border-emerald-200 text-emerald-900",
  },
  amarillo: {
    dot: "🟡",
    box: "bg-amber-50 border-amber-200 text-amber-950",
  },
  rojo: {
    dot: "🔴",
    box: "bg-red-50 border-red-200 text-red-950",
  },
} as const;

function fechaCorta(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-EC");
}

export function HistorialSoportesResumen({
  clienteNombre,
  plan,
  resumen,
  href,
}: {
  clienteNombre: string;
  plan: string;
  resumen: ResumenSoportes;
  href?: string;
}) {
  const ui = ALERTA_UI[resumen.alerta.nivel];

  return (
    <section className="space-y-3">
      <h2 className="font-semibold text-slate-900">Historial de soportes</h2>
      <div className="bg-white rounded-xl border p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold text-slate-900">{clienteNombre}</h2>
            <p className="text-sm text-slate-500">Plan {plan}</p>
          </div>
          {href && (
            <Link
              href={href}
              className="text-sm font-medium text-infinity-600 hover:underline"
            >
              Ver historial completo
            </Link>
          )}
        </div>
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <Stat label="Soportes" value={String(resumen.total)} />
          <Stat label="Últimos 30 días" value={String(resumen.ultimos30)} />
          <Stat label="Últimos 90 días" value={String(resumen.ultimos90)} />
          <Stat label="Este año" value={String(resumen.anio)} />
          <Stat label="Último soporte" value={fechaCorta(resumen.ultimoSoporte?.fecha)} />
          <Stat
            label="Tiempo promedio"
            value={resumen.tiempoPromedioMin != null ? `${resumen.tiempoPromedioMin} min` : "—"}
          />
          <Stat label="Problema frecuente" value={resumen.problemaFrecuente ?? "—"} />
          <Stat label="Reincidencias" value={String(resumen.reincidencias)} />
        </div>
        {resumen.tecnicoMasFrecuente && (
          <p className="mt-3 text-xs text-slate-500">
            Técnico que más lo ha atendido:{" "}
            <span className="font-medium text-slate-700">
              {resumen.tecnicoMasFrecuente.nombre} ({resumen.tecnicoMasFrecuente.cantidad})
            </span>
          </p>
        )}
      </div>

      <div className={`rounded-xl border p-3 text-sm ${ui.box}`}>
        <p className="font-semibold">
          {ui.dot} {resumen.alerta.label}
        </p>
        <p className="mt-1">{resumen.alerta.detalle}</p>
        {resumen.alerta.reincidencia && resumen.alerta.tickets30 >= 4 && (
          <p className="mt-2 font-medium">
            Este cliente ha registrado {resumen.alerta.tickets30} soportes en los últimos 30 días.
          </p>
        )}
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="font-semibold text-slate-800 truncate" title={value}>
        {value}
      </p>
    </div>
  );
}
