"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileDown, Loader2, Paperclip } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import {
  SR_ESTADO_LABELS,
  SR_RESULTADO_LABELS,
  SR_RESULTADOS,
  SR_TIPO_ADJUNTO_LABELS,
  SR_TIPO_SOPORTE_LABELS,
  formatTiempoMinutos,
} from "@/lib/soporte-remoto/labels";

type Ticket = {
  id: string;
  codigo: string;
  fecha: string;
  horaInicio: string | null;
  horaFin: string | null;
  tiempoMinutos: number | null;
  estado: keyof typeof SR_ESTADO_LABELS;
  tipoSoporte: keyof typeof SR_TIPO_SOPORTE_LABELS;
  tipoSoporteOtro: string | null;
  clienteNombre: string;
  clienteCodigo: string;
  telefono: string;
  descripcionProblema: string;
  solucionAplicada: string | null;
  resultado: keyof typeof SR_RESULTADO_LABELS | null;
  observaciones: string | null;
  operador: { nombre: string };
  adjuntos: {
    id: string;
    tipo: keyof typeof SR_TIPO_ADJUNTO_LABELS;
    nombreArchivo: string;
    mimeType: string;
    url: string;
    dataBase64: string | null;
  }[];
  historial: {
    id: string;
    fecha: string;
    usuarioNombre: string;
    tiempoMinutos: number | null;
    estado: keyof typeof SR_ESTADO_LABELS;
    nota: string | null;
  }[];
};

export default function SrTicketDetallePage() {
  const params = useParams();
  const id = params.id as string;
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [solucion, setSolucion] = useState("");
  const [resultado, setResultado] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [horaFin, setHoraFin] = useState("");

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/soporte-remoto/tickets/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      const t = data.ticket as Ticket;
      setTicket(t);
      setSolucion(t.solucionAplicada || "");
      setResultado(t.resultado || "");
      setObservaciones(t.observaciones || "");
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setTicket(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function guardarCambios(extra?: Record<string, unknown>) {
    setSaving(true);
    setMsg("");
    try {
      const body: Record<string, unknown> = {
        solucionAplicada: solucion,
        resultado: resultado || null,
        observaciones: observaciones || null,
        ...extra,
      };
      if (horaFin && ticket) {
        const fecha = ticket.fecha.slice(0, 10);
        body.horaFin = new Date(`${fecha}T${horaFin}:00`).toISOString();
      }
      const res = await fetch(`/api/soporte-remoto/tickets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al guardar");
      setTicket(data.ticket);
      setMsg("Cambios guardados");
      return data.ticket as Ticket;
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Error");
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function finalizar() {
    const t = await guardarCambios({
      estado: "FINALIZADO",
      horaFin:
        horaFin && ticket
          ? new Date(`${ticket.fecha.slice(0, 10)}T${horaFin}:00`).toISOString()
          : new Date().toISOString(),
    });
    if (t) {
      setMsg("Ticket finalizado. Descargando PDF…");
      window.open(`/api/soporte-remoto/tickets/${id}/pdf`, "_blank");
    }
  }

  async function subirAdjunto(file: File) {
    setUploading(true);
    setMsg("");
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
        reader.readAsDataURL(file);
      });
      let tipo = "OTRO";
      if (file.type === "application/pdf") tipo = "PDF";
      else if (file.type.startsWith("image/")) tipo = "CAPTURA";

      const res = await fetch(`/api/soporte-remoto/tickets/${id}/adjuntos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: dataUrl,
          nombreArchivo: file.name,
          tipo,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al subir");
      await cargar();
      setMsg("Adjunto cargado");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Error");
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="min-h-dvh bg-slate-50 p-6 text-center">
        <p className="text-slate-700">{error || "No encontrado"}</p>
        <Link href="/soporte-remoto" className="text-teal-700 text-sm">
          Volver
        </Link>
      </div>
    );
  }

  const tipoLabel =
    ticket.tipoSoporte === "OTRO" && ticket.tipoSoporteOtro
      ? `Otro: ${ticket.tipoSoporteOtro}`
      : SR_TIPO_SOPORTE_LABELS[ticket.tipoSoporte];

  return (
    <div className="min-h-dvh bg-slate-50">
      <AppHeader title={ticket.codigo} subtitle="Soporte Remoto" />
      <main className="max-w-3xl mx-auto p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link
            href="/soporte-remoto"
            className="inline-flex items-center gap-1 text-sm text-teal-700 hover:underline"
          >
            <ArrowLeft className="w-4 h-4" /> Listado
          </Link>
          <a
            href={`/api/soporte-remoto/tickets/${id}/pdf`}
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
            <h2 className="font-semibold text-base">{ticket.codigo}</h2>
            <span className="text-xs px-2 py-1 rounded-full bg-slate-100">
              {SR_ESTADO_LABELS[ticket.estado]}
            </span>
          </div>
          <p>
            <span className="text-slate-500">Fecha:</span>{" "}
            {new Date(ticket.fecha).toLocaleString("es-EC")}
          </p>
          <p>
            <span className="text-slate-500">Operador:</span> {ticket.operador.nombre}
          </p>
          <p>
            <span className="text-slate-500">Cliente:</span> {ticket.clienteNombre} ·{" "}
            {ticket.clienteCodigo} · {ticket.telefono}
          </p>
          <p>
            <span className="text-slate-500">Tipo:</span> {tipoLabel}
          </p>
          <p>
            <span className="text-slate-500">Tiempo:</span>{" "}
            {formatTiempoMinutos(ticket.tiempoMinutos)}
          </p>
          {ticket.resultado && (
            <p>
              <span className="text-slate-500">Resultado:</span>{" "}
              {SR_RESULTADO_LABELS[ticket.resultado]}
            </p>
          )}
          <div className="pt-2 border-t">
            <p className="font-medium mb-1">Problema</p>
            <p className="whitespace-pre-wrap text-slate-700">{ticket.descripcionProblema}</p>
          </div>
        </section>

        <section className="bg-white rounded-xl border p-4 space-y-3">
          <h3 className="font-semibold">Actualizar atención</h3>
          <label className="block text-sm space-y-1">
            <span className="text-slate-600">Solución aplicada</span>
            <textarea
              rows={3}
              value={solucion}
              onChange={(e) => setSolucion(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </label>
          <label className="block text-sm space-y-1">
            <span className="text-slate-600">Resultado</span>
            <select
              value={resultado}
              onChange={(e) => setResultado(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="">— Sin definir —</option>
              {SR_RESULTADOS.map((r) => (
                <option key={r} value={r}>
                  {SR_RESULTADO_LABELS[r]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm space-y-1">
            <span className="text-slate-600">Observaciones</span>
            <textarea
              rows={2}
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </label>
          {ticket.estado !== "FINALIZADO" && (
            <label className="block text-sm space-y-1">
              <span className="text-slate-600">Hora fin (al finalizar)</span>
              <input
                type="time"
                value={horaFin}
                onChange={(e) => setHoraFin(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </label>
          )}
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => void guardarCambios()}
              className="flex-1 py-2.5 border rounded-xl text-sm font-medium disabled:opacity-50"
            >
              Guardar cambios
            </button>
            {ticket.estado !== "FINALIZADO" && (
              <button
                type="button"
                disabled={saving}
                onClick={() => void finalizar()}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50"
              >
                Finalizar y PDF
              </button>
            )}
          </div>
        </section>

        <section className="bg-white rounded-xl border p-4 space-y-3">
          <h3 className="font-semibold flex items-center gap-2">
            <Paperclip className="w-4 h-4" /> Adjuntos
          </h3>
          {ticket.adjuntos.length === 0 ? (
            <p className="text-sm text-slate-500">Sin adjuntos</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {ticket.adjuntos.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-2">
                  <span className="text-xs px-2 py-0.5 rounded bg-slate-100">
                    {SR_TIPO_ADJUNTO_LABELS[a.tipo]}
                  </span>
                  <a href={a.url} target="_blank" rel="noreferrer" className="text-teal-700 hover:underline">
                    {a.nombreArchivo}
                  </a>
                  {a.dataBase64?.startsWith("data:image") && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={a.dataBase64}
                      alt={a.nombreArchivo}
                      className="w-full max-h-40 object-contain rounded border mt-1"
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void subirAdjunto(file);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="w-full py-2 text-sm border rounded-lg disabled:opacity-50"
          >
            {uploading ? "Subiendo…" : "Subir captura / foto / PDF"}
          </button>
        </section>

        <section className="bg-white rounded-xl border p-4 space-y-2">
          <h3 className="font-semibold">Historial</h3>
          {ticket.historial.length === 0 ? (
            <p className="text-sm text-slate-500">Sin eventos</p>
          ) : (
            <ul className="text-sm space-y-2">
              {ticket.historial.map((h) => (
                <li key={h.id} className="border-l-2 border-teal-200 pl-3 py-1">
                  <p className="text-xs text-slate-500">
                    {new Date(h.fecha).toLocaleString("es-EC")} · {h.usuarioNombre}
                  </p>
                  <p>
                    {SR_ESTADO_LABELS[h.estado]}
                    {h.tiempoMinutos != null
                      ? ` · ${formatTiempoMinutos(h.tiempoMinutos)}`
                      : ""}
                    {h.nota ? ` — ${h.nota}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
