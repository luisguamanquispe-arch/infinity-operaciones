"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileDown, Loader2 } from "lucide-react";
import SignaturePad from "signature_pad";
import { AppHeader } from "@/components/AppHeader";
import { fetchWithRetry } from "@/lib/compress-image";
import {
  IR_ESTADO_LABELS,
  IR_PRIORIDAD_LABELS,
  IR_TIPO_FOTO_LABELS,
  IR_TIPO_FIRMA_LABELS,
  IR_TIPO_TRABAJO_LABELS,
  IR_TIPOS_FOTO,
  type IrTipoFoto,
} from "@/lib/infraestructura-red/labels";

type Reporte = {
  id: string;
  codigo: string;
  fecha: string;
  horaInicio: string | null;
  horaFin: string | null;
  estado: keyof typeof IR_ESTADO_LABELS;
  prioridad: keyof typeof IR_PRIORIDAD_LABELS;
  tipoTrabajo: keyof typeof IR_TIPO_TRABAJO_LABELS;
  tipoTrabajoOtro: string | null;
  provincia: string;
  canton: string;
  parroquia: string;
  sector: string;
  direccion: string;
  lat: number | null;
  lng: number | null;
  descripcion: string;
  observaciones: string | null;
  tecnico: { usuario: { nombre: string } };
  supervisor: { nombre: string } | null;
  materiales: { id: string; material: string; cantidad: number; unidad: string }[];
  fotografias: { id: string; tipo: string; url: string; imagenData: string | null }[];
  firmas: { id: string; tipo: string; nombre: string; imagenData: string | null }[];
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
        <p className="text-sm font-medium">{IR_TIPO_FIRMA_LABELS[tipo]}: {existing.nombre}</p>
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
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/infraestructura/reportes/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      setReporte(data.reporte);
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

  return (
    <div className="min-h-dvh bg-slate-50">
      <AppHeader title={reporte.codigo} subtitle="Infraestructura de Red" />
      <main className="max-w-3xl mx-auto p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link
            href="/infraestructura"
            className="inline-flex items-center gap-1 text-sm text-infinity-600 hover:underline"
          >
            <ArrowLeft className="w-4 h-4" /> Listado
          </Link>
          <a
            href={`/api/infraestructura/reportes/${id}/pdf`}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium hover:bg-white"
          >
            <FileDown className="w-4 h-4" /> Descargar PDF
          </a>
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
            <span className="text-slate-500">Técnico:</span> {reporte.tecnico.usuario.nombre}
          </p>
          <p>
            <span className="text-slate-500">Supervisor:</span>{" "}
            {reporte.supervisor?.nombre ?? "—"}
          </p>
          <p>
            <span className="text-slate-500">Tipo:</span> {tipoLabel} · Prioridad{" "}
            {IR_PRIORIDAD_LABELS[reporte.prioridad]}
          </p>
          <p>
            <span className="text-slate-500">Ubicación:</span> {reporte.provincia} /{" "}
            {reporte.canton} / {reporte.parroquia} — {reporte.sector}
          </p>
          <p>{reporte.direccion}</p>
          {reporte.lat != null && reporte.lng != null && (
            <p className="text-xs text-slate-500">
              GPS: {reporte.lat}, {reporte.lng}
            </p>
          )}
          <div className="pt-2 border-t">
            <p className="font-medium mb-1">Descripción</p>
            <p className="whitespace-pre-wrap text-slate-700">{reporte.descripcion}</p>
          </div>
          {reporte.observaciones && (
            <div>
              <p className="font-medium mb-1">Observaciones</p>
              <p className="whitespace-pre-wrap text-slate-700">{reporte.observaciones}</p>
            </div>
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

        {reporte.estado !== "FINALIZADO" && (
          <button
            type="button"
            onClick={() => void finalizar()}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl"
          >
            Marcar como finalizado
          </button>
        )}
      </main>
    </div>
  );
}
