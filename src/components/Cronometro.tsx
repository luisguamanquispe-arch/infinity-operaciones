"use client";

import { useState, useEffect, useCallback } from "react";
import { Play, Pause, Square } from "lucide-react";
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
  onUpdate: () => void;
}

function getGps(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ lat: -1.2491, lng: -78.6168 });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve({ lat: -1.2491, lng: -78.6168 }),
      { enableHighAccuracy: true, timeout: 5000 }
    );
  });
}

export function Cronometro({
  ticketId,
  cronometro,
  duracionInicial,
  onUpdate,
}: CronometroProps) {
  const [duracion, setDuracion] = useState(duracionInicial);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setDuracion(duracionInicial);
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
        body: JSON.stringify({ accion, ...gps }),
      });
      setLoading(false);
      onUpdate();
    },
    [ticketId, onUpdate]
  );

  const finalizado = !!cronometro?.fin;
  const activo = cronometro?.activo && !finalizado;
  const pausado = cronometro?.pausado;

  return (
    <div className="bg-white rounded-xl border p-4 space-y-4">
      <h3 className="font-semibold text-slate-800">Cronómetro de reparación</h3>

      <div className="text-center py-4">
        <p className="text-4xl font-mono font-bold text-infinity-700">
          {formatDuration(duracion)}
        </p>
        <p className="text-xs text-slate-400 mt-1">Tiempo transcurrido</p>
      </div>

      <div className="flex gap-2">
        {!activo && !finalizado && (
          <button
            onClick={() => ejecutar("iniciar")}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 disabled:opacity-50"
          >
            <Play className="w-4 h-4" />
            Iniciar trabajo
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
          <button
            onClick={() => ejecutar("reanudar")}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 disabled:opacity-50"
          >
            <Play className="w-4 h-4" />
            Reanudar
          </button>
        )}

        {finalizado && (
          <p className="flex-1 text-center text-emerald-600 font-medium py-3">
            ✅ Trabajo finalizado
          </p>
        )}
      </div>
    </div>
  );
}
