"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CalendarClock,
  MapPin,
  AlertCircle,
  Navigation,
  UserCheck,
  CheckCircle2,
} from "lucide-react";
import { cn, formatDateTime, formatTime, TIPO_LABELS, PRIORIDAD_LABELS } from "@/lib/utils";
import { diaKey } from "@/lib/calendario";
import { ConfirmacionVisitaBadge } from "@/components/ConfirmacionVisitaBadge";
import type { ConfirmacionVisitaView } from "@/lib/confirmacion-visita/reglas";

interface AgendaTicket {
  id: string;
  codigo: string;
  tipo: string;
  prioridad: string;
  estado: string;
  programadoEn: string;
  motivo?: string | null;
  confirmacionVisita?: ConfirmacionVisitaView | null;
  cliente: { nombre: string; sector: string; direccion: string };
}

interface TecnicoAgendaProps {
  tickets: AgendaTicket[];
  proximaOrden: AgendaTicket | null;
  onUpdated?: () => void;
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

export function TecnicoAgenda({ tickets, proximaOrden, onUpdated }: TecnicoAgendaProps) {
  const [enCaminoLoadingId, setEnCaminoLoadingId] = useState<string | null>(null);
  const [enCaminoError, setEnCaminoError] = useState<string>("");

  async function marcarEnCamino(ticketId: string) {
    if (enCaminoLoadingId) return;
    setEnCaminoLoadingId(ticketId);
    setEnCaminoError("");
    try {
      const res = await fetch(`/api/tickets/${ticketId}/en-camino`, {
        method: "POST",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setEnCaminoError(json.error || "No está habilitado para iniciar desplazamiento.");
        return;
      }
      onUpdated?.();
    } catch {
      setEnCaminoError("Error de red al registrar desplazamiento.");
    } finally {
      setEnCaminoLoadingId(null);
    }
  }

  if (tickets.length === 0) {
    return (
      <section className="bg-white rounded-xl border p-4">
        <div className="flex items-center gap-2 mb-2">
          <CalendarClock className="w-5 h-5 text-infinity-600" />
          <h2 className="font-semibold">Agenda de soporte (hoy)</h2>
        </div>
        <p className="text-sm text-slate-500">
          No tiene tickets programados para hoy. El supervisor le asignará fecha y hora desde el calendario.
        </p>
      </section>
    );
  }

  const listosParaSalir = tickets.filter(
    (t) => t.confirmacionVisita?.puedeIniciarDesplazamiento !== false
  );
  const pendientesConfirmacion = tickets.filter(
    (t) => t.confirmacionVisita?.puedeIniciarDesplazamiento === false
  );

  return (
    <section className="space-y-3">
      {enCaminoError && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-800">
          {enCaminoError}
        </div>
      )}

      {proximaOrden && (
        <div className="bg-infinity-600 text-white rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-infinity-100 text-xs font-medium uppercase tracking-wide">
              Próxima reparación confirmada
            </p>
            <ConfirmacionVisitaBadge confirmacion={proximaOrden.confirmacionVisita} compact />
          </div>
          <p className="text-xl font-bold">{formatDateTime(proximaOrden.programadoEn)}</p>
          <p className="font-semibold">{proximaOrden.cliente.nombre}</p>
          <p className="text-sm text-infinity-100 flex items-start gap-1">
            <MapPin className="w-4 h-4 shrink-0 mt-0.5" />
            {proximaOrden.cliente.direccion} — {proximaOrden.cliente.sector}
          </p>
          {proximaOrden.confirmacionVisita?.personaRecibe && (
            <p className="text-xs text-infinity-100 flex items-center gap-1">
              <UserCheck className="w-3.5 h-3.5" />
              Recibe: <strong>{proximaOrden.confirmacionVisita.personaRecibe}</strong>
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Link
              href={`/tecnico/orden/${proximaOrden.id}`}
              className="inline-block px-4 py-2 bg-white text-infinity-700 rounded-lg text-sm font-semibold hover:bg-infinity-50"
            >
              Ver ticket {proximaOrden.codigo}
            </Link>
            {proximaOrden.confirmacionVisita?.puedeIniciarDesplazamiento &&
              !proximaOrden.confirmacionVisita.enCaminoEn && (
                <button
                  type="button"
                  disabled={enCaminoLoadingId === proximaOrden.id}
                  onClick={() => void marcarEnCamino(proximaOrden.id)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-semibold hover:bg-emerald-600 disabled:opacity-50"
                >
                  <Navigation className="w-4 h-4" />
                  {enCaminoLoadingId === proximaOrden.id ? "Registrando…" : "EN CAMINO"}
                </button>
              )}
          </div>
        </div>
      )}

      {listosParaSalir.length > 0 && (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="flex items-center gap-2 p-4 border-b bg-slate-50">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <h2 className="font-semibold">Visitas habilitadas para hoy</h2>
            <span className="text-xs text-slate-500 ml-auto">
              {listosParaSalir.length} habilitada(s)
            </span>
          </div>
          <ul className="divide-y">
            {listosParaSalir.map((t) => {
              const prog = estadoProgramacion(t.programadoEn);
              const conf = t.confirmacionVisita;
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
                        <ConfirmacionVisitaBadge confirmacion={conf} compact />
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
                      {conf?.estado === "CONFIRMADO" && (
                        <div className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md px-2.5 py-1.5 inline-flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
                          {conf.personaRecibe && (
                            <span>
                              <strong>Recibe:</strong> {conf.personaRecibe}
                            </span>
                          )}
                          {conf.confirmadoEn && (
                            <span>
                              <strong>Confirmado:</strong> {formatDateTime(conf.confirmadoEn)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="text-right shrink-0 space-y-1.5">
                      <div>
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
                          {esHoy(t.programadoEn)
                            ? "Hoy"
                            : formatDateTime(t.programadoEn).split(",")[0]}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {PRIORIDAD_LABELS[t.prioridad]}
                        </p>
                      </div>
                      {conf?.puedeIniciarDesplazamiento && !conf.enCaminoEn && (
                        <button
                          type="button"
                          disabled={enCaminoLoadingId === t.id}
                          onClick={() => void marcarEnCamino(t.id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50"
                        >
                          <Navigation className="w-3.5 h-3.5" />
                          {enCaminoLoadingId === t.id ? "Enviando…" : "EN CAMINO"}
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {pendientesConfirmacion.length > 0 && (
        <div className="bg-amber-50/70 rounded-xl border border-amber-200 overflow-hidden">
          <div className="flex items-center gap-2 p-4 border-b border-amber-200 bg-amber-100/60">
            <AlertCircle className="w-5 h-5 text-amber-700" />
            <div>
              <h2 className="font-semibold text-amber-950 text-sm">
                En espera de confirmación del cliente (no iniciar desplazamiento)
              </h2>
              <p className="text-xs text-amber-800">
                Estas visitas requieren confirmación de disponibilidad antes de salir al domicilio.
              </p>
            </div>
            <span className="text-xs font-semibold text-amber-900 ml-auto">
              {pendientesConfirmacion.length}
            </span>
          </div>
          <ul className="divide-y divide-amber-200/70">
            {pendientesConfirmacion.map((t) => (
              <li key={t.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/tecnico/orden/${t.id}`}
                        className="font-semibold text-amber-950 hover:underline"
                      >
                        {t.codigo}
                      </Link>
                      <span className="text-xs text-slate-600">{TIPO_LABELS[t.tipo]}</span>
                      <ConfirmacionVisitaBadge confirmacion={t.confirmacionVisita} compact />
                    </div>
                    <p className="font-medium text-slate-800">{t.cliente.nombre}</p>
                    <p className="text-xs text-slate-600">
                      {t.cliente.sector} — {t.cliente.direccion}
                    </p>
                    {t.confirmacionVisita?.motivoBloqueo && (
                      <p className="text-xs text-amber-900 font-medium">
                        {t.confirmacionVisita.motivoBloqueo}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-base text-slate-700">
                      {formatTime(t.programadoEn)}
                    </p>
                    <p className="text-xs text-slate-500">No listo para salir</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
