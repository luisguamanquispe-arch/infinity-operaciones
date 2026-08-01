"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileDown, Loader2, Pencil } from "lucide-react";
import SignaturePad from "signature_pad";
import { AppHeader } from "@/components/AppHeader";
import { fetchWithRetry } from "@/lib/compress-image";
import {
  IR_EQUIPO_LABELS,
  IR_ESTADO_LABELS,
  IR_ESTADOS,
  IR_PRIORIDAD_LABELS,
  IR_RESULTADO_LABELS,
  IR_TIPO_FOTO_LABELS,
  IR_TIPO_FIRMA_LABELS,
  IR_TIPO_TRABAJO_LABELS,
  IR_TIPOS_FOTO,
  formatoTiempoMinutos,
  type IrTipoFoto,
} from "@/lib/infraestructura-red/labels";

type Reporte = {
  id: string;
  codigo: string;
  fecha: string;
  horaInicio: string | null;
  horaFin: string | null;
  tiempoMinutos: number | null;
  estado: keyof typeof IR_ESTADO_LABELS;
  prioridad: keyof typeof IR_PRIORIDAD_LABELS;
  tipoTrabajo: keyof typeof IR_TIPO_TRABAJO_LABELS;
  tipoTrabajoOtro: string | null;
  resultado: keyof typeof IR_RESULTADO_LABELS | null;
  provincia: string;
  canton: string;
  parroquia: string;
  sector: string;
  direccion: string;
  lat: number | null;
  lng: number | null;
  nodo: string | null;
  nap: string | null;
  cto: string | null;
  odf: string | null;
  splitter: string | null;
  manga: string | null;
  cajaPaso: string | null;
  tramoFibra: string | null;
  cantidadHilos: number | null;
  longitudAfectadaM: number | null;
  kmRedIntervenida: number | null;
  clientesAfectadosN: number;
  descripcion: string;
  trabajosRealizados: string | null;
  observaciones: string | null;
  tecnico: { usuario: { nombre: string } };
  supervisor: { nombre: string } | null;
  materiales: { id: string; material: string; cantidad: number; unidad: string }[];
  equipos: { id: string; tipo: keyof typeof IR_EQUIPO_LABELS; detalle: string | null }[];
  participantes: { tecnico: { usuario: { nombre: string } } }[];
  clientesAfectados: {
    cliente: { id: string; nombre: string; cedula: string };
  }[];
  fotografias: { id: string; tipo: string; url: string; imagenData: string | null }[];
  firmas: { id: string; tipo: string; nombre: string; imagenData: string | null }[];
  historial: {
    id: string;
    fecha: string;
    usuarioNombre: string;
    estado: keyof typeof IR_ESTADO_LABELS;
    nota: string | null;
  }[];
};

function FirmaBox({
  reporteId,
  tipo,
  nombreDefault,
  existing,
  onSaved,
}: {
  reporteId: string;
  tipo: "TECNICO" | "SUPERVISOR";
  nombreDefault: string;
  existing: Reporte["firmas"][0] | undefined;
  onSaved: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePad | null>(null);
  const [nombre, setNombre] = useState(nombreDefault);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (existing || !canvasRef.current) return;
    const pad = new SignaturePad(canvasRef.current, {
      backgroundColor: "rgb(255,255,255)",
      penColor: "rgb(0,0,0)",
    });
    padRef.current = pad;
    const canvas = canvasRef.current;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    canvas.getContext("2d")?.scale(ratio, ratio);
    return () => {
      pad.off();
      padRef.current = null;
    };
  }, [existing]);

  async function guardar() {
    if (!padRef.current || padRef.current.isEmpty()) {
      setError("Firme en el área");
      return;
    }
    setLoading(true);
    setError("");
    const res = await fetchWithRetry(`/api/infraestructura/reportes/${reporteId}/firmas`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo,
        nombre,
        imagen: padRef.current.toDataURL("image/png"),
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error || "No se pudo guardar");
      return;
    }
    onSaved();
  }

  if (existing?.imagenData) {
    return (
      <div className="border rounded-xl p-3 space-y-2">
        <p className="text-sm font-medium">
          {IR_TIPO_FIRMA_LABELS[tipo]}: {existing.nombre}
        </p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={existing.imagenData} alt="Firma" className="max-h-24 border rounded bg-white" />
      </div>
    );
  }

  return (
    <div className="border rounded-xl p-3 space-y-2">
      <p className="text-sm font-medium">Firma {IR_TIPO_FIRMA_LABELS[tipo]}</p>
      <input
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        className="w-full px-3 py-2 border rounded-lg text-sm"
        placeholder="Nombre"
      />
      <canvas
        ref={canvasRef}
        className="w-full h-32 border border-dashed rounded-lg touch-none bg-white"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => padRef.current?.clear()}
          className="flex-1 py-2 border rounded-lg text-sm"
        >
          Limpiar
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => void guardar()}
          className="flex-1 py-2 bg-infinity-600 text-white rounded-lg text-sm disabled:opacity-50"
        >
          {loading ? "Guardando…" : "Guardar firma"}
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

export default function IrReporteDetallePage() {
  const params = useParams();
  const id = params.id as string;
  const [reporte, setReporte] = useState<Reporte | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [uploading, setUploading] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editEstado, setEditEstado] = useState("");
  const [editTrabajos, setEditTrabajos] = useState("");
  const [editObs, setEditObs] = useState("");
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/infraestructura/reportes/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      setReporte(data.reporte);
      setEditEstado(data.reporte.estado);
      setEditTrabajos(data.reporte.trabajosRealizados || "");
      setEditObs(data.reporte.observaciones || "");
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setReporte(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function guardarEdicion() {
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch(`/api/infraestructura/reportes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estado: editEstado,
          trabajosRealizados: editTrabajos,
          observaciones: editObs,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo guardar");
      setReporte(data.reporte);
      setEditando(false);
      setMsg("Cambios guardados");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  async function finalizar() {
    setMsg("");
    const res = await fetch(`/api/infraestructura/reportes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado: "FINALIZADO" }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error || "No se pudo finalizar");
      return;
    }
    setReporte(data.reporte);
    setMsg("Reporte finalizado. Descargando PDF…");
    window.open(`/api/infraestructura/reportes/${id}/pdf`, "_blank");
  }

  async function subirFoto(tipo: IrTipoFoto, file: File) {
    setUploading(tipo);
    setMsg("");
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("No se pudo leer la imagen"));
        reader.readAsDataURL(file);
      });
      const res = await fetch(`/api/infraestructura/reportes/${id}/fotos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo, imagen: dataUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al subir");
      await cargar();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Error");
    } finally {
      setUploading(null);
    }
  }

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-infinity-600" />
      </div>
    );
  }

  if (!reporte) {
    return (
      <div className="min-h-dvh bg-slate-50 p-6 text-center">
        <p className="text-slate-700">{error || "No encontrado"}</p>
        <Link href="/infraestructura" className="text-infinity-600 text-sm">
          Volver
        </Link>
      </div>
    );
  }

  const tipoLabel =
    reporte.tipoTrabajo === "OTRO" && reporte.tipoTrabajoOtro
      ? `Otro: ${reporte.tipoTrabajoOtro}`
      : IR_TIPO_TRABAJO_LABELS[reporte.tipoTrabajo];

  const infraRows = [
    ["Nodo", reporte.nodo],
    ["NAP", reporte.nap],
    ["CTO", reporte.cto],
    ["ODF", reporte.odf],
    ["Splitter", reporte.splitter],
    ["Manga", reporte.manga],
    ["Caja de paso", reporte.cajaPaso],
    ["Tramo", reporte.tramoFibra],
    ["Hilos", reporte.cantidadHilos != null ? String(reporte.cantidadHilos) : null],
    [
      "Longitud (m)",
      reporte.longitudAfectadaM != null ? String(reporte.longitudAfectadaM) : null,
    ],
    ["Km", reporte.kmRedIntervenida != null ? String(reporte.kmRedIntervenida) : null],
  ] as const;

  return (
    <div className="min-h-dvh bg-slate-50">
      <AppHeader title={reporte.codigo} subtitle="Infraestructura de Red" />
      <main className="max-w-3xl mx-auto p-4 space-y-4 pb-16">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link
            href="/infraestructura"
            className="inline-flex items-center gap-1 text-sm text-infinity-600 hover:underline"
          >
            <ArrowLeft className="w-4 h-4" /> Listado
          </Link>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setEditando((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium bg-white"
            >
              <Pencil className="w-4 h-4" /> {editando ? "Cancelar" : "Editar"}
            </button>
            <a
              href={`/api/infraestructura/reportes/${id}/pdf`}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium hover:bg-white"
            >
              <FileDown className="w-4 h-4" /> Imprimir PDF
            </a>
          </div>
        </div>

        {msg && (
          <div className="bg-emerald-50 text-emerald-800 text-sm p-3 rounded-xl border border-emerald-200">
            {msg}
          </div>
        )}

        <section className="bg-white rounded-xl border p-4 space-y-2 text-sm">
          <div className="flex flex-wrap gap-2 justify-between">
            <h2 className="font-semibold text-base">{reporte.codigo}</h2>
            <span className="text-xs px-2 py-1 rounded-full bg-slate-100">
              {IR_ESTADO_LABELS[reporte.estado]}
            </span>
          </div>
          <p>
            <span className="text-slate-500">Fecha:</span>{" "}
            {new Date(reporte.fecha).toLocaleString("es-EC")}
          </p>
          <p>
            <span className="text-slate-500">Tiempo:</span>{" "}
            {formatoTiempoMinutos(reporte.tiempoMinutos)}
          </p>
          <p>
            <span className="text-slate-500">Técnico:</span> {reporte.tecnico.usuario.nombre}
          </p>
          {reporte.participantes.length > 0 && (
            <p>
              <span className="text-slate-500">Participantes:</span>{" "}
              {reporte.participantes.map((p) => p.tecnico.usuario.nombre).join(", ")}
            </p>
          )}
          <p>
            <span className="text-slate-500">Supervisor:</span>{" "}
            {reporte.supervisor?.nombre ?? "—"}
          </p>
          <p>
            <span className="text-slate-500">Tipo:</span> {tipoLabel} · Prioridad{" "}
            {IR_PRIORIDAD_LABELS[reporte.prioridad]}
          </p>
          {reporte.resultado && (
            <p>
              <span className="text-slate-500">Resultado:</span>{" "}
              {IR_RESULTADO_LABELS[reporte.resultado]}
            </p>
          )}
          <p>
            <span className="text-slate-500">Ubicación:</span> {reporte.provincia} /{" "}
            {reporte.canton} / {reporte.parroquia} — {reporte.sector}
          </p>
          <p>{reporte.direccion}</p>
        </section>

        {editando && (
          <section className="bg-white rounded-xl border p-4 space-y-3">
            <h3 className="font-semibold">Editar</h3>
            <label className="text-sm block space-y-1">
              <span className="font-medium">Estado</span>
              <select
                value={editEstado}
                onChange={(e) => setEditEstado(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl"
              >
                {IR_ESTADOS.map((e) => (
                  <option key={e} value={e}>
                    {IR_ESTADO_LABELS[e]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm block space-y-1">
              <span className="font-medium">Trabajos realizados</span>
              <textarea
                rows={4}
                value={editTrabajos}
                onChange={(e) => setEditTrabajos(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl"
              />
            </label>
            <label className="text-sm block space-y-1">
              <span className="font-medium">Observaciones</span>
              <textarea
                rows={3}
                value={editObs}
                onChange={(e) => setEditObs(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl"
              />
            </label>
            <button
              type="button"
              disabled={saving}
              onClick={() => void guardarEdicion()}
              className="w-full py-2.5 bg-cyan-700 text-white rounded-xl font-medium disabled:opacity-50"
            >
              {saving ? "Guardando…" : "Guardar cambios"}
            </button>
          </section>
        )}

        <section className="bg-white rounded-xl border p-4 space-y-2 text-sm">
          <h3 className="font-semibold">Infraestructura afectada</h3>
          {infraRows.some(([, v]) => v) ? (
            <ul className="space-y-1">
              {infraRows
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <li key={k}>
                    <span className="text-slate-500">{k}:</span> {v}
                  </li>
                ))}
            </ul>
          ) : (
            <p className="text-slate-500">Sin detalle de infraestructura</p>
          )}
          <p>
            <span className="text-slate-500">Clientes afectados (nº):</span>{" "}
            {reporte.clientesAfectadosN}
          </p>
        </section>

        {reporte.clientesAfectados.length > 0 && (
          <section className="bg-white rounded-xl border p-4 space-y-2 text-sm">
            <h3 className="font-semibold">Clientes vinculados</h3>
            <ul className="space-y-1">
              {reporte.clientesAfectados.map((c) => (
                <li key={c.cliente.id}>
                  {c.cliente.nombre} · {c.cliente.cedula}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="bg-white rounded-xl border p-4 space-y-2 text-sm">
          <h3 className="font-semibold">Descripción del problema</h3>
          <p className="whitespace-pre-wrap text-slate-700">{reporte.descripcion}</p>
          <h3 className="font-semibold pt-2">Trabajos realizados</h3>
          <p className="whitespace-pre-wrap text-slate-700">
            {reporte.trabajosRealizados || "—"}
          </p>
          {reporte.observaciones && (
            <>
              <h3 className="font-semibold pt-2">Observaciones</h3>
              <p className="whitespace-pre-wrap text-slate-700">{reporte.observaciones}</p>
            </>
          )}
        </section>

        <section className="bg-white rounded-xl border p-4 space-y-2">
          <h3 className="font-semibold">Equipos</h3>
          {reporte.equipos.length === 0 ? (
            <p className="text-sm text-slate-500">Sin equipos</p>
          ) : (
            <ul className="text-sm space-y-1">
              {reporte.equipos.map((e) => (
                <li key={e.id}>
                  {IR_EQUIPO_LABELS[e.tipo]}
                  {e.detalle ? ` — ${e.detalle}` : ""}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="bg-white rounded-xl border p-4 space-y-2">
          <h3 className="font-semibold">Materiales</h3>
          {reporte.materiales.length === 0 ? (
            <p className="text-sm text-slate-500">Sin materiales registrados</p>
          ) : (
            <ul className="text-sm space-y-1">
              {reporte.materiales.map((m) => (
                <li key={m.id}>
                  {m.material}: {m.cantidad} {m.unidad}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="bg-white rounded-xl border p-4 space-y-3">
          <h3 className="font-semibold">Fotografías</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {IR_TIPOS_FOTO.map((tipo) => {
              const fotos = reporte.fotografias.filter((f) => f.tipo === tipo);
              return (
                <div key={tipo} className="border rounded-xl p-3 space-y-2">
                  <p className="text-sm font-medium">{IR_TIPO_FOTO_LABELS[tipo]}</p>
                  {fotos.map((f) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={f.id}
                      src={f.imagenData || f.url}
                      alt={tipo}
                      className="w-full h-28 object-cover rounded-lg border"
                    />
                  ))}
                  <input
                    ref={(el) => {
                      fileRefs.current[tipo] = el;
                    }}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void subirFoto(tipo, file);
                      e.target.value = "";
                    }}
                  />
                  <button
                    type="button"
                    disabled={!!uploading}
                    onClick={() => fileRefs.current[tipo]?.click()}
                    className="w-full py-2 text-sm border rounded-lg disabled:opacity-50"
                  >
                    {uploading === tipo ? "Subiendo…" : "Subir foto"}
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        <section className="bg-white rounded-xl border p-4 space-y-3">
          <h3 className="font-semibold">Firmas</h3>
          <FirmaBox
            reporteId={id}
            tipo="TECNICO"
            nombreDefault={reporte.tecnico.usuario.nombre}
            existing={reporte.firmas.find((f) => f.tipo === "TECNICO")}
            onSaved={() => void cargar()}
          />
          <FirmaBox
            reporteId={id}
            tipo="SUPERVISOR"
            nombreDefault={reporte.supervisor?.nombre || "Supervisor"}
            existing={reporte.firmas.find((f) => f.tipo === "SUPERVISOR")}
            onSaved={() => void cargar()}
          />
        </section>

        <section className="bg-white rounded-xl border p-4 space-y-2">
          <h3 className="font-semibold">Historial</h3>
          <p className="text-xs text-slate-500">Registro automático · no se puede eliminar</p>
          {reporte.historial.length === 0 ? (
            <p className="text-sm text-slate-500">Sin eventos</p>
          ) : (
            <ul className="text-sm space-y-2 max-h-64 overflow-auto">
              {reporte.historial.map((h) => (
                <li key={h.id} className="border-b pb-2 last:border-0">
                  <p className="font-medium">
                    {new Date(h.fecha).toLocaleString("es-EC")} · {h.usuarioNombre}
                  </p>
                  <p className="text-slate-600">
                    {IR_ESTADO_LABELS[h.estado]}
                    {h.nota ? ` — ${h.nota}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        {reporte.estado !== "FINALIZADO" && reporte.estado !== "CANCELADO" && (
          <button
            type="button"
            onClick={() => void finalizar()}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl"
          >
            Finalizar
          </button>
        )}
      </main>
    </div>
  );
}
