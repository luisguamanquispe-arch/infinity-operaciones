"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { ESTADO_LABELS, PRIORIDAD_LABELS, TIPO_LABELS, formatDateTime } from "@/lib/utils";

interface Ticket {
  id: string;
  codigo: string;
  tipo: string;
  prioridad: string;
  estado: string;
  programadoEn?: string | null;
  cliente: { nombre: string; sector: string };
}

interface TicketListProps {
  tickets: Ticket[];
  filtro: string;
  onFiltroChange: (f: string) => void;
}

const FILTROS = [
  { id: "todos", label: "Todos" },
  { id: "pendientes", label: "Pendientes" },
  { id: "en_proceso", label: "En proceso" },
  { id: "finalizadas", label: "Finalizadas" },
  { id: "INSTALACION", label: "Instalaciones" },
  { id: "SOPORTE", label: "Soportes" },
  { id: "INFRAESTRUCTURA", label: "Infraestructura" },
  { id: "CORTE", label: "Cortes" },
  { id: "RECONEXION", label: "Reconexiones" },
];

const estadoColor: Record<string, string> = {
  PENDIENTE: "bg-amber-100 text-amber-800",
  EN_PROCESO: "bg-blue-100 text-blue-800",
  FINALIZADO: "bg-emerald-100 text-emerald-800",
  CERRADO: "bg-slate-100 text-slate-600",
};

const prioridadColor: Record<string, string> = {
  ALTA: "text-red-600 font-semibold",
  MEDIA: "text-amber-600",
  BAJA: "text-slate-500",
};

export function TicketList({ tickets, filtro, onFiltroChange }: TicketListProps) {
  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {FILTROS.map((f) => (
          <button
            key={f.id}
            onClick={() => onFiltroChange(f.id)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition",
              filtro === f.id
                ? "bg-infinity-600 text-white"
                : "bg-white border text-slate-600 hover:bg-slate-50"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left p-3 font-medium">Ticket</th>
                <th className="text-left p-3 font-medium">Programado</th>
                <th className="text-left p-3 font-medium">Cliente</th>
                <th className="text-left p-3 font-medium hidden sm:table-cell">Sector</th>
                <th className="text-left p-3 font-medium">Prioridad</th>
                <th className="text-left p-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {tickets.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-slate-400">
                    No hay órdenes con este filtro
                  </td>
                </tr>
              ) : (
                tickets.map((t) => (
                  <tr key={t.id} className="border-t hover:bg-slate-50">
                    <td className="p-3">
                      <Link
                        href={`/tecnico/orden/${t.id}`}
                        className="text-infinity-600 font-semibold hover:underline"
                      >
                        {t.codigo}
                      </Link>
                      <p className="text-xs text-slate-400 sm:hidden">
                        {TIPO_LABELS[t.tipo]}
                      </p>
                    </td>
                    <td className="p-3">
                      {t.programadoEn ? (
                        <span className="text-sm font-medium text-infinity-700">
                          {formatDateTime(t.programadoEn)}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">Sin programar</span>
                      )}
                    </td>
                    <td className="p-3">{t.cliente.nombre}</td>
                    <td className="p-3 hidden sm:table-cell">{t.cliente.sector}</td>
                    <td className={cn("p-3", prioridadColor[t.prioridad])}>
                      {PRIORIDAD_LABELS[t.prioridad]}
                    </td>
                    <td className="p-3">
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded-full text-xs font-medium",
                          estadoColor[t.estado]
                        )}
                      >
                        {ESTADO_LABELS[t.estado]}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
