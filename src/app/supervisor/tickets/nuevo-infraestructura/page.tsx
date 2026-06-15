"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle, Loader2, Server } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { TecnicoMultiSelect } from "@/components/TecnicoMultiSelect";
import { inputMayusculasClass } from "@/lib/mayusculas";
import { MOTIVO_INFRA_LABELS, MOTIVOS_INFRA, minTecnicosInfraestructura } from "@/lib/ticket-infraestructura";
import type { MotivoInfraestructura } from "@prisma/client";

interface Tecnico {
  id: string;
  nombre: string;
  estado: string;
}

export default function NuevoTicketInfraestructuraPage() {
  const router = useRouter();
  const [tecnicos, setTecnicos] = useState<Tecnico[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [exito, setExito] = useState("");

  const [form, setForm] = useState({
    motivoInfraestructura: "" as MotivoInfraestructura | "",
    nodoAfectado: "",
    zonaInfra: "",
    prioridad: "ALTA",
    descripcion: "",
    tecnicoIds: [] as string[],
    programadoEn: "",
  });

  useEffect(() => {
    fetch("/api/tecnicos")
      .then((r) => r.json())
      .then((d) => setTecnicos(d.tecnicos));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setExito("");

    const res = await fetch("/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo: "INFRAESTRUCTURA",
        ...form,
        motivoInfraestructura: form.motivoInfraestructura || undefined,
        programadoEn: form.programadoEn || null,
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || "Error al crear ticket");
      return;
    }

    setExito(`Ticket ${data.ticket.codigo} creado — ${form.tecnicoIds.length} técnicos asignados`);
    setTimeout(() => router.push("/supervisor"), 2000);
  }

  const minTecnicos = minTecnicosInfraestructura();

  return (
    <div className="min-h-dvh bg-slate-50">
      <AppHeader
        title="Infraestructura"
        subtitle="Cortes eléctricos, fibra, nodos y actualizaciones"
      />

      <main className="max-w-2xl mx-auto p-4 space-y-4">
        <Link
          href="/supervisor"
          className="inline-flex items-center gap-1 text-sm text-infinity-600 hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al panel
        </Link>

        <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 flex gap-3 text-sm text-violet-900">
          <Server className="w-6 h-6 shrink-0" />
          <p>
            Ticket interno de red. Requiere <strong>mínimo {minTecnicos} técnicos</strong>.
            Incluye cronómetro, materiales, fotos y cierre como un soporte normal.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 p-3 rounded-xl text-sm">{error}</div>
        )}
        {exito && (
          <div className="bg-emerald-50 text-emerald-700 p-3 rounded-xl text-sm flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            {exito}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <section className="bg-white rounded-xl border p-4 space-y-3">
            <h2 className="font-semibold">1. Incidente</h2>

            <div>
              <label className="text-xs text-slate-500">Tipo de incidente *</label>
              <select
                required
                value={form.motivoInfraestructura}
                onChange={(e) =>
                  setForm({
                    ...form,
                    motivoInfraestructura: e.target.value as MotivoInfraestructura,
                  })
                }
                className="w-full px-3 py-2 border rounded-lg text-sm mt-0.5"
              >
                <option value="">Seleccionar…</option>
                {MOTIVOS_INFRA.map((m) => (
                  <option key={m} value={m}>
                    {MOTIVO_INFRA_LABELS[m]}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500">Nodo afectado *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: NODO CENTRO, OLT-03"
                  value={form.nodoAfectado}
                  onChange={(e) =>
                    setForm({ ...form, nodoAfectado: e.target.value })
                  }
                  className={`w-full px-3 py-2 border rounded-lg text-sm mt-0.5 ${inputMayusculasClass}`}
                />
              </div>
              <div>
                <label className="text-xs text-slate-500">Zona / sector</label>
                <input
                  type="text"
                  placeholder="Ej: NORTE, URB. LA FLORESTA"
                  value={form.zonaInfra}
                  onChange={(e) =>
                    setForm({ ...form, zonaInfra: e.target.value })
                  }
                  className={`w-full px-3 py-2 border rounded-lg text-sm mt-0.5 ${inputMayusculasClass}`}
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-500">Descripción del trabajo *</label>
              <textarea
                required
                rows={4}
                placeholder="Detalle: tramo afectado, equipos involucrados, acciones requeridas…"
                value={form.descripcion}
                onChange={(e) =>
                  setForm({ ...form, descripcion: e.target.value })
                }
                className={`w-full px-3 py-2 border rounded-lg text-sm mt-0.5 resize-none ${inputMayusculasClass}`}
              />
            </div>

            <div>
              <label className="text-xs text-slate-500">Prioridad *</label>
              <select
                value={form.prioridad}
                onChange={(e) => setForm({ ...form, prioridad: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm mt-0.5"
              >
                <option value="ALTA">Alta (SLA 4h)</option>
                <option value="MEDIA">Media (SLA 8h)</option>
                <option value="BAJA">Baja (SLA 24h)</option>
              </select>
            </div>
          </section>

          <section className="bg-white rounded-xl border p-4 space-y-3">
            <h2 className="font-semibold">2. Equipo técnico</h2>

            <div>
              <label className="text-xs text-slate-500">Fecha y hora de intervención</label>
              <input
                type="datetime-local"
                value={form.programadoEn}
                onChange={(e) => setForm({ ...form, programadoEn: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm mt-0.5"
              />
            </div>

            <TecnicoMultiSelect
              label={`Técnicos asignados (mínimo ${minTecnicos}) *`}
              tecnicos={tecnicos}
              selected={form.tecnicoIds}
              onChange={(tecnicoIds) => setForm({ ...form, tecnicoIds })}
            />
            {form.tecnicoIds.length > 0 && form.tecnicoIds.length < minTecnicos && (
              <p className="text-xs text-amber-700">
                Seleccione al menos {minTecnicos} técnicos para este ticket.
              </p>
            )}
          </section>

          <button
            type="submit"
            disabled={loading || form.tecnicoIds.length < minTecnicos}
            className="w-full py-3 bg-violet-700 hover:bg-violet-800 text-white font-semibold rounded-xl disabled:opacity-50 transition"
          >
            {loading ? "Creando ticket…" : "Crear ticket de infraestructura"}
          </button>
        </form>
      </main>
    </div>
  );
}
