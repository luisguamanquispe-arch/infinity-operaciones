"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { TecnicoPushOptIn } from "@/components/tecnico/TecnicoPushOptIn";
import { formatDateTime } from "@/lib/utils";

type Filtro = "pendientes" | "proximas" | "vencidas" | "atendidas";

type Tarea = {
  id: string;
  codigo: string;
  estado: string;
  prioridad: string;
  descripcion: string | null;
  venceEn: string | null;
  minutosVencida: number | null;
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

export default function TecnicoNotificacionesPage() {
  const [filtro, setFiltro] = useState<Filtro>("pendientes");
  const [tareas, setTareas] = useState<{ pendientes: Tarea[]; proximas: Tarea[]; vencidas: Tarea[] }>({
    pendientes: [],
    proximas: [],
    vencidas: [],
  });
  const [notas, setNotas] = useState<Nota[]>([]);
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    const res = await fetch("/api/tecnico/notificaciones", { cache: "no-store", credentials: "include" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "No se pudieron cargar las notificaciones");
      return;
    }
    setTareas(data.tareas);
    setNotas(data.notificaciones ?? []);
    setError("");
  }, []);

  useEffect(() => {
    void cargar();
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void cargar();
    }, 30000);
    return () => window.clearInterval(id);
  }, [cargar]);

  const lista =
    filtro === "pendientes"
      ? tareas.pendientes
      : filtro === "proximas"
        ? tareas.proximas
        : filtro === "vencidas"
          ? tareas.vencidas
          : [];
  const atendidas = notas.filter((n) => n.leida);

  async function marcar(id: string) {
    await fetch("/api/tecnico/notificaciones", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    void cargar();
  }

  return (
    <div className="min-h-dvh bg-slate-50">
      <AppHeader title="Notificaciones" subtitle="Órdenes asignadas" />
      <main className="max-w-3xl mx-auto p-4 space-y-4">
        <TecnicoPushOptIn />
        {error && <p className="text-sm text-red-700">{error}</p>}
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["pendientes", "Pendientes"],
              ["proximas", "Próximas"],
              ["vencidas", "Vencidas"],
              ["atendidas", "Atendidas"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFiltro(id)}
              className={`px-3 py-1.5 rounded-lg text-sm ${
                filtro === id ? "bg-infinity-700 text-white" : "bg-white border"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {filtro !== "atendidas" ? (
          <ul className="space-y-2">
            {lista.map((t) => (
              <li
                key={t.id}
                className={`rounded-xl border bg-white p-3 ${
                  t.fase === "vencida" ? "border-red-300" : t.fase === "proxima" ? "border-amber-300" : ""
                }`}
              >
                <div className="flex justify-between gap-2">
                  <Link href={`/tecnico/orden/${t.id}`} className="font-semibold text-infinity-800">
                    {t.codigo}
                  </Link>
                  <span className="text-xs uppercase">{t.prioridad}</span>
                </div>
                <p className="text-sm text-slate-600 mt-1">{t.descripcion || t.estado}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {t.venceEn ? `Límite: ${formatDateTime(t.venceEn)}` : "Sin fecha límite"}
                  {t.minutosVencida != null && t.fase === "vencida"
                    ? ` · vencida hace ${t.minutosVencida} min`
                    : ""}
                </p>
              </li>
            ))}
            {lista.length === 0 && <p className="text-sm text-slate-500">No hay órdenes en este filtro.</p>}
          </ul>
        ) : (
          <ul className="space-y-2">
            {atendidas.map((n) => (
              <li key={n.id} className="rounded-xl border bg-white p-3">
                <p className="font-medium">{n.titulo}</p>
                <p className="text-sm text-slate-600">{n.cuerpo}</p>
                {n.ticketId && (
                  <Link className="text-xs text-infinity-700" href={`/tecnico/orden/${n.ticketId}`}>
                    Abrir orden
                  </Link>
                )}
              </li>
            ))}
            {atendidas.length === 0 && <p className="text-sm text-slate-500">Sin notificaciones leídas.</p>}
          </ul>
        )}
        {filtro !== "atendidas" && notas.filter((n) => !n.leida).length > 0 && (
          <section>
            <h2 className="text-sm font-semibold mb-2">Avisos no leídos</h2>
            <ul className="space-y-2">
              {notas
                .filter((n) => !n.leida)
                .map((n) => (
                  <li key={n.id} className="rounded-xl border bg-white p-3 flex justify-between gap-2">
                    <div>
                      <p className="font-medium">{n.titulo}</p>
                      <p className="text-sm text-slate-600">{n.cuerpo}</p>
                      {n.ticketId && (
                        <Link className="text-xs text-infinity-700" href={`/tecnico/orden/${n.ticketId}`}>
                          Abrir orden
                        </Link>
                      )}
                    </div>
                    <button type="button" className="text-xs text-slate-500" onClick={() => void marcar(n.id)}>
                      Leída
                    </button>
                  </li>
                ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
