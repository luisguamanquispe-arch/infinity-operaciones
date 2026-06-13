"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { addDays, format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Loader2,
  X,
} from "lucide-react";
import {
  ESTADO_TECNICO_LABELS,
  PRIORIDAD_LABELS,
  TIPO_LABELS,
  formatTime,
} from "@/lib/utils";
import { toDatetimeLocalValue } from "@/lib/calendario";
import { TecnicoMultiSelect } from "@/components/TecnicoMultiSelect";

interface TicketCal {
  id: string;
  codigo: string;
  tipo: string;
  prioridad: string;
  motivo: string | null;
  programadoEn: string | null;
  tecnicoId: string | null;
  tecnicoIds?: string[];
  cliente: { nombre: string; sector: string };
}

interface CalendarioData {
  semanaInicio: string;
  semanaFin: string;
  dias: { fecha: string; label: string }[];
  tecnicos: {
    id: string;
    nombre: string;
    estado: string;
    dias: Record<
      string,
      { tickets: TicketCal[]; cupos: number; disponible: boolean }
    >;
  }[];
  sinAsignarPorDia: Record<string, TicketCal[]>;
  sinProgramar: TicketCal[];
}

const PRIORIDAD_COLOR: Record<string, string> = {
  ALTA: "bg-red-100 border-red-300 text-red-900",
  MEDIA: "bg-amber-100 border-amber-300 text-amber-900",
  BAJA: "bg-slate-100 border-slate-300 text-slate-800",
};

const ESTADO_COLOR: Record<string, string> = {
  DISPONIBLE: "bg-emerald-100 text-emerald-800",
  TRABAJANDO: "bg-blue-100 text-blue-800",
  DESCANSO: "bg-slate-100 text-slate-600",
  OFFLINE: "bg-gray-100 text-gray-500",
};

export function CalendarioSoporte() {
  const [semana, setSemana] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [data, setData] = useState<CalendarioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{
    ticket: TicketCal;
    tecnicoIds: string[];
    programadoEn: string;
  } | null>(null);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/supervisor/calendario?semana=${semana}`);
    const json = await res.json();
    setData(json);
    setLoading(false);
  }, [semana]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  function cambiarSemana(delta: number) {
    const d = addDays(parseISO(semana), delta * 7);
    setSemana(format(d, "yyyy-MM-dd"));
  }

  function abrirProgramar(ticket: TicketCal, tecnicoId = "") {
    const ids = ticket.tecnicoIds?.length
      ? ticket.tecnicoIds
      : ticket.tecnicoId
        ? [ticket.tecnicoId]
        : tecnicoId
          ? [tecnicoId]
          : [];
    setModal({
      ticket,
      tecnicoIds: ids,
      programadoEn: toDatetimeLocalValue(ticket.programadoEn) || "",
    });
  }

  async function guardarProgramacion() {
    if (!modal) return;
    setGuardando(true);
    const res = await fetch("/api/supervisor/calendario", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ticketId: modal.ticket.id,
        tecnicoIds: modal.tecnicoIds,
        programadoEn: modal.programadoEn || null,
      }),
    });
    setGuardando(false);
    if (res.ok) {
      setModal(null);
      cargar();
    }
  }

  if (loading || !data) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-infinity-600" />
      </div>
    );
  }

  const rangoLabel = `${format(parseISO(data.semanaInicio), "d MMM", { locale: es })} – ${format(parseISO(data.semanaFin), "d MMM yyyy", { locale: es })}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white rounded-xl border p-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-infinity-600" />
          <h2 className="font-semibold">Semana: {rangoLabel}</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => cambiarSemana(-1)}
            className="p-2 border rounded-lg hover:bg-slate-50"
            aria-label="Semana anterior"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => setSemana(format(new Date(), "yyyy-MM-dd"))}
            className="px-3 py-1.5 text-sm border rounded-lg hover:bg-slate-50"
          >
            Hoy
          </button>
          <button
            type="button"
            onClick={() => cambiarSemana(1)}
            className="p-2 border rounded-lg hover:bg-slate-50"
            aria-label="Semana siguiente"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-slate-600">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-emerald-200 border border-emerald-400" />
          Cupo disponible
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-red-50 border border-red-200" />
          Sin cupo / no disponible
        </span>
        <span>Disponible: hasta 4 tickets/día · Trabajando: hasta 2/día</span>
      </div>

      <div className="bg-white rounded-xl border overflow-x-auto">
        <table className="w-full min-w-[800px] text-sm">
          <thead>
            <tr className="bg-slate-50 border-b">
              <th className="text-left p-3 w-36 sticky left-0 bg-slate-50 z-10">Técnico</th>
              {data.dias.map((d) => (
                <th key={d.fecha} className="text-left p-2 min-w-[120px] capitalize">
                  {d.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b bg-amber-50/50">
              <td className="p-3 font-medium sticky left-0 bg-amber-50/50 z-10 text-amber-900">
                Sin técnico
              </td>
              {data.dias.map((d) => (
                <td key={d.fecha} className="p-2 align-top border-l border-slate-100">
                  <CeldaTickets
                    tickets={data.sinAsignarPorDia[d.fecha] || []}
                    onProgramar={abrirProgramar}
                  />
                </td>
              ))}
            </tr>
            {data.tecnicos.map((tec) => (
              <tr key={tec.id} className="border-b">
                <td className="p-3 sticky left-0 bg-white z-10">
                  <p className="font-medium">{tec.nombre}</p>
                  <span
                    className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${ESTADO_COLOR[tec.estado] || ""}`}
                  >
                    {ESTADO_TECNICO_LABELS[tec.estado]}
                  </span>
                </td>
                {data.dias.map((d) => {
                  const celda = tec.dias[d.fecha];
                  return (
                    <td
                      key={d.fecha}
                      className={`p-2 align-top border-l border-slate-100 min-h-[80px] ${
                        celda?.disponible ? "bg-emerald-50/30" : "bg-red-50/20"
                      }`}
                    >
                      {celda && (
                        <>
                          <p className="text-[10px] text-slate-400 mb-1">
                            {celda.cupos > 0 ? `${celda.cupos} cupo(s)` : "Lleno"}
                          </p>
                          <CeldaTickets
                            tickets={celda.tickets}
                            onProgramar={(t) => abrirProgramar(t, tec.id)}
                          />
                        </>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.sinProgramar.length > 0 && (
        <section className="bg-white rounded-xl border p-4">
          <h3 className="font-semibold mb-3">
            Por programar ({data.sinProgramar.length})
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {data.sinProgramar.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => abrirProgramar(t)}
                className={`text-left p-3 rounded-lg border hover:shadow-sm transition ${PRIORIDAD_COLOR[t.prioridad]}`}
              >
                <p className="font-semibold text-sm">{t.codigo}</p>
                <p className="text-xs truncate">{t.cliente.nombre}</p>
                <p className="text-xs opacity-75">{TIPO_LABELS[t.tipo]}</p>
              </button>
            ))}
          </div>
        </section>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-4 space-y-4 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold">Programar ticket</h3>
                <p className="text-sm text-infinity-600">{modal.ticket.codigo}</p>
                <p className="text-xs text-slate-500">{modal.ticket.cliente.nombre}</p>
              </div>
              <button type="button" onClick={() => setModal(null)} className="p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="text-xs text-slate-500">Fecha y hora de visita</label>
              <input
                type="datetime-local"
                value={modal.programadoEn}
                onChange={(e) =>
                  setModal({ ...modal, programadoEn: e.target.value })
                }
                className="w-full px-3 py-2 border rounded-lg text-sm mt-0.5"
              />
            </div>

            <TecnicoMultiSelect
              label="Técnicos asignados (puede seleccionar varios)"
              tecnicos={data.tecnicos.map((t) => ({
                id: t.id,
                nombre: t.nombre,
                estado: t.estado,
              }))}
              selected={modal.tecnicoIds}
              onChange={(tecnicoIds) => setModal({ ...modal, tecnicoIds })}
            />

            <div className="flex gap-2">
              <Link
                href={`/supervisor/tickets/${modal.ticket.id}/editar`}
                className="flex-1 py-2 text-center border rounded-lg text-sm"
              >
                Editar ticket
              </Link>
              <button
                type="button"
                onClick={guardarProgramacion}
                disabled={guardando}
                className="flex-1 py-2 bg-infinity-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {guardando ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CeldaTickets({
  tickets,
  onProgramar,
}: {
  tickets: TicketCal[];
  onProgramar: (t: TicketCal) => void;
}) {
  if (tickets.length === 0) {
    return <span className="text-[10px] text-slate-300">—</span>;
  }

  return (
    <div className="space-y-1">
      {tickets.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onProgramar(t)}
          className={`w-full text-left p-1.5 rounded border text-[11px] leading-tight hover:shadow-sm ${PRIORIDAD_COLOR[t.prioridad]}`}
        >
          <span className="font-semibold block">{t.codigo}</span>
          <span className="block truncate opacity-80">{t.cliente.nombre}</span>
          {t.programadoEn && (
            <span className="block text-[10px] opacity-70">
              {formatTime(t.programadoEn)}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
