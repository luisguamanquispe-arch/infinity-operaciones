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
  Gauge,
  Wifi,
  FileText,
  Camera,
  History,
} from "lucide-react";
import { PhotoGallery } from "./PhotoGallery";
import { FirmaReporte } from "./FirmaReporte";
import { MaterialesReporte } from "./MaterialesReporte";
import { ReporteSection } from "./ReporteSection";
import { ReporteQr } from "./ReporteQr";
import {
  TIPO_LABELS,
  ESTADO_LABELS,
  PRIORIDAD_LABELS,
  formatDateTime,
  formatDuration,
} from "@/lib/utils";
import { MOTIVO_INFRA_LABELS, esTicketInfraestructura } from "@/lib/ticket-infraestructura";
import { esTicketInstalacion, CLAUSULAS_POLITICA_INSTALACION } from "@/lib/ticket-instalacion";
import type { MotivoInfraestructura } from "@prisma/client";
import type { MaterialReporteDTO } from "@/lib/materiales-reporte";

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
      materiales: MaterialReporteDTO[];
      tipoConexionInstalacion?: string | null;
      direccionIp?: string | null;
      pppoeUsuario?: string | null;
      pppoeClave?: string | null;
      nombreRedWifi?: string | null;
      claveRedWifi?: string | null;
    } | null;
    eventos: {
      id: string;
      accion: string;
      createdAt: string;
      usuario: { nombre: string } | null;
    }[];
  };
  duracionSegundos: number;
  materiales?: MaterialReporteDTO[];
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
  clausulasInstalacion?: string[] | null;
}

interface ReporteDetalleProps {
  backHref: string;
  backLabel: string;
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:gap-2 text-sm py-1.5 border-b border-slate-100 last:border-0">
      <span className="text-slate-500 sm:w-36 shrink-0">{label}</span>
      <span className="text-slate-800 font-medium">{value}</span>
    </div>
  );
}

function MetricCard({ label, value, unit }: { label: string; value: string | number; unit?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-3 text-center">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="font-bold text-xl text-infinity-800 mt-1">
        {value}
        {unit && <span className="text-sm font-normal text-slate-500 ml-0.5">{unit}</span>}
      </p>
    </div>
  );
}

export function ReporteDetalle({ backHref, backLabel }: ReporteDetalleProps) {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<ReporteData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/reportes/${id}`, { cache: "no-store" })
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) {
          setData({ error: json.error || "No se pudo cargar el reporte" } as ReporteData);
          return;
        }
        setData(json);
      })
      .catch(() => setData({ error: "Sin conexión al cargar el reporte" } as ReporteData))
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

  const { ticket, duracionSegundos, evidencia, checklist, clausulasInstalacion, materiales: materialesApi } = data;
  const orden = ticket.orden;
  const materiales = materialesApi ?? orden?.materiales ?? [];
  const esInstalacion = esTicketInstalacion(ticket.tipo);
  const esInfra = esTicketInfraestructura(ticket.tipo);
  const clausulas =
    clausulasInstalacion && clausulasInstalacion.length > 0
      ? clausulasInstalacion
      : esInstalacion
        ? [...CLAUSULAS_POLITICA_INSTALACION]
        : [];

  const checklistItems = esInfra
    ? [
        { key: "servicioOk", label: "Infraestructura restablecida" },
        { key: "potenciaOk", label: "Enlaces / nodo validados" },
        { key: "fotosOk", label: "Fotos cargadas" },
      ]
    : [
        { key: "servicioOk", label: "Servicio funcionando" },
        { key: "potenciaOk", label: "Potencia validada" },
        { key: "fotosOk", label: "Fotos cargadas" },
        { key: "clienteConforme", label: "Cliente conforme" },
        { key: "firmaOk", label: "Firma registrada" },
        { key: "whatsappEnviado", label: "WhatsApp enviado" },
      ];

  return (
    <div className="min-h-dvh bg-slate-100 print:bg-white">
      <header className="bg-infinity-800 text-white px-4 py-4 sticky top-0 z-50 print:hidden shadow-md">
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
            className="flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium"
          >
            <Printer className="w-4 h-4" />
            Imprimir
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 sm:p-6 space-y-5 print:p-0 print:space-y-4">
        {/* Encabezado del reporte */}
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden print:shadow-none print:border-0">
          <div className="h-1.5 bg-gradient-to-r from-infinity-600 via-infinity-500 to-emerald-500" />
          <div className="p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-5">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-infinity-600 uppercase tracking-widest">
                  Infinity Internet
                </p>
                <h2 className="text-2xl font-bold text-slate-900 mt-1">
                  Orden de servicio
                </h2>
                <p className="text-3xl font-mono font-bold text-infinity-800 mt-2 tracking-tight">
                  {ticket.codigo}
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <span className="inline-flex items-center rounded-full bg-infinity-100 px-3 py-1 text-xs font-semibold text-infinity-800">
                    {TIPO_LABELS[ticket.tipo]}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                    {PRIORIDAD_LABELS[ticket.prioridad]}
                  </span>
                  {esInstalacion && (
                    <span className="inline-flex items-center rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-800">
                      Nueva instalación
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-row sm:flex-col items-center sm:items-end gap-4 sm:gap-3 shrink-0">
                <ReporteQr ticketId={ticket.id} codigo={ticket.codigo} tipo={ticket.tipo} />
                <div className="sm:text-right flex-1 sm:flex-none">
                  <span className="inline-flex items-center rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-sm font-semibold text-emerald-800">
                    {ESTADO_LABELS[ticket.estado]}
                  </span>
                  <p className="text-xs text-slate-500 mt-2">
                    Cerrado: {formatDateTime(orden?.finalizadoEn || ticket.updatedAt)}
                  </p>
                  <p className="text-sm font-medium text-slate-700 mt-1 flex sm:justify-end items-center gap-1.5">
                    <Clock className="w-4 h-4 text-infinity-500" />
                    {formatDuration(duracionSegundos)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Cliente + Trabajo */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <ReporteSection title="Datos del cliente" icon={User} accent="default">
            <p className="font-semibold text-lg text-slate-900 mb-3">{ticket.cliente.nombre}</p>
            <InfoRow label="Cédula" value={ticket.cliente.cedula} />
            <InfoRow label="Teléfono" value={ticket.cliente.telefono} />
            <InfoRow label="Plan" value={ticket.cliente.plan} />
            <InfoRow label="Dirección" value={ticket.cliente.direccion} />
            <InfoRow label="Sector" value={ticket.cliente.sector} />
            {ticket.cliente.referencia && (
              <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm">
                <span className="font-medium text-amber-900">Referencia: </span>
                <span className="text-amber-950">{ticket.cliente.referencia}</span>
              </div>
            )}
          </ReporteSection>

          <ReporteSection title="Trabajo realizado" icon={Wrench} accent="default">
            <InfoRow label="Tipo" value={TIPO_LABELS[ticket.tipo]} />
            <InfoRow label="Técnicos" value={ticket.tecnicosLabel} />
            <InfoRow label="Motivo" value={ticket.motivo || "—"} />
            {esInfra && ticket.nodoAfectado && (
              <InfoRow label="Nodo" value={ticket.nodoAfectado} />
            )}
            {esInfra && ticket.zonaInfra && (
              <InfoRow label="Zona" value={ticket.zonaInfra} />
            )}
            {esInfra && ticket.motivoInfraestructura && (
              <InfoRow
                label="Incidente"
                value={MOTIVO_INFRA_LABELS[ticket.motivoInfraestructura]}
              />
            )}
            {ticket.descripcion && (
              <div className="mt-3 rounded-lg bg-slate-50 border border-slate-100 p-3 text-sm text-slate-700">
                <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Descripción</p>
                {ticket.descripcion}
              </div>
            )}
          </ReporteSection>
        </div>

        {orden?.medicion && (
          <ReporteSection
            title="Medición técnica"
            subtitle="Potencia óptica y velocidad medida en sitio"
            icon={Gauge}
            accent="emerald"
          >
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <MetricCard label="RX" value={orden.medicion.rxDbm} unit="dBm" />
              <MetricCard label="TX" value={orden.medicion.txDbm} unit="dBm" />
              <MetricCard label="Ping" value={orden.medicion.pingMs ?? "—"} unit="ms" />
              <MetricCard label="Descarga" value={orden.medicion.downloadMbps} unit="Mbps" />
              <MetricCard label="Subida" value={orden.medicion.uploadMbps} unit="Mbps" />
            </div>
          </ReporteSection>
        )}

        {esInstalacion && orden?.tipoConexionInstalacion && (
          <ReporteSection
            title="Datos de instalación entregados"
            subtitle="Credenciales y configuración entregadas al cliente"
            icon={Wifi}
            accent="sky"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
              <InfoRow
                label="Conexión"
                value={
                  orden.tipoConexionInstalacion === "IP"
                    ? `IP fija — ${orden.direccionIp}`
                    : "PPPoE"
                }
              />
              {orden.tipoConexionInstalacion === "PPPOE" && (
                <>
                  <InfoRow label="Usuario PPPoE" value={orden.pppoeUsuario} />
                  <InfoRow
                    label="Clave PPPoE"
                    value={<span className="font-mono">{orden.pppoeClave}</span>}
                  />
                </>
              )}
              <InfoRow label="Red WiFi" value={orden.nombreRedWifi} />
              <InfoRow
                label="Clave WiFi"
                value={<span className="font-mono">{orden.claveRedWifi}</span>}
              />
            </div>
          </ReporteSection>
        )}

        <MaterialesReporte materiales={materiales} tipoTicket={ticket.tipo} />

        {esInstalacion && clausulas.length > 0 && (
          <ReporteSection
            title="Políticas del servicio — Instalación"
            icon={FileText}
            accent="amber"
            className="print:border"
          >
            <ul className="space-y-2.5 text-sm text-slate-700">
              {clausulas.map((clausula) => (
                <li key={clausula} className="flex gap-3 leading-relaxed">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                  <span>{clausula}</span>
                </li>
              ))}
            </ul>
          </ReporteSection>
        )}

        {orden?.firma && <FirmaReporte firma={orden.firma} />}

        <ReporteSection
          title="Evidencia fotográfica"
          subtitle="Registro visual antes, durante y al finalizar el trabajo"
          icon={Camera}
        >
          <div className="space-y-6">
            <PhotoGallery titulo="Antes de iniciar" fotos={evidencia.antes} />
            <PhotoGallery titulo="Durante la reparación" fotos={evidencia.durante} />
            <PhotoGallery titulo="Al finalizar" fotos={evidencia.final} />
            {evidencia.antes.length === 0 &&
              evidencia.durante.length === 0 &&
              evidencia.final.length === 0 && (
                <p className="text-slate-400 text-sm text-center py-6 bg-slate-50 rounded-lg">
                  Sin fotografías registradas
                </p>
              )}
          </div>
        </ReporteSection>

        {checklist && (
          <ReporteSection title="Checklist de cierre" icon={CheckCircle} accent="emerald">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {checklistItems.map(({ key, label }) => {
                const ok = checklist[key as keyof typeof checklist];
                return (
                  <div
                    key={key}
                    className={`flex items-center gap-2.5 text-sm p-3 rounded-lg border ${
                      ok
                        ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                        : "bg-red-50 border-red-200 text-red-800"
                    }`}
                  >
                    {ok ? (
                      <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
                    ) : (
                      <XCircle className="w-4 h-4 shrink-0 text-red-500" />
                    )}
                    <span className="font-medium">{label}</span>
                  </div>
                );
              })}
            </div>
          </ReporteSection>
        )}

        {ticket.eventos.length > 0 && (
          <ReporteSection title="Historial" icon={History} className="print:hidden">
            <div className="space-y-3">
              {ticket.eventos.map((ev) => (
                <div
                  key={ev.id}
                  className="flex gap-3 text-sm border-l-2 border-infinity-300 pl-4 py-0.5"
                >
                  <div>
                    <p className="font-medium text-slate-800">
                      {ev.accion.replace(/_/g, " ")}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {formatDateTime(ev.createdAt)}
                      {ev.usuario ? ` · ${ev.usuario.nombre}` : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </ReporteSection>
        )}

        <footer className="text-center text-xs text-slate-400 py-4 print:pt-6">
          Documento generado por Infinity Operaciones · {ticket.codigo}
        </footer>
      </main>
    </div>
  );
}
