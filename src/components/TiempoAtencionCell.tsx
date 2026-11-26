"use client";

import { useEffect, useState } from "react";
import { Clock, Play, CheckCircle2, AlertTriangle } from "lucide-react";
import {
  calcularDuracionAtencionSegundos,
  ESTADO_CRONOMETRO_ATENCION_LABELS,
  formatHHMMSS,
  nivelAlertaAtencion,
  type CronometroAtencionView,
} from "@/lib/cronometro-atencion/estado";

interface Props {
  ticketId: string;
  cronometro: CronometroAtencionView | null | undefined;
  /** Offset en ms entre servidor y cliente (serverNowMs - clientMountMs) para cálculo preciso. */
  clockOffsetMs?: number;
  /** True solo si el usuario autenticado es un técnico autorizado para este ticket. */
  puedeIniciarLectura?: boolean;
  onIniciado?: (next: CronometroAtencionView) => void;
}

export function TiempoAtencionCell({
  ticketId,
  cronometro,
  clockOffsetMs = 0,
  puedeIniciarLectura = false,
  onIniciado,
}: Props) {
  const [localCron, setLocalCron] = useState<CronometroAtencionView | null>(cronometro ?? null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now() + clockOffsetMs);
  const [iniciando, setIniciando] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    setLocalCron(cronometro ?? null);
  }, [cronometro]);

  const estado = localCron?.estado ?? "PENDIENTE_LECTURA";

  useEffect(() => {
    if (estado !== "EN_ATENCION") return;
    setNowMs(Date.now() + clockOffsetMs);
    const id = setInterval(() => {
      setNowMs(Date.now() + clockOffsetMs);
    }, 1000);
    return () => clearInterval(id);
  }, [estado, clockOffsetMs]);

  const duracion =
    estado === "EN_ATENCION" && localCron?.iniciadoEn
      ? calcularDuracionAtencionSegundos(localCron.iniciadoEn, null, null, nowMs)
      : localCron?.duracionSegundos ?? 0;

  const alerta = nivelAlertaAtencion(estado, duracion);

  async function handleIniciar() {
    if (iniciando) return;
    setIniciando(true);
    setErrorMsg("");
    try {
      const res = await fetch(`/api/tickets/${ticketId}/lectura-atencion/iniciar`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMsg(data.error || "No se pudo iniciar la lectura");
        return;
      }
      if (data.cronometroAtencion) {
        setLocalCron(data.cronometroAtencion);
        onIniciado?.(data.cronometroAtencion);
      }
    } catch {
      setErrorMsg("Error de red al iniciar lectura");
    } finally {
      setIniciando(false);
    }
  }

  if (estado === "PENDIENTE_LECTURA") {
    return (
      <div className="space-y-1">
        <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 whitespace-nowrap">
          <Clock className="w-3 h-3" />
          {ESTADO_CRONOMETRO_ATENCION_LABELS.PENDIENTE_LECTURA}
        </span>
        <div className="font-mono text-xs text-slate-400">00:00:00</div>
        {puedeIniciarLectura && (
          <button
            type="button"
            disabled={iniciando}
            onClick={handleIniciar}
            className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-md bg-infinity-600 text-white hover:bg-infinity-700 disabled:opacity-50 whitespace-nowrap"
          >
            <Play className="w-3 h-3" />
            {iniciando ? "Iniciando…" : "Iniciar lectura"}
          </button>
        )}
        {errorMsg && <p className="text-[11px] text-red-600">{errorMsg}</p>}
      </div>
    );
  }

  if (estado === "EN_ATENCION") {
    const badgeClass =
      alerta === "CRITICA"
        ? "bg-red-100 text-red-800 border border-red-200"
        : alerta === "PROLONGADA"
          ? "bg-amber-100 text-amber-800 border border-amber-200"
          : "bg-blue-100 text-blue-800 border border-blue-200";
    const timerClass =
      alerta === "CRITICA"
        ? "text-red-700 font-bold"
        : alerta === "PROLONGADA"
          ? "text-amber-700 font-bold"
          : "text-blue-700 font-semibold";

    return (
      <div className="space-y-1">
        <span
          className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${badgeClass}`}
        >
          {alerta !== "NORMAL" ? (
            <AlertTriangle className="w-3 h-3" />
          ) : (
            <Clock className="w-3 h-3 animate-pulse" />
          )}
          {ESTADO_CRONOMETRO_ATENCION_LABELS.EN_ATENCION}
        </span>
        <div className={`font-mono text-xs ${timerClass}`}>{formatHHMMSS(duracion)}</div>
        {alerta !== "NORMAL" && (
          <span
            className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded whitespace-nowrap ${
              alerta === "CRITICA"
                ? "bg-red-600 text-white"
                : "bg-amber-500 text-white"
            }`}
          >
            Atención prolongada
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 whitespace-nowrap">
        <CheckCircle2 className="w-3 h-3" />
        {ESTADO_CRONOMETRO_ATENCION_LABELS.INFORME_REGISTRADO}
      </span>
      <div className="font-mono text-xs font-semibold text-emerald-700">
        {formatHHMMSS(duracion)}
      </div>
    </div>
  );
}
