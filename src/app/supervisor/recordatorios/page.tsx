"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { formatDateTime } from "@/lib/utils";

type Item = {
  id: string;
  codigo: string;
  estado: string;
  prioridad: string;
  tecnicos: string;
  venceEn: string | null;
  fase: string;
  minutosVencida: number | null;
  ultimaActividad: string;
  necesitaIntervencion: boolean;
};

export default function SupervisorRecordatoriosPage() {
  const [tecnicoId, setTecnicoId] = useState("");
  const [fase, setFase] = useState("");
  const [prioridad, setPrioridad] = useState("");
  const [estado, setEstado] = useState("");
  const [periodo, setPeriodo] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [resumen, setResumen] = useState({ pendientes: 0, proximas: 0, vencidas: 0 });
  const [historial, setHistorial] = useState<
    Array<{
      id: string;
      tipo: string;
      titulo: string;
      codigoTicket: string | null;
      tecnico: string;
      createdAt: string;
      entregas: Array<{ canal: string; estado: string }>;
    }>
  >([]);
  const [tecnicos, setTecnicos] = useState<Array<{ id: string; nombre: string }>>([]);
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    const q = new URLSearchParams();
    if (tecnicoId) q.set("tecnicoId", tecnicoId);
    if (fase) q.set("fase", fase);
    if (prioridad) q.set("prioridad", prioridad);
    if (estado) q.set("estado", estado);
    if (periodo) q.set("periodo", periodo);
    const res = await fetch(`/api/supervisor/recordatorios?${q}`, { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "No se pudo cargar");
      return;
    }
    setItems(data.items ?? []);
    setResumen(data.resumen ?? { pendientes: 0, proximas: 0, vencidas: 0 });
    setHistorial(data.historial ?? []);
    setTecnicos(data.tecnicos ?? []);
    setError("");
  }, [tecnicoId, fase, prioridad, estado, periodo]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  return (
    <div className="min-h-dvh bg-slate-50">
      <AppHeader title="Recordatorios" subtitle="Órdenes por técnico" />
      <main className="max-w-6xl mx-auto p-4 space-y-4">
        {error && <p className="text-sm text-red-700">{error}</p>}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-white border p-3">
            <p className="text-xs text-slate-500">Pendientes</p>
            <p className="text-xl font-semibold">{resumen.pendientes}</p>
          </div>
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-3">
            <p className="text-xs text-amber-800">Próximas</p>
            <p className="text-xl font-semibold">{resumen.proximas}</p>
          </div>
          <div className="rounded-xl bg-red-50 border border-red-200 p-3">
            <p className="text-xs text-red-800">Vencidas</p>
            <p className="text-xl font-semibold">{resumen.vencidas}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <select className="border rounded-lg px-2 py-1 text-sm" value={tecnicoId} onChange={(e) => setTecnicoId(e.target.value)}>
            <option value="">Todos los técnicos</option>
            {tecnicos.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </select>
          <select className="border rounded-lg px-2 py-1 text-sm" value={fase} onChange={(e) => setFase(e.target.value)}>
            <option value="">Todas las fases</option>
            <option value="pendiente">Pendientes</option>
            <option value="proxima">Próximas</option>
            <option value="vencida">Vencidas</option>
            <option value="sin_limite">Sin fecha límite</option>
          </select>
          <select className="border rounded-lg px-2 py-1 text-sm" value={prioridad} onChange={(e) => setPrioridad(e.target.value)}>
            <option value="">Todas las prioridades</option>
            <option value="ALTA">Alta</option>
            <option value="MEDIA">Media</option>
            <option value="BAJA">Baja</option>
          </select>
          <select className="border rounded-lg px-2 py-1 text-sm" value={estado} onChange={(e) => setEstado(e.target.value)}>
            <option value="">Estados abiertos</option>
            <option value="PENDIENTE">Pendiente</option>
            <option value="LEIDO">Leído</option>
            <option value="EN_PROCESO">En proceso</option>
            <option value="FINALIZADO">Finalizado (en revisión)</option>
          </select>
          <select className="border rounded-lg px-2 py-1 text-sm" value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
            <option value="">Todo el período</option>
            <option value="24h">Últimas 24 h</option>
            <option value="7d">Últimos 7 días</option>
            <option value="30d">Últimos 30 días</option>
          </select>
        </div>
        <ul className="space-y-2">
          {items.map((t) => (
            <li key={t.id} className="rounded-xl border bg-white p-3">
              <div className="flex flex-wrap justify-between gap-2">
                <Link href={`/supervisor/tickets/${t.id}/editar`} className="font-semibold text-infinity-800">
                  {t.codigo}
                </Link>
                <span className="text-xs uppercase">{t.prioridad}</span>
              </div>
              <p className="text-sm text-slate-600">{t.tecnicos}</p>
              <p className="text-xs text-slate-500 mt-1">
                {t.venceEn ? `Límite ${formatDateTime(t.venceEn)}` : "Sin fecha límite"}
                {t.fase === "vencida" && t.minutosVencida != null ? ` · vencida hace ${t.minutosVencida} min` : ""}
                {` · última actividad ${formatDateTime(t.ultimaActividad)}`}
              </p>
              {t.necesitaIntervencion && (
                <p className="text-xs text-red-700 mt-1">Requiere reasignación o seguimiento.</p>
              )}
            </li>
          ))}
        </ul>
        <section>
          <h2 className="font-semibold mb-2">Historial de avisos</h2>
          <ul className="space-y-1 text-sm">
            {historial.map((h) => (
              <li key={h.id} className="border-b py-2">
                <span className="font-medium">{h.codigoTicket || "—"}</span> · {h.titulo} · {h.tecnico}
                <span className="text-xs text-slate-500">
                  {" "}
                  {h.entregas.map((e) => `${e.canal}:${e.estado}`).join(" ")}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
