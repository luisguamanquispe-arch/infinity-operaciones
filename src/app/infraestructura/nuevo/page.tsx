"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { inputMayusculasClass } from "@/lib/mayusculas";
import {
  IR_ESTADOS,
  IR_ESTADO_LABELS,
  IR_PRIORIDAD_LABELS,
  IR_TIPOS_TRABAJO,
  IR_TIPO_TRABAJO_LABELS,
} from "@/lib/infraestructura-red/labels";

type Catalogo = {
  tecnicos: { id: string; nombre: string }[];
  supervisores: { id: string; nombre: string }[];
};

type MaterialRow = { material: string; cantidad: string; unidad: string };

export default function NuevoIrReportePage() {
  const router = useRouter();
  const [catalogo, setCatalogo] = useState<Catalogo>({ tecnicos: [], supervisores: [] });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [materiales, setMateriales] = useState<MaterialRow[]>([
    { material: "", cantidad: "", unidad: "unidad" },
  ]);

  const [form, setForm] = useState({
    fecha: new Date().toISOString().slice(0, 10),
    horaInicio: "",
    horaFin: "",
    tecnicoId: "",
    supervisorUsuarioId: "",
    estado: "PENDIENTE",
    prioridad: "MEDIA",
    tipoTrabajo: "MANTENIMIENTO_CORRECTIVO",
    tipoTrabajoOtro: "",
    provincia: "TUNGURAHUA",
    canton: "AMBATO",
    parroquia: "",
    sector: "",
    direccion: "",
    lat: "",
    lng: "",
    descripcion: "",
    observaciones: "",
  });

  useEffect(() => {
    void fetch("/api/infraestructura/catalogo")
      .then((r) => r.json())
      .then((d) => {
        setCatalogo({ tecnicos: d.tecnicos || [], supervisores: d.supervisores || [] });
        if (d.tecnicos?.length === 1) {
          setForm((f) => ({ ...f, tecnicoId: d.tecnicos[0].id }));
        }
      })
      .catch(() => {});
  }, []);

  function setField(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const body = {
        ...form,
        fecha: form.fecha ? new Date(form.fecha + "T12:00:00").toISOString() : undefined,
        horaInicio: form.horaInicio
          ? new Date(`${form.fecha}T${form.horaInicio}:00`).toISOString()
          : null,
        horaFin: form.horaFin
          ? new Date(`${form.fecha}T${form.horaFin}:00`).toISOString()
          : null,
        lat: form.lat ? Number(form.lat) : null,
        lng: form.lng ? Number(form.lng) : null,
        supervisorUsuarioId: form.supervisorUsuarioId || null,
        materiales: materiales
          .filter((m) => m.material && m.cantidad)
          .map((m) => ({
            material: m.material,
            cantidad: Number(m.cantidad),
            unidad: m.unidad || "unidad",
          })),
      };
      const res = await fetch("/api/infraestructura/reportes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo crear");
      router.push(`/infraestructura/${data.reporte.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-dvh bg-slate-50">
      <AppHeader title="Nuevo reporte IR" subtitle="Infraestructura de Red" />
      <main className="max-w-3xl mx-auto p-4 space-y-4">
        <Link
          href="/infraestructura"
          className="inline-flex items-center gap-1 text-sm text-infinity-600 hover:underline"
        >
          <ArrowLeft className="w-4 h-4" /> Volver al listado
        </Link>

        {error && (
          <div className="bg-red-50 text-red-700 text-sm p-3 rounded-xl">{error}</div>
        )}

        <form onSubmit={submit} className="bg-white rounded-xl border p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-sm space-y-1">
              <span className="font-medium">Fecha</span>
              <input
                type="date"
                required
                value={form.fecha}
                onChange={(e) => setField("fecha", e.target.value)}
                className="w-full px-3 py-2 border rounded-xl"
              />
            </label>
            <label className="text-sm space-y-1">
              <span className="font-medium">Prioridad</span>
              <select
                value={form.prioridad}
                onChange={(e) => setField("prioridad", e.target.value)}
                className="w-full px-3 py-2 border rounded-xl"
              >
                {Object.entries(IR_PRIORIDAD_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm space-y-1">
              <span className="font-medium">Hora inicio</span>
              <input
                type="time"
                value={form.horaInicio}
                onChange={(e) => setField("horaInicio", e.target.value)}
                className="w-full px-3 py-2 border rounded-xl"
              />
            </label>
            <label className="text-sm space-y-1">
              <span className="font-medium">Hora fin</span>
              <input
                type="time"
                value={form.horaFin}
                onChange={(e) => setField("horaFin", e.target.value)}
                className="w-full px-3 py-2 border rounded-xl"
              />
            </label>
            <label className="text-sm space-y-1">
              <span className="font-medium">Estado</span>
              <select
                value={form.estado}
                onChange={(e) => setField("estado", e.target.value)}
                className="w-full px-3 py-2 border rounded-xl"
              >
                {IR_ESTADOS.map((e) => (
                  <option key={e} value={e}>
                    {IR_ESTADO_LABELS[e]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm space-y-1">
              <span className="font-medium">Tipo de trabajo</span>
              <select
                value={form.tipoTrabajo}
                onChange={(e) => setField("tipoTrabajo", e.target.value)}
                className="w-full px-3 py-2 border rounded-xl"
                required
              >
                {IR_TIPOS_TRABAJO.map((t) => (
                  <option key={t} value={t}>
                    {IR_TIPO_TRABAJO_LABELS[t]}
                  </option>
                ))}
              </select>
            </label>
            {form.tipoTrabajo === "OTRO" && (
              <label className="text-sm space-y-1 sm:col-span-2">
                <span className="font-medium">Especifique el trabajo</span>
                <input
                  value={form.tipoTrabajoOtro}
                  onChange={(e) => setField("tipoTrabajoOtro", e.target.value)}
                  className={`w-full px-3 py-2 border rounded-xl ${inputMayusculasClass}`}
                  required
                />
              </label>
            )}
            {catalogo.tecnicos.length > 0 && (
              <label className="text-sm space-y-1">
                <span className="font-medium">Técnico responsable</span>
                <select
                  value={form.tecnicoId}
                  onChange={(e) => setField("tecnicoId", e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl"
                  required
                >
                  <option value="">Seleccionar</option>
                  {catalogo.tecnicos.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nombre}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {catalogo.supervisores.length > 0 && (
              <label className="text-sm space-y-1">
                <span className="font-medium">Supervisor</span>
                <select
                  value={form.supervisorUsuarioId}
                  onChange={(e) => setField("supervisorUsuarioId", e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl"
                >
                  <option value="">—</option>
                  {catalogo.supervisores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          <fieldset className="space-y-3 border-t pt-4">
            <legend className="font-semibold text-sm">Ubicación</legend>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(
                [
                  ["provincia", "Provincia"],
                  ["canton", "Cantón"],
                  ["parroquia", "Parroquia"],
                  ["sector", "Sector"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="text-sm space-y-1">
                  <span className="font-medium">{label}</span>
                  <input
                    required
                    value={form[key]}
                    onChange={(e) => setField(key, e.target.value)}
                    className={`w-full px-3 py-2 border rounded-xl ${inputMayusculasClass}`}
                  />
                </label>
              ))}
              <label className="text-sm space-y-1 sm:col-span-3">
                <span className="font-medium">Dirección</span>
                <input
                  required
                  value={form.direccion}
                  onChange={(e) => setField("direccion", e.target.value)}
                  className={`w-full px-3 py-2 border rounded-xl ${inputMayusculasClass}`}
                />
              </label>
              <label className="text-sm space-y-1">
                <span className="font-medium">GPS lat (opc.)</span>
                <input
                  value={form.lat}
                  onChange={(e) => setField("lat", e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl"
                  inputMode="decimal"
                />
              </label>
              <label className="text-sm space-y-1">
                <span className="font-medium">GPS lng (opc.)</span>
                <input
                  value={form.lng}
                  onChange={(e) => setField("lng", e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl"
                  inputMode="decimal"
                />
              </label>
            </div>
          </fieldset>

          <label className="text-sm space-y-1 block">
            <span className="font-medium">Descripción del trabajo</span>
            <textarea
              required
              rows={4}
              value={form.descripcion}
              onChange={(e) => setField("descripcion", e.target.value)}
              className="w-full px-3 py-2 border rounded-xl"
              placeholder="Problema encontrado y trabajo realizado"
            />
          </label>

          <label className="text-sm space-y-1 block">
            <span className="font-medium">Observaciones</span>
            <textarea
              rows={2}
              value={form.observaciones}
              onChange={(e) => setField("observaciones", e.target.value)}
              className="w-full px-3 py-2 border rounded-xl"
            />
          </label>

          <fieldset className="space-y-2 border-t pt-4">
            <legend className="font-semibold text-sm">Materiales</legend>
            {materiales.map((m, i) => (
              <div key={i} className="flex gap-2">
                <input
                  placeholder="Material"
                  value={m.material}
                  onChange={(e) => {
                    const next = [...materiales];
                    next[i] = { ...next[i], material: e.target.value };
                    setMateriales(next);
                  }}
                  className={`flex-1 px-3 py-2 border rounded-xl text-sm ${inputMayusculasClass}`}
                />
                <input
                  type="number"
                  step="any"
                  min="0"
                  placeholder="Cant."
                  value={m.cantidad}
                  onChange={(e) => {
                    const next = [...materiales];
                    next[i] = { ...next[i], cantidad: e.target.value };
                    setMateriales(next);
                  }}
                  className="w-24 px-3 py-2 border rounded-xl text-sm"
                />
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setMateriales([...materiales, { material: "", cantidad: "", unidad: "unidad" }])
              }
              className="text-sm text-infinity-600"
            >
              + Agregar material
            </button>
          </fieldset>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 bg-infinity-600 hover:bg-infinity-700 text-white font-semibold rounded-xl disabled:opacity-50"
          >
            {saving ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Guardando…
              </span>
            ) : (
              "Crear reporte"
            )}
          </button>
        </form>
      </main>
    </div>
  );
}
