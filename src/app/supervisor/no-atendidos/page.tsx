"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarClock, Loader2, CheckCircle } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { SemaforoTiempo } from "@/components/SemaforoTiempo";
import { TecnicoMultiSelect } from "@/components/TecnicoMultiSelect";
import { DIAS_SIN_ATENCION_LIMITE, type FaseSemaforoTiempo } from "@/lib/ticket-antiguedad";
import { PRIORIDAD_LABELS, TIPO_LABELS, formatDateTime } from "@/lib/utils";
import { toDatetimeLocalValue } from "@/lib/calendario";

type TicketNoAtendido = {
  id: string;
  codigo: string;
  tipo: string;
  esInfra: boolean;
  prioridad: string;
  estado: string;
  estadoLabel: string;
  tipoLabel: string;
  createdAt: string;
  programadoEn: string | null;
  diasSinAtencion: number;
  faseTiempo: FaseSemaforoTiempo;
  cliente: { nombre: string; sector: string; direccion: string };
  sector: string;
  direccion: string;
  tecnicoIds: string[];
  tecnicosLabel: string;
};

type Tecnico = { id: string; nombre: string; estado: string };

export default function NoAtendidosPage() {
  const [tickets, setTickets] = useState<TicketNoAtendido[]>([]);
  const [tecnicos, setTecnicos] = useState<Tecnico[]>([]);
  const [ambito, setAmbito] = useState<"todos" | "clientes" | "infra">("todos");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exito, setExito] = useState("");
  const [reagendandoId, setReagendandoId] = useState<string | null>(null);
  const [form, setForm] = useState({
    ticketId: "",
    programadoEn: "",
    tecnicoIds: [] as string[],
  });

  const cargar = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [tRes, tecRes] = await Promise.all([
        fetch(`/api/supervisor/no-atendidos?ambito=${ambito}`),
        fetch("/api/tecnicos"),
      ]);
      const tData = await tRes.json();
      const tecData = await tecRes.json();
      if (!tRes.ok) throw new Error(tData.error || "Error al cargar");
      setTickets(tData.tickets || []);
      setTecnicos(tecData.tecnicos || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, [ambito]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  function abrirReagendar(t: TicketNoAtendido) {
    setExito("");
    setError("");
    setForm({
      ticketId: t.id,
      programadoEn: toDatetimeLocalValue(new Date()),
      tecnicoIds: t.tecnicoIds,
    });
    setReagendandoId(t.id);
  }

  async function guardarReagendar(e: React.FormEvent) {
    e.preventDefault();
    if (!form.ticketId || !form.programadoEn) {
      setError("Indique la nueva fecha y hora");
      return;
    }
    setError("");
    setExito("");
    const res = await fetch("/api/supervisor/no-atendidos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ticketId: form.ticketId,
        programadoEn: form.programadoEn,
        tecnicoIds: form.tecnicoIds,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "No se pudo re-agendar");
      return;
    }
    setExito(`Ticket ${data.ticket?.codigo || ""} re-agendado y vuelto a activos`);
    setReagendandoId(null);
    await cargar();
  }

  return (
    <div className="min-h-dvh bg-slate-50">
      <AppHeader
        title="Soportes no atendidos"
        subtitle={`Sin atención ≥ ${DIAS_SIN_ATENCION_LIMITE} días · clientes e infraestructura`}
      />

      <main className="max-w-5xl mx-auto p-4 space-y-4">
        <Link
          href="/supervisor"
          className="inline-flex items-center gap-1 text-sm text-infinity-600 hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al panel
        </Link>

        <p className="text-sm text-slate-600">
          Los soportes abiertos que superan {DIAS_SIN_ATENCION_LIMITE} días sin atención
          (desde la fecha programada o, si no hay, desde la creación) salen de las listas
          activas. Aquí puede <strong>re-agendarlos</strong> para devolverlos al flujo
          operativo.
        </p>

        <div className="flex flex-wrap gap-2">
          {(
            [
              ["todos", "Todos"],
              ["clientes", "Clientes / campo"],
              ["infra", "Infraestructura"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setAmbito(k)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${
                ambito === k
                  ? "bg-red-50 border-red-300 text-red-900"
                  : "bg-white border-slate-200 text-slate-600"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 p-3 rounded-xl text-sm">{error}</div>
        )}
        {exito && (
          <div className="bg-emerald-50 text-emerald-700 p-3 rounded-xl text-sm flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            {exito}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-infinity-600" />
          </div>
        ) : tickets.length === 0 ? (
          <div className="bg-white border rounded-xl p-8 text-center text-slate-500 text-sm">
            No hay soportes no atendidos en este filtro.
          </div>
        ) : (
          <div className="space-y-3">
            {tickets.map((t) => (
              <section
                key={t.id}
                className="bg-white rounded-xl border border-red-100 p-4 space-y-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-infinity-700">{t.codigo}</span>
                      <SemaforoTiempo fase={t.faseTiempo} dias={t.diasSinAtencion} />
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                        {t.esInfra ? "Infraestructura" : TIPO_LABELS[t.tipo] || t.tipo}
                      </span>
                      <span className="text-xs text-slate-500">
                        {PRIORIDAD_LABELS[t.prioridad] || t.prioridad}
                      </span>
                    </div>
                    <p className="text-sm font-medium mt-1">
                      {t.esInfra ? t.tipoLabel : t.cliente.nombre}
                    </p>
                    <p className="text-xs text-slate-500">
                      {t.sector} · {t.direccion}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Estado: {t.estadoLabel} · Técnicos: {t.tecnicosLabel || "Sin asignar"}
                    </p>
                    <p className="text-xs text-red-700 mt-1">
                      {t.diasSinAtencion} día(s) sin atención · Creado{" "}
                      {formatDateTime(t.createdAt)}
                      {t.programadoEn
                        ? ` · Programado ${formatDateTime(t.programadoEn)}`
                        : " · Sin fecha programada"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/supervisor/tickets/${t.id}/editar`}
                      className="text-xs font-medium text-infinity-600 hover:underline px-2 py-1"
                    >
                      Editar
                    </Link>
                    <button
                      type="button"
                      onClick={() => abrirReagendar(t)}
                      className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-infinity-600 text-white hover:bg-infinity-700"
                    >
                      <CalendarClock className="w-3.5 h-3.5" />
                      Re-agendar
                    </button>
                  </div>
                </div>

                {reagendandoId === t.id && (
                  <form
                    onSubmit={(e) => void guardarReagendar(e)}
                    className="border-t pt-3 space-y-3"
                  >
                    <p className="text-sm font-semibold text-slate-800">
                      Nueva fecha de visita
                    </p>
                    <div>
                      <label className="text-xs text-slate-500">Fecha y hora *</label>
                      <input
                        type="datetime-local"
                        required
                        value={form.programadoEn}
                        onChange={(e) =>
                          setForm({ ...form, programadoEn: e.target.value })
                        }
                        className="w-full px-3 py-2 border rounded-lg text-sm mt-0.5"
                      />
                    </div>
                    <TecnicoMultiSelect
                      label="Técnicos asignados"
                      tecnicos={tecnicos}
                      selected={form.tecnicoIds}
                      onChange={(tecnicoIds) => setForm({ ...form, tecnicoIds })}
                    />
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700"
                      >
                        Confirmar re-agendado
                      </button>
                      <button
                        type="button"
                        onClick={() => setReagendandoId(null)}
                        className="px-4 py-2 border rounded-lg text-sm text-slate-600"
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                )}
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
