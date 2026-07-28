"use client";

import { cn } from "@/lib/utils";
import {
  FASE_SEMAFORO_LABELS,
  faseSemaforoTicket,
  luzSemaforoActiva,
  type FaseSemaforo,
} from "@/lib/ticket-semaforo";

interface TicketSemaforoProps {
  estado: string;
  /** compact = solo luces; default incluye etiqueta */
  size?: "sm" | "md";
  showLabel?: boolean;
  className?: string;
}

const LUCES: {
  key: "leido" | "en_proceso" | "terminado";
  title: string;
  on: string;
  off: string;
}[] = [
  {
    key: "leido",
    title: "Leído",
    on: "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.85)] ring-2 ring-amber-200",
    off: "bg-amber-100/80",
  },
  {
    key: "en_proceso",
    title: "En proceso",
    on: "bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.85)] ring-2 ring-sky-200",
    off: "bg-sky-100/80",
  },
  {
    key: "terminado",
    title: "Terminado",
    on: "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.85)] ring-2 ring-emerald-200",
    off: "bg-emerald-100/80",
  },
];

/**
 * Semáforo de 3 luces: leído · en proceso · terminado.
 * PENDIENTE = leído parpadeando (por leer); LEIDO = leído fijo.
 */
export function TicketSemaforo({
  estado,
  size = "sm",
  showLabel = true,
  className,
}: TicketSemaforoProps) {
  const fase: FaseSemaforo = faseSemaforoTicket(estado);
  const activa = luzSemaforoActiva(fase);
  const porLeer = fase === "por_leer";
  const dot = size === "md" ? "w-3.5 h-3.5" : "w-2.5 h-2.5";

  return (
    <div className={cn("inline-flex items-center gap-2", className)} title={FASE_SEMAFORO_LABELS[fase]}>
      <div
        className="inline-flex items-center gap-1 rounded-full bg-slate-800/90 px-1.5 py-1"
        role="img"
        aria-label={`Estado: ${FASE_SEMAFORO_LABELS[fase]}`}
      >
        {LUCES.map((luz) => {
          const encendida = activa === luz.key;
          const parpadeo = porLeer && luz.key === "leido";
          return (
            <span
              key={luz.key}
              title={luz.title}
              className={cn(
                "rounded-full transition-colors",
                dot,
                encendida ? luz.on : luz.off,
                parpadeo && "animate-pulse"
              )}
            />
          );
        })}
      </div>
      {showLabel && (
        <span
          className={cn(
            "text-xs font-medium",
            fase === "por_leer" && "text-amber-700",
            fase === "leido" && "text-amber-800",
            fase === "en_proceso" && "text-sky-800",
            fase === "terminado" && "text-emerald-800",
            fase === "cancelado" && "text-slate-500"
          )}
        >
          {FASE_SEMAFORO_LABELS[fase]}
        </span>
      )}
    </div>
  );
}
