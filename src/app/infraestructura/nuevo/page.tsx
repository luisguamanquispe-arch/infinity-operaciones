"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Plus, Trash2 } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { inputMayusculasClass } from "@/lib/mayusculas";
import {
  IR_EQUIPO_LABELS,
  IR_EQUIPOS,
  IR_ESTADO_LABELS,
  IR_ESTADOS,
  IR_PRIORIDAD_LABELS,
  IR_RESULTADO_LABELS,
  IR_RESULTADOS,
  IR_TIPOS_TRABAJO,
  IR_TIPO_TRABAJO_LABELS,
  formatoTiempoMinutos,
} from "@/lib/infraestructura-red/labels";

type Catalogo = {
  tecnicos: { id: string; nombre: string }[];
  supervisores: { id: string; nombre: string }[];
  inventario: { id: string; nombre: string; unidad: string; stock: number }[];
};

type MaterialRow = {
  material: string;
  cantidad: string;
  unidad: string;
  inventarioId: string;
};

type ClienteHit = { id: string; nombre: string; cedula: string; sector: string };

function minutosEntre(fecha: string, inicio: string, fin: string): number | null {
  if (!fecha || !inicio || !fin) return null;
  const a = new Date(`${fecha}T${inicio}:00`);
  const b = new Date(`${fecha}T${fin}:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || b < a) return null;
  return Math.round((b.getTime() - a.getTime()) / 60000);
}

export default function NuevoIrReportePage() {
  const router = useRouter();
  const [catalogo, setCatalogo] = useState<Catalogo>({
    tecnicos: [],
    supervisores: [],
    inventario: [],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [materiales, setMateriales] = useState<MaterialRow[]>([
    { material: "", cantidad: "", unidad: "unidad", inventarioId: "" },
  ]);
  const [equiposSel, setEquiposSel] = useState<string[]>([]);
  const [participantesIds, setParticipantesIds] = useState<string[]>([]);
  const [clientesSel, setClientesSel] = useState<ClienteHit[]>([]);
  const [clienteQ, setClienteQ] = useState("");
  const [clienteHits, setClienteHits] = useState<ClienteHit[]>([]);

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
    nodo: "",
    nap: "",
    cto: "",
    odf: "",
    splitter: "",
    manga: "",
    cajaPaso: "",
    tramoFibra: "",
    cantidadHilos: "",
    longitudAfectadaM: "",
    kmRedIntervenida: "",
    clientesAfectadosN: "",
    descripcion: "",
    trabajosRealizados: "",
    resultado: "",
    observaciones: "",
  });

  const tiempoAuto = useMemo(
    () => minutosEntre(form.fecha, form.horaInicio, form.horaFin),
    [form.fecha, form.horaInicio, form.horaFin]
  );

  useEffect(() => {
    void fetch("/api/infraestructura/catalogo")
      .then((r) => r.json())
      .then((d) => {
        setCatalogo({
          tecnicos: d.tecnicos || [],
          supervisores: d.supervisores || [],
          inventario: d.inventario || [],
        });
        if (d.tecnicos?.length === 1) {
          setForm((f) => ({ ...f, tecnicoId: d.tecnicos[0].id }));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (clienteQ.trim().length < 2) {
      setClienteHits([]);
      return;
    }
    const t = setTimeout(() => {
      void fetch(`/api/infraestructura/clientes?q=${encodeURIComponent(clienteQ.trim())}`)
        .then((r) => r.json())
        .then((d) => setClienteHits(d.clientes || []))
        .catch(() => setClienteHits([]));
    }, 300);
    return () => clearTimeout(t);
  }, [clienteQ]);

  function setField(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleEquipo(tipo: string) {
    setEquiposSel((prev) =>
      prev.includes(tipo) ? prev.filter((t) => t !== tipo) : [...prev, tipo]
    );
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
        cantidadHilos: form.cantidadHilos ? Number(form.cantidadHilos) : null,
        longitudAfectadaM: form.longitudAfectadaM ? Number(form.longitudAfectadaM) : null,
        kmRedIntervenida: form.kmRedIntervenida ? Number(form.kmRedIntervenida) : null,
        clientesAfectadosN: clientesSel.length || (form.clientesAfectadosN ? Number(form.clientesAfectadosN) : 0),
        resultado: form.resultado || null,
        supervisorUsuarioId: form.supervisorUsuarioId || null,
        participantesIds,
        clientesAfectadosIds: clientesSel.map((c) => c.id),
        equipos: equiposSel.map((tipo) => ({ tipo })),
        materiales: materiales
          .filter((m) => m.material && m.cantidad)
          .map((m) => ({
            material: m.material,
            cantidad: Number(m.cantidad),
            unidad: m.unidad || "unidad",
            inventarioId: m.inventarioId || null,
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
      <AppHeader title="Nuevo reporte" subtitle="Infraestructura de Red" />
      <main className="max-w-3xl mx-auto p-4 space-y-4 pb-16">
        <Link
          href="/infraestructura"
          className="inline-flex items-center gap-1 text-sm text-infinity-600 hover:underline"
        >
          <ArrowLeft className="w-4 h-4" /> Volver
        </Link>

        {error && (
          <div className="bg-red-50 text-red-700 text-sm p-3 rounded-xl">{error}</div>
        )}

        <form onSubmit={submit} className="space-y-4">
          <section className="bg-white rounded-xl border p-4 space-y-3">
            <h2 className="font-semibold text-slate-800">Información general</h2>
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
              <div className="text-sm sm:col-span-2">
                <span className="font-medium">Tiempo empleado</span>
                <p className="text-slate-600 mt-1">{formatoTiempoMinutos(tiempoAuto)} (automático)</p>
              </div>
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
                <span className="font-medium">Resultado</span>
                <select
                  value={form.resultado}
                  onChange={(e) => setField("resultado", e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl"
                >
                  <option value="">—</option>
                  {IR_RESULTADOS.map((r) => (
                    <option key={r} value={r}>
                      {IR_RESULTADO_LABELS[r]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm space-y-1 sm:col-span-2">
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
                  <span className="font-medium">Especifique</span>
                  <input
                    value={form.tipoTrabajoOtro}
                    onChange={(e) => setField("tipoTrabajoOtro", e.target.value)}
                    className={`w-full px-3 py-2 border rounded-xl ${inputMayusculasClass}`}
                  />
                </label>
              )}
              <label className="text-sm space-y-1">
                <span className="font-medium">Técnico responsable</span>
                <select
                  required
                  value={form.tecnicoId}
                  onChange={(e) => setField("tecnicoId", e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl"
                >
                  <option value="">Seleccione…</option>
                  {catalogo.tecnicos.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nombre}
                    </option>
                  ))}
                </select>
              </label>
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
            </div>

            <div className="text-sm space-y-2">
              <span className="font-medium">Técnicos participantes</span>
              <div className="flex flex-wrap gap-2">
                {catalogo.tecnicos
                  .filter((t) => t.id !== form.tecnicoId)
                  .map((t) => (
                    <label
                      key={t.id}
                      className="inline-flex items-center gap-1.5 text-xs border rounded-lg px-2 py-1"
                    >
                      <input
                        type="checkbox"
                        checked={participantesIds.includes(t.id)}
                        onChange={(e) =>
                          setParticipantesIds((prev) =>
                            e.target.checked
                              ? [...prev, t.id]
                              : prev.filter((id) => id !== t.id)
                          )
                        }
                      />
                      {t.nombre}
                    </label>
                  ))}
              </div>
            </div>
          </section>

          <section className="bg-white rounded-xl border p-4 space-y-3">
            <h2 className="font-semibold text-slate-800">Ubicación</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(
                [
                  ["provincia", "Provincia"],
                  ["canton", "Cantón"],
                  ["parroquia", "Parroquia"],
                  ["sector", "Sector"],
                ] as const
              ).map(([k, label]) => (
                <label key={k} className="text-sm space-y-1">
                  <span className="font-medium">{label}</span>
                  <input
                    required
                    value={form[k]}
                    onChange={(e) => setField(k, e.target.value)}
                    className={`w-full px-3 py-2 border rounded-xl ${inputMayusculasClass}`}
                  />
                </label>
              ))}
              <label className="text-sm space-y-1 sm:col-span-2">
                <span className="font-medium">Dirección</span>
                <input
                  required
                  value={form.direccion}
                  onChange={(e) => setField("direccion", e.target.value)}
                  className={`w-full px-3 py-2 border rounded-xl ${inputMayusculasClass}`}
                />
              </label>
              <label className="text-sm space-y-1">
                <span className="font-medium">Latitud (opcional)</span>
                <input
                  value={form.lat}
                  onChange={(e) => setField("lat", e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl"
                  inputMode="decimal"
                />
              </label>
              <label className="text-sm space-y-1">
                <span className="font-medium">Longitud (opcional)</span>
                <input
                  value={form.lng}
                  onChange={(e) => setField("lng", e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl"
                  inputMode="decimal"
                />
              </label>
            </div>
          </section>

          <section className="bg-white rounded-xl border p-4 space-y-3">
            <h2 className="font-semibold text-slate-800">Infraestructura afectada</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(
                [
                  ["nodo", "Nodo"],
                  ["nap", "NAP"],
                  ["cto", "CTO"],
                  ["odf", "ODF"],
                  ["splitter", "Splitter"],
                  ["manga", "Manga"],
                  ["cajaPaso", "Caja de paso"],
                  ["tramoFibra", "Tramo de fibra"],
                  ["cantidadHilos", "Cantidad de hilos"],
                  ["longitudAfectadaM", "Longitud afectada (m)"],
                  ["kmRedIntervenida", "Km de red intervenidos"],
                  ["clientesAfectadosN", "Nº clientes afectados (manual)"],
                ] as const
              ).map(([k, label]) => (
                <label key={k} className="text-sm space-y-1">
                  <span className="font-medium">{label}</span>
                  <input
                    value={form[k]}
                    onChange={(e) => setField(k, e.target.value)}
                    className={`w-full px-3 py-2 border rounded-xl ${
                      ["cantidadHilos", "longitudAfectadaM", "kmRedIntervenida", "clientesAfectadosN"].includes(
                        k
                      )
                        ? ""
                        : inputMayusculasClass
                    }`}
                    inputMode={
                      ["cantidadHilos", "longitudAfectadaM", "kmRedIntervenida", "clientesAfectadosN"].includes(
                        k
                      )
                        ? "decimal"
                        : undefined
                    }
                  />
                </label>
              ))}
            </div>
          </section>

          <section className="bg-white rounded-xl border p-4 space-y-3">
            <h2 className="font-semibold text-slate-800">Clientes afectados</h2>
            <input
              value={clienteQ}
              onChange={(e) => setClienteQ(e.target.value)}
              placeholder="Buscar por cédula, nombre o sector…"
              className="w-full px-3 py-2 border rounded-xl text-sm"
            />
            {clienteHits.length > 0 && (
              <ul className="border rounded-xl divide-y max-h-40 overflow-auto text-sm">
                {clienteHits.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2 hover:bg-slate-50"
                      onClick={() => {
                        setClientesSel((prev) =>
                          prev.some((x) => x.id === c.id) ? prev : [...prev, c]
                        );
                        setClienteQ("");
                        setClienteHits([]);
                      }}
                    >
                      {c.nombre} · {c.cedula} · {c.sector}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {clientesSel.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {clientesSel.map((c) => (
                  <span
                    key={c.id}
                    className="inline-flex items-center gap-1 text-xs bg-slate-100 rounded-lg px-2 py-1"
                  >
                    {c.nombre}
                    <button
                      type="button"
                      onClick={() => setClientesSel((prev) => prev.filter((x) => x.id !== c.id))}
                      className="text-red-600"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </section>

          <section className="bg-white rounded-xl border p-4 space-y-3">
            <h2 className="font-semibold text-slate-800">Descripción del problema</h2>
            <textarea
              required
              minLength={10}
              rows={4}
              value={form.descripcion}
              onChange={(e) => setField("descripcion", e.target.value)}
              className="w-full px-3 py-2 border rounded-xl text-sm"
              placeholder="Diagnóstico del incidente…"
            />
            <h2 className="font-semibold text-slate-800 pt-2">Trabajos realizados</h2>
            <textarea
              rows={4}
              value={form.trabajosRealizados}
              onChange={(e) => setField("trabajosRealizados", e.target.value)}
              className="w-full px-3 py-2 border rounded-xl text-sm"
              placeholder="Actividades ejecutadas…"
            />
            <h2 className="font-semibold text-slate-800 pt-2">Observaciones</h2>
            <textarea
              rows={3}
              value={form.observaciones}
              onChange={(e) => setField("observaciones", e.target.value)}
              className="w-full px-3 py-2 border rounded-xl text-sm"
            />
          </section>

          <section className="bg-white rounded-xl border p-4 space-y-3">
            <h2 className="font-semibold text-slate-800">Equipos utilizados</h2>
            <div className="flex flex-wrap gap-2">
              {IR_EQUIPOS.map((eq) => (
                <label
                  key={eq}
                  className="inline-flex items-center gap-1.5 text-xs border rounded-lg px-2 py-1.5"
                >
                  <input
                    type="checkbox"
                    checked={equiposSel.includes(eq)}
                    onChange={() => toggleEquipo(eq)}
                  />
                  {IR_EQUIPO_LABELS[eq]}
                </label>
              ))}
            </div>
          </section>

          <section className="bg-white rounded-xl border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-800">Materiales utilizados</h2>
              <button
                type="button"
                onClick={() =>
                  setMateriales((m) => [
                    ...m,
                    { material: "", cantidad: "", unidad: "unidad", inventarioId: "" },
                  ])
                }
                className="text-sm text-cyan-700 inline-flex items-center gap-1"
              >
                <Plus className="w-4 h-4" /> Agregar
              </button>
            </div>
            {materiales.map((m, idx) => (
              <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                <label className="text-sm sm:col-span-5 space-y-1">
                  <span className="font-medium">Inventario / material</span>
                  <select
                    value={m.inventarioId}
                    onChange={(e) => {
                      const inv = catalogo.inventario.find((i) => i.id === e.target.value);
                      setMateriales((rows) =>
                        rows.map((row, i) =>
                          i === idx
                            ? {
                                ...row,
                                inventarioId: e.target.value,
                                material: inv?.nombre || row.material,
                                unidad: inv?.unidad || row.unidad,
                              }
                            : row
                        )
                      );
                    }}
                    className="w-full px-3 py-2 border rounded-xl"
                  >
                    <option value="">Texto libre…</option>
                    {catalogo.inventario.map((inv) => (
                      <option key={inv.id} value={inv.id}>
                        {inv.nombre} (stock {inv.stock})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm sm:col-span-3 space-y-1">
                  <span className="font-medium">Nombre</span>
                  <input
                    value={m.material}
                    onChange={(e) =>
                      setMateriales((rows) =>
                        rows.map((row, i) =>
                          i === idx ? { ...row, material: e.target.value } : row
                        )
                      )
                    }
                    className={`w-full px-3 py-2 border rounded-xl ${inputMayusculasClass}`}
                  />
                </label>
                <label className="text-sm sm:col-span-2 space-y-1">
                  <span className="font-medium">Cant.</span>
                  <input
                    value={m.cantidad}
                    onChange={(e) =>
                      setMateriales((rows) =>
                        rows.map((row, i) =>
                          i === idx ? { ...row, cantidad: e.target.value } : row
                        )
                      )
                    }
                    className="w-full px-3 py-2 border rounded-xl"
                    inputMode="decimal"
                  />
                </label>
                <button
                  type="button"
                  className="sm:col-span-2 text-red-600 py-2 inline-flex justify-center"
                  onClick={() => setMateriales((rows) => rows.filter((_, i) => i !== idx))}
                  disabled={materiales.length === 1}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            <p className="text-xs text-slate-500">
              Al finalizar el reporte se descuenta stock de materiales vinculados a inventario.
            </p>
          </section>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 bg-cyan-700 hover:bg-cyan-800 disabled:opacity-60 text-white font-semibold rounded-xl inline-flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
            Guardar reporte
          </button>
        </form>
      </main>
    </div>
  );
}
