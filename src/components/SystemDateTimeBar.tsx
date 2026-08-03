"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Clock } from "lucide-react";

const TZ = "America/Guayaquil";

type Parts = {
  weekday: string;
  dateLong: string;
  dateShort: string;
  time: string;
  seconds: string;
};

function leerReloj(now = new Date()): Parts {
  const weekday = new Intl.DateTimeFormat("es-EC", {
    timeZone: TZ,
    weekday: "long",
  }).format(now);

  const dateLong = new Intl.DateTimeFormat("es-EC", {
    timeZone: TZ,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(now);

  const dateShort = new Intl.DateTimeFormat("es-EC", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(now);

  const time = new Intl.DateTimeFormat("es-EC", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);

  const seconds = new Intl.DateTimeFormat("es-EC", {
    timeZone: TZ,
    second: "2-digit",
  }).format(now);

  return {
    weekday: weekday.charAt(0).toUpperCase() + weekday.slice(1),
    dateLong,
    dateShort,
    time,
    seconds,
  };
}

type Props = {
  /** compact = franja bajo el header; card = bloque en el dashboard */
  variant?: "compact" | "card";
  className?: string;
};

/**
 * Fecha y hora del sistema en zona Ecuador (America/Guayaquil).
 * Se actualiza cada segundo.
 */
export function SystemDateTimeBar({ variant = "card", className = "" }: Props) {
  const [parts, setParts] = useState<Parts | null>(null);

  useEffect(() => {
    setParts(leerReloj());
    const id = window.setInterval(() => setParts(leerReloj()), 1000);
    return () => window.clearInterval(id);
  }, []);

  if (!parts) {
    return (
      <div
        className={`animate-pulse rounded-xl bg-slate-100 h-14 ${className}`}
        aria-hidden
      />
    );
  }

  if (variant === "compact") {
    return (
      <div
        className={`flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm text-slate-600 ${className}`}
        role="status"
        aria-live="polite"
        aria-label="Fecha y hora del sistema"
      >
        <span className="inline-flex items-center gap-1.5 font-medium text-slate-800">
          <CalendarDays className="w-3.5 h-3.5 text-infinity-600 shrink-0" />
          {parts.weekday}, {parts.dateLong}
        </span>
        <span className="inline-flex items-center gap-1.5 tabular-nums font-semibold text-infinity-800">
          <Clock className="w-3.5 h-3.5 text-infinity-600 shrink-0" />
          {parts.time}
          <span className="text-slate-400 font-normal">:{parts.seconds}</span>
          <span className="text-[10px] sm:text-xs font-normal text-slate-500 ml-1">
            Ecuador (UTC−5)
          </span>
        </span>
      </div>
    );
  }

  return (
    <section
      className={`bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm ${className}`}
      role="status"
      aria-live="polite"
      aria-label="Fecha y hora del sistema"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="rounded-lg bg-infinity-50 text-infinity-700 p-2 shrink-0">
            <CalendarDays className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Fecha del sistema
            </p>
            <p className="text-base sm:text-lg font-semibold text-slate-900 capitalize leading-tight">
              {parts.weekday}
            </p>
            <p className="text-sm text-slate-600">{parts.dateLong}</p>
            <p className="text-xs text-slate-400 mt-0.5 tabular-nums">
              {parts.dateShort}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:text-right border-t sm:border-t-0 sm:border-l border-slate-100 pt-3 sm:pt-0 sm:pl-4">
          <div className="rounded-lg bg-slate-50 text-slate-700 p-2 shrink-0 sm:hidden">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Hora actual
            </p>
            <p className="text-2xl sm:text-3xl font-bold tabular-nums text-infinity-800 tracking-tight leading-none">
              {parts.time}
              <span className="text-lg text-slate-400 font-semibold">
                :{parts.seconds}
              </span>
            </p>
            <p className="text-xs text-slate-500 mt-1">Ecuador · UTC−5</p>
          </div>
        </div>
      </div>
    </section>
  );
}
