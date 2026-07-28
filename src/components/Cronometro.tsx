"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Pause, Square, Play } from "lucide-react";
import { formatDuration } from "@/lib/utils";

interface CronometroProps {
  ticketId: string;
  cronometro: {
    inicio: string | null;
    fin: string | null;
    activo: boolean;
    pausado: boolean;
  } | null;
  duracionInicial: number;
  onUpdate?: () => void;
  readOnly?: boolean;
}

function getGps(): Promise<{ lat: number; lng: number } | null> {
  return import("@/lib/gps-client").then((m) => m.leerGpsActual({ timeoutMs: 5000 }));
}

export function Cronometro({
  ticketId,
  cronometro,
  duracionInicial,
  onUpdate,
  readOnly = false,
}: CronometroProps) {
  const [duracion, setDuracion] = useState(duracionInicial);
  const [loading, setLoading] = useState(false);

  // Sincronizar solo si hay desfase notable (evita parpadeo en refrescos silenciosos).
  useEffect(() => {
    setDuracion((prev) =>
      Math.abs(prev - duracionInicial) > 2 ? duracionInicial : prev
    );
  }, [duracionInicial]);

  useEffect(() => {
    if (!cronometro?.activo || cronometro.pausado || cronometro.fin) return;

    const interval = setInterval(() => {
      setDuracion((d) => d + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [cronometro?.activo, cronometro?.pausado, cronometro?.fin]);

  const ejecutar = useCallback(
    async (accion: string) => {
      setLoading(true);
      const gps = await getGps();
      await fetch(`/api/tickets/${ticketId}/cronometro`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accion,
          ...(gps ? { lat: gps.lat, lng: gps.lng } : {}),
        }),
      });
      setLoading(false);
      onUpdate?.();
    },
    [ticketId, onUpdate]
  );

  const finalizado = !!cronometro?.fin;
  const activo = cronometro?.activo && !finalizado;
  const pausado = cronometro?.pausado;
  const pendienteInicio = !finalizado && !cronometro?.inicio;

  return (
    <div className="bg-white rounded-xl border p-4 space-y-4">
      <div>
        <h3 className="font-semibold text-slate-800">Cronómetro de reparación</h3>
        <p className="text-xs text-slate-500 mt-1">
          {readOnly
            ? "Tiempo registrado por el técnico que reportó el ticket"
            : pendienteInicio
              ? "Iniciando registro de tiempo…"
              : finalizado
                ? "Tiempo efectivo registrado para este soporte"
                : "Contando desde que abrió el ticket"}
        </p>
      </div>

      <div className="text-center py-4">
        <p className="text-4xl font-mono font-bold text-infinity-700">
          {formatDuration(duracion)}
        </p>
        <p className="text-xs text-slate-400 mt-1">Tiempo efectivo</p>
      </div>

      <div className="flex gap-2">
        {readOnly ? (
          <p className="flex-1 text-center text-slate-600 font-medium py-3">
            {cronometro?.inicio
              ? `Tiempo compartido: ${formatDuration(duracion)}`
              : "Aún no hay tiempo registrado"}
          </p>
        ) : (
          <>
            {pendienteInicio && (
              <button
                onClick={() => ejecutar("iniciar")}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 disabled:opacity-50"
              >
                <Play className="w-4 h-4" />
                {loading ? "Iniciando…" : "Iniciar manualmente"}
              </button>
            )}

            {activo && !pausado && (
              <>
                <button
                  onClick={() => ejecutar("pausar")}
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-amber-500 text-white rounded-xl font-medium hover:bg-amber-600 disabled:opacity-50"
                >
                  <Pause className="w-4 h-4" />
                  Pausar
                </button>
                <button
                  onClick={() => ejecutar("finalizar")}
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-infinity-600 text-white rounded-xl font-medium hover:bg-infinity-700 disabled:opacity-50"
                >
                  <Square className="w-4 h-4" />
                  Finalizar
                </button>
              </>
            )}

            {activo && pausado && (
              <>
                <button
                  onClick={() => ejecutar("reanudar")}
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 disabled:opacity-50"
                >
                  <Play className="w-4 h-4" />
                  Reanudar
                </button>
                <button
                  onClick={() => ejecutar("finalizar")}
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-infinity-600 text-white rounded-xl font-medium hover:bg-infinity-700 disabled:opacity-50"
                >
                  <Square className="w-4 h-4" />
                  Finalizar
                </button>
              </>
            )}

            {finalizado && (
              <p className="flex-1 text-center text-emerald-600 font-medium py-3">
                Trabajo finalizado — {formatDuration(duracion)}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
