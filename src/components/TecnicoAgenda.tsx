"use client";

import Link from "next/link";
import { CalendarClock, MapPin, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateTime, formatTime, TIPO_LABELS, PRIORIDAD_LABELS } from "@/lib/utils";
import { diaKey } from "@/lib/calendario";

interface AgendaTicket {
  id: string;
  codigo: string;
  tipo: string;
  prioridad: string;
  estado: string;
  programadoEn: string;
  motivo?: string | null;
  cliente: { nombre: string; sector: string; direccion: string };
}

interface TecnicoAgendaProps {
  tickets: AgendaTicket[];
  proximaOrden: AgendaTicket | null;
}

function esHoy(iso: string) {
  return diaKey(new Date(iso)) === diaKey(new Date());
}

function estadoProgramacion(iso: string): "vencida" | "proxima" | "futura" {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff < -15 * 60 * 1000) return "vencida";
  if (diff <= 60 * 60 * 1000) return "proxima";
  return "futura";
}

export function TecnicoAgenda({ tickets, proximaOrden }: TecnicoAgendaProps) {
  if (tickets.length === 0) {
    return (
      <section className="bg-white rounded-xl border p-4">
        <div className="flex items-center gap-2 mb-2">
          <CalendarClock className="w-5 h-5 text-infinity-600" />
          <h2 className="font-semibold">Agenda de soporte</h2>
        </div>
        <p className="text-sm text-slate-500">
          No tiene tickets programados. El supervisor le asignará fecha y hora desde el calendario.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      {proximaOrden && (
        <div className="bg-infinity-600 text-white rounded-xl p-4 space-y-2">
          <p className="text-infinity-100 text-xs font-medium uppercase tracking-wide">
            Próxima reparación
          </p>
          <p className="text-xl font-bold">{formatDateTime(proximaOrden.programadoEn)}</p>
          <p className="font-semibold">{proximaOrden.cliente.nombre}</p>
          <p className="text-sm text-infinity-100 flex items-start gap-1">
            <MapPin className="w-4 h-4 shrink-0 mt-0.5" />
            {proximaOrden.cliente.direccion} — {proximaOrden.cliente.sector}
          </p>
          <Link
            href={`/tecnico/orden/${proximaOrden.id}`}
            className="inline-block mt-1 px-4 py-2 bg-white text-infinity-700 rounded-lg text-sm font-semibold hover:bg-infinity-50"
          >
            Ver ticket {proximaOrden.codigo}
          </Link>
        </div>
      )}

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="flex items-center gap-2 p-4 border-b bg-slate-50">
          <CalendarClock className="w-5 h-5 text-infinity-600" />
          <h2 className="font-semibold">Agenda de soporte</h2>
          <span className="text-xs text-slate-500 ml-auto">{tickets.length} programado(s)</span>
        </div>
        <ul className="divide-y">
          {tickets.map((t) => {
            const prog = estadoProgramacion(t.programadoEn);
            return (
              <li key={t.id} className="p-4 hover:bg-slate-50">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/tecnico/orden/${t.id}`}
                        className="font-semibold text-infinity-600 hover:underline"
                      >
                        {t.codigo}
                      </Link>
                      <span className="text-xs text-slate-500">{TIPO_LABELS[t.tipo]}</span>
                      {prog === "vencida" &&
                        (t.estado === "PENDIENTE" || t.estado === "LEIDO") && (
                        <span className="inline-flex items-center gap-1 text-xs text-red-600 font-medium">
                          <AlertCircle className="w-3 h-3" />
                          Hora pasada
                        </span>
                      )}
                    </div>
                    <p className="font-medium">{t.cliente.nombre}</p>
                    <p className="text-sm text-slate-500">
                      {t.cliente.sector} — {t.cliente.direccion}
                    </p>
                    {t.motivo && (
                      <p className="text-sm text-slate-600">Motivo: {t.motivo}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p
                      className={cn(
                        "font-bold text-lg",
                        prog === "proxima" && "text-infinity-600",
                        prog === "vencida" &&
                          (t.estado === "PENDIENTE" || t.estado === "LEIDO") &&
                          "text-red-600",
                        prog === "futura" && "text-slate-800"
                      )}
                    >
                      {formatTime(t.programadoEn)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {esHoy(t.programadoEn) ? "Hoy" : formatDateTime(t.programadoEn).split(",")[0]}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {PRIORIDAD_LABELS[t.prioridad]}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
