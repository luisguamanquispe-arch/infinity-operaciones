"use client";

import { useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";

type Config = {
  activo: boolean;
  minutosAnticipacion: number;
  minutosRepeticion: number;
  maxRepeticiones: number;
  internoHabilitado: boolean;
  pushHabilitado: boolean;
  respetarHorario: boolean;
  horaInicio: number;
  horaFin: number;
};

export default function GerenciaRecordatoriosPage() {
  const [config, setConfig] = useState<Config | null>(null);
  const [pushServidor, setPushServidor] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/gerencia/recordatorios/config", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        setConfig(d.config);
        setPushServidor(!!d.pushServidor);
      })
      .catch(() => setMsg("No se pudo cargar la configuración"));
  }, []);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!config) return;
    const res = await fetch("/api/gerencia/recordatorios/config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error || "No se pudo guardar");
      return;
    }
    setConfig(data.config);
    setMsg("Guardado.");
  }

  if (!config) {
    return (
      <div className="min-h-dvh bg-slate-50">
        <AppHeader title="Recordatorios" subtitle="Configuración" />
        <p className="p-4 text-sm">{msg || "Cargando…"}</p>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-slate-50">
      <AppHeader title="Recordatorios" subtitle="Configuración administrativa" />
      <main className="max-w-xl mx-auto p-4">
        <p className="text-sm text-slate-600 mb-4">
          Zona horaria operativa: America/Guayaquil. Los avisos internos funcionan aunque el push esté
          apagado. {pushServidor ? "VAPID configurado." : "Faltan VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY para push."}
        </p>
        <form onSubmit={guardar} className="space-y-3 bg-white border rounded-xl p-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={config.activo}
              onChange={(e) => setConfig({ ...config, activo: e.target.checked })}
            />
            Recordatorios activos
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={config.internoHabilitado}
              onChange={(e) => setConfig({ ...config, internoHabilitado: e.target.checked })}
            />
            Campana interna
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={config.pushHabilitado}
              onChange={(e) => setConfig({ ...config, pushHabilitado: e.target.checked })}
            />
            Push del navegador
          </label>
          <label className="block text-sm">
            Minutos de anticipación
            <input
              type="number"
              className="border rounded-lg w-full px-2 py-1 mt-1"
              value={config.minutosAnticipacion}
              onChange={(e) => setConfig({ ...config, minutosAnticipacion: Number(e.target.value) })}
            />
          </label>
          <label className="block text-sm">
            Minutos entre repeticiones (vencidas)
            <input
              type="number"
              className="border rounded-lg w-full px-2 py-1 mt-1"
              value={config.minutosRepeticion}
              onChange={(e) => setConfig({ ...config, minutosRepeticion: Number(e.target.value) })}
            />
          </label>
          <label className="block text-sm">
            Máximo de repeticiones (0 = no repetir)
            <input
              type="number"
              className="border rounded-lg w-full px-2 py-1 mt-1"
              value={config.maxRepeticiones}
              onChange={(e) => setConfig({ ...config, maxRepeticiones: Number(e.target.value) })}
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={config.respetarHorario}
              onChange={(e) => setConfig({ ...config, respetarHorario: e.target.checked })}
            />
            Solo en horario operativo
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-sm">
              Hora inicio
              <input
                type="number"
                className="border rounded-lg w-full px-2 py-1 mt-1"
                value={config.horaInicio}
                onChange={(e) => setConfig({ ...config, horaInicio: Number(e.target.value) })}
              />
            </label>
            <label className="block text-sm">
              Hora fin
              <input
                type="number"
                className="border rounded-lg w-full px-2 py-1 mt-1"
                value={config.horaFin}
                onChange={(e) => setConfig({ ...config, horaFin: Number(e.target.value) })}
              />
            </label>
          </div>
          <button type="submit" className="px-3 py-1.5 rounded-lg bg-infinity-700 text-white text-sm">
            Guardar
          </button>
          {msg && <p className="text-sm text-slate-600">{msg}</p>}
        </form>
      </main>
    </div>
  );
}
