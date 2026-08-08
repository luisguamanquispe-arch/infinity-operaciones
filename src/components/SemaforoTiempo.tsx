"use client";

import { cn } from "@/lib/utils";
import {
  FASE_SEMAFORO_TIEMPO_LABELS,
  type FaseSemaforoTiempo,
} from "@/lib/ticket-antiguedad";

interface SemaforoTiempoProps {
  fase: FaseSemaforoTiempo;
  dias?: number;
  size?: "sm" | "md";
  showLabel?: boolean;
  className?: string;
}

const ESTILOS: Record<
  FaseSemaforoTiempo,
  { dot: string; text: string; ring: string }
> = {
  verde: {
    dot: "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]",
    text: "text-emerald-800",
    ring: "bg-emerald-50 border-emerald-200",
  },
  amarillo: {
    dot: "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.7)]",
    text: "text-amber-900",
    ring: "bg-amber-50 border-amber-200",
  },
  rojo: {
    dot: "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.7)]",
    text: "text-red-800",
    ring: "bg-red-50 border-red-200",
  },
};

/**
 * Semáforo de tiempo de atención (0–2 verde, 2–4 amarillo, +4 rojo).
 */
export function SemaforoTiempo({
  fase,
  dias,
  size = "sm",
  showLabel = true,
  className,
}: SemaforoTiempoProps) {
  const estilo = ESTILOS[fase];
  const dot = size === "md" ? "w-3.5 h-3.5" : "w-2.5 h-2.5";
  const diasTxt =
    dias != null
      ? `${dias < 1 ? dias.toFixed(1) : Math.floor(dias)}d`
      : null;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5",
        estilo.ring,
        className
      )}
      title={FASE_SEMAFORO_TIEMPO_LABELS[fase]}
      role="img"
      aria-label={FASE_SEMAFORO_TIEMPO_LABELS[fase]}
    >
      <span className={cn("rounded-full shrink-0", dot, estilo.dot)} />
      {showLabel && (
        <span className={cn("text-xs font-medium", estilo.text)}>
          {diasTxt ? `${diasTxt}` : fase === "rojo" ? "Vencido" : fase === "amarillo" ? "Por vencer" : "OK"}
        </span>
      )}
    </div>
  );
}
