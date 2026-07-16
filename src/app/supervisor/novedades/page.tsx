"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarClock, Loader2, RefreshCw } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { TecnicoMultiSelect } from "@/components/TecnicoMultiSelect";
import { toDatetimeLocalValue } from "@/lib/calendario";
import { formatDateTime } from "@/lib/utils";

type NovedadItem = {
  id: string;
  tipoLabel: string;
  comentario: string | null;
  fechaSolicitada: string | null;
  programadoEnAnterior: string | null;
  createdAt: string;
  tecnico: string;
  ticket: {
    id: string;
    codigo: string;
    motivo: string | null;
    programadoEn: string | null;
    cliente: { nombre: string; telefono: string; sector: string; direccion: string };
    tecnicoIds: string[];
    tecnicos: string[];
  };
};

type Tecnico = { id: string; nombre: string; estado: string };

export default function SupervisorNovedadesPage() {
  const [items, setItems] = useState<NovedadItem[]>([]);
  const [tecnicos, setTecnicos] = useState<Tecnico[]>([]);
  const [loading, setLoading] = useState(true);
  const [procesando, setProcesando] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState<Record<string, { programadoEn: string; tecnicoIds: string[]; nota: string }>>({});

  async function cargar() {
    setLoading(true);
    const [resNov, resTec] = await Promise.all([
      fetch("/api/supervisor/novedades?estado=PENDIENTE"),
      fetch("/api/tecnicos"),
    ]);
    const dataNov = await resNov.json();
    const dataTec = await resTec.json();
    setItems(dataNov.items || []);
    setTecnicos(dataTec.tecnicos || []);
    const inicial: Record<string, { programadoEn: string; tecnicoIds: string[]; nota: string }> = {};
    for (const n of dataNov.items || []) {
      inicial[n.id] = {
        programadoEn: toDatetimeLocalValue(n.fechaSolicitada || n.programadoEnAnterior),
        tecnicoIds: n.ticket.tecnicoIds,
        nota: "",
      };
    }
    setForm(inicial);
    setLoading(false);
  }

  useEffect(() => {
    cargar();
    const t = setInterval(cargar, 30000);
    return () => clearInterval(t);
  }, []);

  async function reprogramar(novedadId: string) {
    const f = form[novedadId];
    if (!f?.programadoEn) {
      setError("Indique fecha y hora para reprogramar");
      return;
    }
    setProcesando(novedadId);
    setError("");
    const res = await fetch(`/api/supervisor/novedades/${novedadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accion: "REPROGRAMAR",
        programadoEn: f.programadoEn,
        tecnicoIds: f.tecnicoIds,
        notaSupervisor: f.nota || undefined,
      }),
    });
    const data = await res.json();
    setProcesando(null);
    if (!res.ok) {
      setError(data.error || "Error al reprogramar");
      return;
    }
    cargar();
  }

  async function descartar(novedadId: string) {
    if (!confirm("¿Descartar esta novedad sin reprogramar?")) return;
    setProcesando(novedadId);
    const res = await fetch(`/api/supervisor/novedades/${novedadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accion: "DESCARTAR", notaSupervisor: form[novedadId]?.nota }),
    });
    setProcesando(null);
    if (res.ok) cargar();
  }

  return (
    <div className="min-h-dvh bg-slate-50">
      <AppHeader title="Novedades de soporte" subtitle="Reagendamiento de visitas reportadas por técnicos" />

      <main className="max-w-4xl mx-auto p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/supervisor" className="inline-flex items-center gap-1 text-sm text-infinity-600 hover:underline">
            <ArrowLeft className="w-4 h-4" /> Panel supervisor
          </Link>
          <button
            type="button"
            onClick={() => cargar()}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border text-sm"
          >
            <RefreshCw className="w-4 h-4" /> Actualizar
          </button>
        </div>

        {error && <div className="bg-red-50 text-red-700 p-3 rounded-xl text-sm">{error}</div>}

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-infinity-600" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 text-slate-500 bg-white rounded-xl border">
            No hay novedades pendientes de revisión.
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((n) => (
              <article key={n.id} className="bg-white rounded-xl border p-4 space-y-3">
                <div className="flex flex-wrap justify-between gap-2">
                  <div>
                    <span className="text-xs font-mono text-infinity-600">{n.ticket.codigo}</span>
                    <h2 className="font-bold text-lg">{n.ticket.cliente.nombre}</h2>
                    <p className="text-sm text-slate-500">{n.ticket.cliente.telefono} · {n.ticket.cliente.sector}</p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-800 h-fit font-medium">
                    {n.tipoLabel}
                  </span>
                </div>

                <p className="text-sm"><span className="text-slate-500">Técnico:</span> {n.tecnico}</p>
                {n.comentario && <p className="text-sm bg-slate-50 rounded-lg p-2">{n.comentario}</p>}
                {n.programadoEnAnterior && (
                  <p className="text-sm flex items-center gap-1 text-slate-600">
                    <CalendarClock className="w-4 h-4" />
                    Visita anterior: {formatDateTime(n.programadoEnAnterior)}
                  </p>
                )}
                {n.fechaSolicitada && (
                  <p className="text-sm text-emerald-700 font-medium">
                    Cliente sugiere: {formatDateTime(n.fechaSolicitada)}
                  </p>
                )}

                <div className="border-t pt-3 space-y-3">
                  <div>
                    <label className="text-xs text-slate-500">Nueva fecha y hora de visita *</label>
                    <input
                      type="datetime-local"
                      value={form[n.id]?.programadoEn ?? ""}
                      onChange={(e) =>
                        setForm({ ...form, [n.id]: { ...form[n.id], programadoEn: e.target.value } })
                      }
                      className="w-full mt-0.5 px-3 py-2 border rounded-lg text-sm"
                    />
                  </div>

                  <TecnicoMultiSelect
                    label="Técnicos asignados"
                    tecnicos={tecnicos}
                    selected={form[n.id]?.tecnicoIds ?? []}
                    onChange={(tecnicoIds) =>
                      setForm({ ...form, [n.id]: { ...form[n.id], tecnicoIds } })
                    }
                  />

                  <input
                    type="text"
                    placeholder="Nota interna (opcional)"
                    value={form[n.id]?.nota ?? ""}
                    onChange={(e) =>
                      setForm({ ...form, [n.id]: { ...form[n.id], nota: e.target.value } })
                    }
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={procesando === n.id}
                      onClick={() => reprogramar(n.id)}
                      className="px-4 py-2 rounded-xl bg-infinity-600 text-white text-sm font-medium disabled:opacity-50"
                    >
                      {procesando === n.id ? "Procesando…" : "Reprogramar y notificar"}
                    </button>
                    <Link
                      href={`/supervisor/tickets/${n.ticket.id}/editar`}
                      className="px-4 py-2 rounded-xl border text-sm"
                    >
                      Ver ticket
                    </Link>
                    <button
                      type="button"
                      onClick={() => descartar(n.id)}
                      className="px-4 py-2 rounded-xl border border-red-200 text-red-700 text-sm"
                    >
                      Descartar
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
