"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  FileDown,
  Loader2,
  Paperclip,
  Pencil,
} from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import {
  SR_ESTADO_LABELS,
  SR_PRIORIDAD_LABELS,
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
  prioridad: keyof typeof SR_PRIORIDAD_LABELS;
  tipoSoporte: keyof typeof SR_TIPO_SOPORTE_LABELS;
  tipoSoporteOtro: string | null;
  clienteId: string | null;
  clienteNombre: string;
  clienteCodigo: string;
  telefono: string;
  descripcionProblema: string;
  accionesRealizadas: string | null;
  resultado: keyof typeof SR_RESULTADO_LABELS | null;
  observaciones: string | null;
  operador: { nombre: string };
  ticketPresencial: { id: string; codigo: string; estado: string } | null;
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
  const [editando, setEditando] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [acciones, setAcciones] = useState("");
  const [resultado, setResultado] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [estado, setEstado] = useState("");
  const [horaFin, setHoraFin] = useState("");

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/help-desk/tickets/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      const t = data.ticket as Ticket;
      setTicket(t);
      setAcciones(t.accionesRealizadas || "");
      setResultado(t.resultado || "");
      setObservaciones(t.observaciones || "");
      setEstado(t.estado);
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
        accionesRealizadas: acciones,
        resultado: resultado || null,
        observaciones: observaciones || null,
        estado: estado || undefined,
        ...extra,
      };
      if (horaFin && ticket) {
        body.horaFin = new Date(`${ticket.fecha.slice(0, 10)}T${horaFin}:00`).toISOString();
      }
      const res = await fetch(`/api/help-desk/tickets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al guardar");
      setTicket(data.ticket);
      setEditando(false);
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
      window.open(`/api/help-desk/tickets/${id}/pdf`, "_blank");
    }
  }

  async function escalar() {
    if (!ticket?.clienteId) {
      setMsg("Vincule un cliente del CRM antes de escalar a visita técnica.");
      return;
    }
    if (!confirm("¿Crear orden de soporte presencial pendiente de asignación?")) return;
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch(`/api/help-desk/tickets/${id}/escalar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resultado:
            resultado === "ESCALADO_SOPORTE_TECNICO"
              ? "ESCALADO_SOPORTE_TECNICO"
              : "REQUIERE_VISITA",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al escalar");
      setTicket(data.ticket);
      setMsg(`Escalado: orden ${data.ordenPresencial.codigo} creada (pendiente de asignación).`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
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
      let tipo = "DOCUMENTO";
      if (file.type === "application/pdf") tipo = "PDF";
      else if (file.type.startsWith("image/")) tipo = "CAPTURA";

      const res = await fetch(`/api/help-desk/tickets/${id}/adjuntos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: dataUrl, nombreArchivo: file.name, tipo }),
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
        <Link href="/help-desk" className="text-teal-700 text-sm">
          Volver
        </Link>
      </div>
    );
  }

  const tipoLabel =
    ticket.tipoSoporte === "OTRO" && ticket.tipoSoporteOtro
      ? `Otro: ${ticket.tipoSoporteOtro}`
      : SR_TIPO_SOPORTE_LABELS[ticket.tipoSoporte];

  const cerrado = ticket.estado === "FINALIZADO" || ticket.estado === "ESCALADO";

  return (
    <div className="min-h-dvh bg-slate-50">
      <AppHeader title={ticket.codigo} subtitle="Soporte Remoto" />
      <main className="max-w-3xl mx-auto p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link
            href="/help-desk"
            className="inline-flex items-center gap-1 text-sm text-teal-700 hover:underline"
          >
            <ArrowLeft className="w-4 h-4" /> Listado
          </Link>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/help-desk/nuevo"
              className="px-3 py-2 rounded-xl border text-sm font-medium hover:bg-white"
            >
              Nuevo Soporte
            </Link>
            <a
              href={`/api/help-desk/tickets/${id}/pdf`}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium hover:bg-white"
            >
              <FileDown className="w-4 h-4" /> Imprimir PDF
            </a>
          </div>
        </div>

        {msg && (
          <div
            className={`text-sm p-3 rounded-xl border ${
              msg.toLowerCase().includes("error") || msg.toLowerCase().includes("vincule")
                ? "bg-amber-50 text-amber-900 border-amber-200"
                : "bg-emerald-50 text-emerald-800 border-emerald-200"
            }`}
          >
            {msg}
          </div>
        )}

        <section className="bg-white rounded-xl border p-4 space-y-2 text-sm">
          <div className="flex flex-wrap gap-2 justify-between items-start">
            <h2 className="font-semibold text-base">{ticket.codigo}</h2>
            <div className="flex gap-2">
              <span className="text-xs px-2 py-1 rounded-full bg-slate-100">
                {SR_ESTADO_LABELS[ticket.estado]}
              </span>
              {!cerrado && (
                <button
                  type="button"
                  onClick={() => setEditando((v) => !v)}
                  className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg border"
                >
                  <Pencil className="w-3 h-3" /> {editando ? "Ver" : "Editar"}
                </button>
              )}
            </div>
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
            <span className="text-slate-500">Motivo:</span> {tipoLabel} · Prioridad{" "}
            {SR_PRIORIDAD_LABELS[ticket.prioridad]}
          </p>
          <p>
            <span className="text-slate-500">Tiempo:</span>{" "}
            {formatTiempoMinutos(ticket.tiempoMinutos)}
          </p>
          {ticket.ticketPresencial && (
            <p>
              <span className="text-slate-500">Orden presencial:</span>{" "}
              <Link
                href={`/reportes/${ticket.ticketPresencial.id}`}
                className="text-teal-700 hover:underline font-medium"
              >
                {ticket.ticketPresencial.codigo}
              </Link>{" "}
              ({ticket.ticketPresencial.estado})
            </p>
          )}
          <div className="pt-2 border-t">
            <p className="font-medium mb-1">Problema</p>
            <p className="whitespace-pre-wrap text-slate-700">{ticket.descripcionProblema}</p>
          </div>
          {!editando && ticket.accionesRealizadas && (
            <div>
              <p className="font-medium mb-1">Acciones realizadas</p>
              <p className="whitespace-pre-wrap text-slate-700">{ticket.accionesRealizadas}</p>
            </div>
          )}
        </section>

        {(editando || !cerrado) && (
          <section className="bg-white rounded-xl border p-4 space-y-3">
            <h3 className="font-semibold">Actualizar atención</h3>
            <label className="block text-sm space-y-1">
              <span className="text-slate-600">Estado</span>
              <select
                value={estado}
                onChange={(e) => setEstado(e.target.value)}
                disabled={cerrado}
                className="w-full px-3 py-2 border rounded-lg disabled:bg-slate-50"
              >
                <option value="PENDIENTE">Pendiente</option>
                <option value="EN_PROCESO">En proceso</option>
                <option value="FINALIZADO">Finalizado</option>
              </select>
            </label>
            <label className="block text-sm space-y-1">
              <span className="text-slate-600">Acciones realizadas</span>
              <textarea
                rows={4}
                value={acciones}
                onChange={(e) => setAcciones(e.target.value)}
                disabled={cerrado && !editando}
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
            {!cerrado && (
              <label className="block text-sm space-y-1">
                <span className="text-slate-600">Hora fin</span>
                <input
                  type="time"
                  value={horaFin}
                  onChange={(e) => setHoraFin(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </label>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => void guardarCambios()}
                className="py-2.5 border rounded-xl text-sm font-medium disabled:opacity-50"
              >
                Guardar
              </button>
              {!cerrado && (
                <>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void finalizar()}
                    className="py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50"
                  >
                    Finalizar
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void escalar()}
                    className="sm:col-span-2 py-2.5 bg-violet-700 hover:bg-violet-800 text-white rounded-xl text-sm font-semibold disabled:opacity-50"
                  >
                    Escalar a Visita Técnica
                  </button>
                </>
              )}
            </div>
          </section>
        )}

        <section className="bg-white rounded-xl border p-4 space-y-3">
          <h3 className="font-semibold flex items-center gap-2">
            <Paperclip className="w-4 h-4" /> Archivos
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
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-teal-700 hover:underline"
                  >
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
            accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
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
            {uploading ? "Subiendo…" : "Subir captura / foto / PDF / documento"}
          </button>
        </section>

        <section className="bg-white rounded-xl border p-4 space-y-2">
          <h3 className="font-semibold">Historial</h3>
          <p className="text-xs text-slate-500">Los registros del historial no se pueden eliminar.</p>
          <ul className="text-sm space-y-2">
            {ticket.historial.map((h) => (
              <li key={h.id} className="border-l-2 border-teal-200 pl-3 py-1">
                <p className="text-xs text-slate-500">
                  {new Date(h.fecha).toLocaleString("es-EC")} · {h.usuarioNombre}
                </p>
                <p>
                  {SR_ESTADO_LABELS[h.estado]}
                  {h.tiempoMinutos != null ? ` · ${formatTiempoMinutos(h.tiempoMinutos)}` : ""}
                  {h.nota ? ` — ${h.nota}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
