"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { TecnicoPushOptIn } from "./TecnicoPushOptIn";

type Tarea = {
  id: string;
  codigo: string;
  prioridad: string;
  venceEn: string | null;
  fase: string;
};

type Nota = {
  id: string;
  titulo: string;
  cuerpo: string;
  leida: boolean;
  ticketId: string | null;
  createdAt: string;
};

export function TecnicoNotificacionesCampana() {
  const [abierto, setAbierto] = useState(false);
  const [noLeidas, setNoLeidas] = useState(0);
  const [vencidas, setVencidas] = useState<Tarea[]>([]);
  const [proximas, setProximas] = useState<Tarea[]>([]);
  const [notas, setNotas] = useState<Nota[]>([]);
  const [pushOk, setPushOk] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const res = await fetch("/api/tecnico/notificaciones", {
        cache: "no-store",
        credentials: "include",
      });
      if (!res.ok) return;
      const data = await res.json();
      setNoLeidas(data.noLeidas ?? 0);
      setVencidas(data.tareas?.vencidas ?? []);
      setProximas(data.tareas?.proximas ?? []);
      setNotas((data.notificaciones ?? []).filter((n: Nota) => !n.leida).slice(0, 8));
      setPushOk(!!data.config?.pushHabilitado);
    } catch {
      /* offline */
    }
  }, []);

  useEffect(() => {
    void cargar();
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void cargar();
    }, 30000);
    const onVis = () => {
      if (document.visibilityState === "visible") void cargar();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [cargar]);

  async function marcar(id: string) {
    await fetch("/api/tecnico/notificaciones", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id }),
    });
    void cargar();
  }

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="p-2 rounded-lg hover:bg-white/10 transition relative"
        aria-label="Notificaciones de órdenes"
        title="Notificaciones"
      >
        <Bell className="w-5 h-5" />
        {noLeidas > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[1.1rem] h-4 px-1 rounded-full bg-red-500 text-[10px] font-bold flex items-center justify-center">
            {noLeidas > 99 ? "99+" : noLeidas}
          </span>
        )}
      </button>
      {abierto && (
        <div className="absolute right-0 mt-2 w-[min(22rem,calc(100vw-2rem))] bg-white text-slate-900 rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden">
          <div className="px-3 py-2 border-b flex items-center justify-between">
            <p className="text-sm font-semibold">Órdenes</p>
            <Link
              href="/tecnico/notificaciones"
              className="text-xs text-infinity-700"
              onClick={() => setAbierto(false)}
            >
              Ver todas
            </Link>
          </div>
          <div className="max-h-80 overflow-y-auto p-2 space-y-2 text-sm">
            {vencidas.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-red-700 px-1">Vencidas</p>
                {vencidas.slice(0, 5).map((t) => (
                  <Link
                    key={t.id}
                    href={`/tecnico/orden/${t.id}`}
                    className="block rounded-lg bg-red-50 px-2 py-1.5 mt-1"
                    onClick={() => setAbierto(false)}
                  >
                    <span className="font-medium">{t.codigo}</span>
                    <span className="text-xs text-red-800 ml-2">{t.prioridad}</span>
                  </Link>
                ))}
              </div>
            )}
            {proximas.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-amber-700 px-1">Próximas</p>
                {proximas.slice(0, 5).map((t) => (
                  <Link
                    key={t.id}
                    href={`/tecnico/orden/${t.id}`}
                    className="block rounded-lg bg-amber-50 px-2 py-1.5 mt-1"
                    onClick={() => setAbierto(false)}
                  >
                    <span className="font-medium">{t.codigo}</span>
                  </Link>
                ))}
              </div>
            )}
            {notas.map((n) => (
              <div key={n.id} className="rounded-lg border px-2 py-1.5">
                <p className="font-medium">{n.titulo}</p>
                <p className="text-xs text-slate-600">{n.cuerpo}</p>
                <div className="flex gap-2 mt-1">
                  {n.ticketId && (
                    <Link
                      href={`/tecnico/orden/${n.ticketId}`}
                      className="text-xs text-infinity-700"
                      onClick={() => setAbierto(false)}
                    >
                      Abrir
                    </Link>
                  )}
                  <button
                    type="button"
                    className="text-xs text-slate-500"
                    onClick={() => void marcar(n.id)}
                  >
                    Marcar leída
                  </button>
                </div>
              </div>
            ))}
            {vencidas.length + proximas.length + notas.length === 0 && (
              <p className="text-xs text-slate-500 px-1 py-3">Sin alertas por ahora.</p>
            )}
          </div>
          {pushOk && (
            <div className="border-t px-3 py-2">
              <TecnicoPushOptIn />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
