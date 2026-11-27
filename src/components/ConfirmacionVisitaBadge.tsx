"use client";

import {
  CheckCircle2,
  Clock,
  CalendarClock,
  XCircle,
  AlertTriangle,
  ShieldCheck,
  Navigation,
} from "lucide-react";
import type { ConfirmacionVisitaView } from "@/lib/confirmacion-visita/reglas";

interface Props {
  confirmacion?: ConfirmacionVisitaView | null;
  compact?: boolean;
}

export function ConfirmacionVisitaBadge({ confirmacion, compact = false }: Props) {
  if (!confirmacion || confirmacion.estado === "HISTORICO_SIN_CONTROL") {
    return null;
  }

  const base = compact
    ? "inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap"
    : "inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap";

  if (confirmacion.enCaminoEn) {
    return (
      <span className={`${base} bg-indigo-100 text-indigo-800 border border-indigo-200`}>
        <Navigation className="w-3 h-3" />
        En camino
      </span>
    );
  }

  switch (confirmacion.estado) {
    case "CONFIRMADO":
      return (
        <span className={`${base} bg-emerald-100 text-emerald-800 border border-emerald-200`}>
          <CheckCircle2 className="w-3 h-3" />
          {confirmacion.estadoLabel}
        </span>
      );
    case "EXENTO":
      return (
        <span className={`${base} bg-slate-100 text-slate-700 border border-slate-200`}>
          <ShieldCheck className="w-3 h-3" />
          {confirmacion.estadoLabel}
        </span>
      );
    case "PENDIENTE_CONFIRMACION":
      return (
        <span className={`${base} bg-amber-100 text-amber-800 border border-amber-200`}>
          <Clock className="w-3 h-3" />
          {confirmacion.estadoLabel}
        </span>
      );
    case "SOLICITA_REPROGRAMACION":
      return (
        <span className={`${base} bg-orange-100 text-orange-800 border border-orange-200`}>
          <CalendarClock className="w-3 h-3" />
          {confirmacion.estadoLabel}
        </span>
      );
    case "NO_DISPONIBLE":
      return (
        <span className={`${base} bg-red-100 text-red-800 border border-red-200`}>
          <XCircle className="w-3 h-3" />
          {confirmacion.estadoLabel}
        </span>
      );
    case "SIN_RESPUESTA":
    case "EXPIRADO":
    case "INVALIDADO_CAMBIO_HORARIO":
    case "CANCELADO":
      return (
        <span className={`${base} bg-rose-100 text-rose-800 border border-rose-200`}>
          <AlertTriangle className="w-3 h-3" />
          {confirmacion.estadoLabel}
        </span>
      );
    default:
      return null;
  }
}
