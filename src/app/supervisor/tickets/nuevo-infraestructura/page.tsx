"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle, Loader2, Network } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { TecnicoMultiSelect } from "@/components/TecnicoMultiSelect";
import { inputMayusculasClass } from "@/lib/mayusculas";
import {
  SI_TIPOS_TRABAJO,
  SI_TIPO_TRABAJO_LABELS,
  minTecnicosInfraestructura,
} from "@/lib/ticket-infraestructura";
import type { SiTipoTrabajo } from "@prisma/client";

interface Tecnico {
  id: string;
  nombre: string;
  estado: string;
}

export default function NuevoSoporteInfraestructuraPage() {
  const router = useRouter();
  const [tecnicos, setTecnicos] = useState<Tecnico[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [exito, setExito] = useState("");

  const [form, setForm] = useState({
    siTipoTrabajo: "" as SiTipoTrabajo | "",
    siTipoTrabajoOtro: "",
    prioridad: "ALTA",
    descripcion: "",
    provincia: "TUNGURAHUA",
    canton: "AMBATO",
    parroquia: "",
    sectorInfra: "",
    direccionInfra: "",
    referenciaInfra: "",
    nodoAfectado: "",
    latInfra: "",
    lngInfra: "",
    tecnicoIds: [] as string[],
    tecnicoResponsableId: "",
    programadoEn: "",
  });

  useEffect(() => {
    fetch("/api/tecnicos")
      .then((r) => r.json())
      .then((d) => setTecnicos(d.tecnicos || []));
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
        prioridad: form.prioridad,
        descripcion: form.descripcion,
        siTipoTrabajo: form.siTipoTrabajo || undefined,
        siTipoTrabajoOtro: form.siTipoTrabajoOtro || undefined,
        provincia: form.provincia,
        canton: form.canton,
        parroquia: form.parroquia,
        sectorInfra: form.sectorInfra,
        direccionInfra: form.direccionInfra,
        referenciaInfra: form.referenciaInfra || undefined,
        nodoAfectado: form.nodoAfectado || form.direccionInfra,
        zonaInfra: form.sectorInfra,
        latInfra: form.latInfra ? Number(form.latInfra) : null,
        lngInfra: form.lngInfra ? Number(form.lngInfra) : null,
        tecnicoIds: form.tecnicoIds,
        tecnicoResponsableId: form.tecnicoResponsableId || form.tecnicoIds[0],
        programadoEn: form.programadoEn || null,
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || "Error al crear la orden");
      return;
    }

    setExito(`Soporte ${data.ticket.codigo} creado — asignado a ${form.tecnicoIds.length} técnico(s)`);
    setTimeout(() => router.push("/supervisor/soporte-infraestructura"), 1500);
  }

  const minTecnicos = minTecnicosInfraestructura();

  return (
    <div className="min-h-dvh bg-slate-50">
      <AppHeader
        title="Nuevo Soporte"
        subtitle="Soporte de Infraestructura · orden de trabajo en red"
      />

      <main className="max-w-2xl mx-auto p-4 space-y-4 pb-16">
        <Link
          href="/supervisor/soporte-infraestructura"
          className="inline-flex items-center gap-1 text-sm text-infinity-600 hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a soportes
        </Link>

        <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 flex gap-3 text-sm text-violet-900">
          <Network className="w-6 h-6 shrink-0" />
          <p>
            Cree una <strong>orden de soporte</strong> (no un reporte). El PDF se genera solo
            cuando el <strong>Técnico Responsable</strong> finalice el trabajo.
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
            <h2 className="font-semibold">1. Trabajo solicitado</h2>

            <div>
              <label className="text-xs text-slate-500">Tipo de trabajo *</label>
              <select
                required
                value={form.siTipoTrabajo}
                onChange={(e) =>
                  setForm({ ...form, siTipoTrabajo: e.target.value as SiTipoTrabajo })
                }
                className="w-full px-3 py-2 border rounded-lg text-sm mt-0.5"
              >
                <option value="">Seleccionar…</option>
                {SI_TIPOS_TRABAJO.map((t) => (
                  <option key={t} value={t}>
                    {SI_TIPO_TRABAJO_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>

            {form.siTipoTrabajo === "OTRO" && (
              <div>
                <label className="text-xs text-slate-500">Especifique *</label>
                <input
                  required
                  value={form.siTipoTrabajoOtro}
                  onChange={(e) => setForm({ ...form, siTipoTrabajoOtro: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg text-sm mt-0.5 ${inputMayusculasClass}`}
                />
              </div>
            )}

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

            <div>
              <label className="text-xs text-slate-500">Descripción del problema / trabajo *</label>
              <textarea
                required
                rows={4}
                value={form.descripcion}
                onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg text-sm mt-0.5 resize-none ${inputMayusculasClass}`}
                placeholder="Detalle el incidente y el trabajo solicitado…"
              />
            </div>
          </section>

          <section className="bg-white rounded-xl border p-4 space-y-3">
            <h2 className="font-semibold">2. Ubicación</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(
                [
                  ["provincia", "Provincia"],
                  ["canton", "Cantón"],
                  ["parroquia", "Parroquia"],
                  ["sectorInfra", "Sector"],
                ] as const
              ).map(([k, label]) => (
                <div key={k}>
                  <label className="text-xs text-slate-500">{label} *</label>
                  <input
                    required
                    value={form[k]}
                    onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg text-sm mt-0.5 ${inputMayusculasClass}`}
                  />
                </div>
              ))}
              <div className="sm:col-span-2">
                <label className="text-xs text-slate-500">Dirección *</label>
                <input
                  required
                  value={form.direccionInfra}
                  onChange={(e) => setForm({ ...form, direccionInfra: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg text-sm mt-0.5 ${inputMayusculasClass}`}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-slate-500">Referencia</label>
                <input
                  value={form.referenciaInfra}
                  onChange={(e) => setForm({ ...form, referenciaInfra: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg text-sm mt-0.5 ${inputMayusculasClass}`}
                />
              </div>
              <div>
                <label className="text-xs text-slate-500">Nodo (opcional)</label>
                <input
                  value={form.nodoAfectado}
                  onChange={(e) => setForm({ ...form, nodoAfectado: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg text-sm mt-0.5 ${inputMayusculasClass}`}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-500">Lat GPS</label>
                  <input
                    value={form.latInfra}
                    onChange={(e) => setForm({ ...form, latInfra: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm mt-0.5"
                    inputMode="decimal"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500">Lng GPS</label>
                  <input
                    value={form.lngInfra}
                    onChange={(e) => setForm({ ...form, lngInfra: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm mt-0.5"
                    inputMode="decimal"
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="bg-white rounded-xl border p-4 space-y-3">
            <h2 className="font-semibold">3. Asignación de técnicos</h2>

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
              onChange={(tecnicoIds) => {
                const responsable =
                  form.tecnicoResponsableId && tecnicoIds.includes(form.tecnicoResponsableId)
                    ? form.tecnicoResponsableId
                    : tecnicoIds[0] || "";
                setForm({ ...form, tecnicoIds, tecnicoResponsableId: responsable });
              }}
            />

            {form.tecnicoIds.length > 0 && (
              <div>
                <label className="text-xs text-slate-500">Técnico responsable *</label>
                <select
                  required
                  value={form.tecnicoResponsableId}
                  onChange={(e) =>
                    setForm({ ...form, tecnicoResponsableId: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-lg text-sm mt-0.5"
                >
                  {form.tecnicoIds.map((id) => {
                    const t = tecnicos.find((x) => x.id === id);
                    return (
                      <option key={id} value={id}>
                        {t?.nombre || id}
                      </option>
                    );
                  })}
                </select>
                <p className="text-xs text-slate-500 mt-1">
                  Solo este técnico podrá finalizar la orden e informe final.
                </p>
              </div>
            )}
          </section>

          <button
            type="submit"
            disabled={loading || form.tecnicoIds.length < minTecnicos}
            className="w-full py-3 bg-violet-700 hover:bg-violet-800 text-white font-semibold rounded-xl disabled:opacity-50 transition inline-flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
            {loading ? "Creando soporte…" : "Crear Nuevo Soporte"}
          </button>
        </form>
      </main>
    </div>
  );
}
