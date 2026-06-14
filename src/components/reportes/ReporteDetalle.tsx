"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Loader2,
  ArrowLeft,
  Printer,
  CheckCircle,
  XCircle,
  Clock,
  User,
  Wrench,
} from "lucide-react";
import { PhotoGallery } from "./PhotoGallery";
import { FirmaReporte } from "./FirmaReporte";
import {
  TIPO_LABELS,
  ESTADO_LABELS,
  PRIORIDAD_LABELS,
  formatDateTime,
  formatDuration,
} from "@/lib/utils";
import { TIPO_PATCHCORD_LABELS } from "@/lib/material-detalle";
import { MOTIVO_INFRA_LABELS, esTicketInfraestructura } from "@/lib/ticket-infraestructura";
import type { MotivoInfraestructura, TipoPatchCord } from "@prisma/client";

interface Foto {
  id: string;
  tipo: string;
  url: string;
  imagenSrc?: string;
  lat: number | null;
  lng: number | null;
  tomadaEn: string;
}

interface ReporteData {
  error?: string;
  ticket: {
    id: string;
    codigo: string;
    tipo: string;
    prioridad: string;
    estado: string;
    motivo: string | null;
    descripcion: string | null;
    motivoInfraestructura?: MotivoInfraestructura | null;
    nodoAfectado?: string | null;
    zonaInfra?: string | null;
    updatedAt: string;
    cliente: {
      nombre: string;
      cedula: string;
      telefono: string;
      plan: string;
      direccion: string;
      sector: string;
      referencia: string | null;
    };
    tecnico: { usuario: { nombre: string } } | null;
    tecnicosLabel: string;
    orden: {
      finalizadoEn: string | null;
      medicion: {
        rxDbm: number;
        txDbm: number;
        pingMs: number | null;
        downloadMbps: number;
        uploadMbps: number;
      } | null;
      firma: {
        nombreCliente: string;
        cedula: string;
        imagenUrl: string;
        imagenSrc: string;
        firmadoEn: string;
        lat?: number | null;
        lng?: number | null;
      } | null;
      materiales: {
        id: string;
        cantidad: number;
        serie: string | null;
        modelo: string | null;
        marca: string | null;
        tipoPatchCord: string | null;
        inventario: { nombre: string; unidad: string };
      }[];
    } | null;
    eventos: {
      id: string;
      accion: string;
      createdAt: string;
      usuario: { nombre: string } | null;
    }[];
  };
  duracionSegundos: number;
  evidencia: {
    antes: Foto[];
    durante: Foto[];
    final: Foto[];
  };
  checklist: {
    servicioOk: boolean;
    potenciaOk: boolean;
    fotosOk: boolean;
    clienteConforme: boolean;
    firmaOk: boolean;
    whatsappEnviado: boolean;
  } | null;
}

interface ReporteDetalleProps {
  backHref: string;
  backLabel: string;
}

export function ReporteDetalle({ backHref, backLabel }: ReporteDetalleProps) {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<ReporteData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/reportes/${id}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [id]);

  function imprimir() {
    window.print();
  }

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-infinity-600" />
      </div>
    );
  }

  if (!data || data.error) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-4">
        <p className="text-red-600">{data?.error || "Reporte no encontrado"}</p>
      </div>
    );
  }

  const { ticket, duracionSegundos, evidencia, checklist } = data;
  const orden = ticket.orden;

  return (
    <div className="min-h-dvh bg-slate-50 print:bg-white">
      <header className="bg-infinity-800 text-white px-4 py-4 sticky top-0 z-50 print:hidden">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href={backHref} className="p-1 hover:bg-white/10 rounded-lg">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="font-bold">Reporte {ticket.codigo}</h1>
              <p className="text-infinity-200 text-sm">{backLabel}</p>
            </div>
          </div>
          <button
            onClick={imprimir}
            className="flex items-center gap-1 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm"
          >
            <Printer className="w-4 h-4" />
            Imprimir
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 space-y-4 print:p-0">
        <div className="bg-white rounded-xl border p-4 print:border-0 print:rounded-none">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">Infinity Internet</p>
              <h2 className="text-xl font-bold text-infinity-800 mt-1">
                Reporte de orden de servicio
              </h2>
              <p className="text-2xl font-mono font-bold mt-2">{ticket.codigo}</p>
            </div>
            <div className="text-right text-sm">
              <p className="font-medium text-emerald-700">{ESTADO_LABELS[ticket.estado]}</p>
              <p className="text-slate-500 text-xs mt-1">
                Cerrado: {formatDateTime(orden?.finalizadoEn || ticket.updatedAt)}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border p-4 space-y-2">
            <h3 className="font-semibold flex items-center gap-2 text-sm">
              <User className="w-4 h-4" />
              Cliente
            </h3>
            <p className="font-medium">{ticket.cliente.nombre}</p>
            <p className="text-sm text-slate-600">Cédula: {ticket.cliente.cedula}</p>
            <p className="text-sm text-slate-600">Tel: {ticket.cliente.telefono}</p>
            <p className="text-sm text-slate-600">Plan: {ticket.cliente.plan}</p>
            <p className="text-sm text-slate-600">{ticket.cliente.direccion}</p>
            {ticket.cliente.referencia && (
              <p className="text-sm bg-amber-50 border border-amber-200 rounded-lg p-2">
                <span className="text-slate-500 font-medium">Referencia: </span>
                {ticket.cliente.referencia}
              </p>
            )}
            <p className="text-sm text-slate-500">Sector: {ticket.cliente.sector}</p>
          </div>

          <div className="bg-white rounded-xl border p-4 space-y-2">
            <h3 className="font-semibold flex items-center gap-2 text-sm">
              <Wrench className="w-4 h-4" />
              Trabajo realizado
            </h3>
            <p className="text-sm">
              <span className="text-slate-500">Tipo:</span> {TIPO_LABELS[ticket.tipo]}
            </p>
            <p className="text-sm">
              <span className="text-slate-500">Prioridad:</span>{" "}
              {PRIORIDAD_LABELS[ticket.prioridad]}
            </p>
            <p className="text-sm">
              <span className="text-slate-500">Técnicos:</span>{" "}
              {ticket.tecnicosLabel}
            </p>
            <p className="text-sm">
              <span className="text-slate-500">Motivo:</span> {ticket.motivo}
            </p>
            {esTicketInfraestructura(ticket.tipo) && ticket.nodoAfectado && (
              <>
                <p className="text-sm">
                  <span className="text-slate-500">Nodo:</span> {ticket.nodoAfectado}
                </p>
                {ticket.zonaInfra && (
                  <p className="text-sm">
                    <span className="text-slate-500">Zona:</span> {ticket.zonaInfra}
                  </p>
                )}
                {ticket.motivoInfraestructura && (
                  <p className="text-sm">
                    <span className="text-slate-500">Incidente:</span>{" "}
                    {MOTIVO_INFRA_LABELS[ticket.motivoInfraestructura]}
                  </p>
                )}
              </>
            )}
            <p className="text-sm text-slate-600">{ticket.descripcion}</p>
            <p className="text-sm flex items-center gap-1 mt-2">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              Duración: <strong>{formatDuration(duracionSegundos)}</strong>
            </p>
          </div>
        </div>

        {orden?.medicion && (
          <div className="bg-white rounded-xl border p-4">
            <h3 className="font-semibold mb-3">Medición técnica</h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
              <div className="bg-slate-50 rounded-lg p-3 text-center">
                <p className="text-xs text-slate-500">RX</p>
                <p className="font-bold text-lg">{orden.medicion.rxDbm} dBm</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3 text-center">
                <p className="text-xs text-slate-500">TX</p>
                <p className="font-bold text-lg">{orden.medicion.txDbm} dBm</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3 text-center">
                <p className="text-xs text-slate-500">Ping</p>
                <p className="font-bold text-lg">{orden.medicion.pingMs ?? "—"} ms</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3 text-center">
                <p className="text-xs text-slate-500">Descarga</p>
                <p className="font-bold text-lg">{orden.medicion.downloadMbps} Mbps</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3 text-center">
                <p className="text-xs text-slate-500">Subida</p>
                <p className="font-bold text-lg">{orden.medicion.uploadMbps} Mbps</p>
              </div>
            </div>
          </div>
        )}

        {orden?.firma && <FirmaReporte firma={orden.firma} />}

        <div className="bg-white rounded-xl border p-4 space-y-6">
          <h3 className="font-semibold text-lg">Evidencia fotográfica</h3>
          <PhotoGallery titulo="Antes de iniciar" fotos={evidencia.antes} />
          <PhotoGallery titulo="Durante la reparación" fotos={evidencia.durante} />
          <PhotoGallery titulo="Al finalizar" fotos={evidencia.final} />
          {evidencia.antes.length === 0 &&
            evidencia.durante.length === 0 &&
            evidencia.final.length === 0 && (
              <p className="text-slate-400 text-sm text-center py-4">
                Sin fotografías registradas
              </p>
            )}
        </div>

        {orden?.materiales && orden.materiales.length > 0 && (
          <div className="bg-white rounded-xl border p-4">
            <h3 className="font-semibold mb-3">Material utilizado</h3>
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left p-2">Material</th>
                  <th className="text-left p-2">Serie / Modelo / Marca</th>
                  <th className="text-left p-2">Patch cord</th>
                  <th className="text-right p-2">Cantidad</th>
                </tr>
              </thead>
              <tbody>
                {orden.materiales.map((m) => (
                  <tr key={m.id} className="border-t">
                    <td className="p-2">{m.inventario.nombre}</td>
                    <td className="p-2 text-slate-600">
                      {m.serie || m.modelo || m.marca
                        ? [m.serie, m.modelo, m.marca].filter(Boolean).join(" · ")
                        : "—"}
                    </td>
                    <td className="p-2 text-slate-600">
                      {m.tipoPatchCord
                        ? TIPO_PATCHCORD_LABELS[m.tipoPatchCord as TipoPatchCord]
                        : "—"}
                    </td>
                    <td className="p-2 text-right">
                      {m.cantidad} {m.inventario.unidad}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {checklist && (
          <div className="bg-white rounded-xl border p-4">
            <h3 className="font-semibold mb-3">Checklist de cierre</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                { key: "servicioOk", label: "Servicio funcionando" },
                { key: "potenciaOk", label: "Potencia validada" },
                { key: "fotosOk", label: "Fotos cargadas" },
                { key: "clienteConforme", label: "Cliente conforme" },
                { key: "firmaOk", label: "Firma registrada" },
                { key: "whatsappEnviado", label: "WhatsApp enviado" },
              ].map(({ key, label }) => {
                const ok = checklist[key as keyof typeof checklist];
                return (
                  <div
                    key={key}
                    className={`flex items-center gap-2 text-sm p-2 rounded-lg ${
                      ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"
                    }`}
                  >
                    {ok ? (
                      <CheckCircle className="w-4 h-4 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 shrink-0" />
                    )}
                    {label}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {ticket.eventos.length > 0 && (
          <div className="bg-white rounded-xl border p-4 print:hidden">
            <h3 className="font-semibold mb-3">Historial</h3>
            <div className="space-y-2">
              {ticket.eventos.map((ev) => (
                <div key={ev.id} className="flex gap-3 text-sm border-l-2 border-infinity-200 pl-3">
                  <div>
                    <p className="font-medium">{ev.accion.replace(/_/g, " ")}</p>
                    <p className="text-xs text-slate-400">
                      {formatDateTime(ev.createdAt)}
                      {ev.usuario ? ` — ${ev.usuario.nombre}` : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
