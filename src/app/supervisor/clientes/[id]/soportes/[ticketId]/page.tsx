"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { PhotoGallery } from "@/components/reportes/PhotoGallery";
import { FirmaReporte } from "@/components/reportes/FirmaReporte";
import { MaterialesReporte } from "@/components/reportes/MaterialesReporte";
import {
  ESTADO_LABELS,
  PRIORIDAD_LABELS,
  TIPO_LABELS,
  formatDateTime,
  formatDuration,
} from "@/lib/utils";
import type { MaterialReporteDTO } from "@/lib/materiales-reporte";

type Foto = {
  id: string;
  tipo: string;
  url: string;
  imagenSrc?: string;
  lat: number | null;
  lng: number | null;
  tomadaEn: string;
};

type Detalle = {
  cliente: {
    nombre: string;
    telefono: string;
    direccion: string;
    plan: string;
    cedula: string;
  };
  ticket: {
    id: string;
    codigo: string;
    tipo: string;
    prioridad: string;
    estado: string;
    motivo: string | null;
    descripcion: string | null;
    createdAt: string;
    asignadoEn: string | null;
    tecnicosLabel: string;
    resultado: string;
  };
  atencion: {
    horaLlegada: string | null;
    horaInicio: string | null;
    horaFin: string | null;
    duracionSegundos: number;
    problemaReportado: string | null;
    diagnostico: string | null;
    trabajoRealizado: string | null;
    observaciones: string | null;
  };
  materiales: MaterialReporteDTO[];
  equipos: MaterialReporteDTO[];
  evidencia: { antes: Foto[]; durante: Foto[]; despues: Foto[]; otras: Foto[] };
  cierre: {
    reporteFinal: string | null;
    fechaCierre: string | null;
    tecnicoCerro: string | null;
    observaciones: string | null;
    firma: {
      nombreCliente: string;
      cedula: string;
      imagenSrc: string;
      firmadoEn: string;
      lat?: number | null;
      lng?: number | null;
      aceptacionCondiciones?: boolean;
      textoAceptacion?: string | null;
      aceptadoEn?: string | null;
    } | null;
    calificacion: { calificacion: number; comentario: string | null; createdAt: string } | null;
  };
};

function Campo({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-sm text-slate-800 whitespace-pre-wrap">{value?.trim() || "—"}</p>
    </div>
  );
}

export default function DetalleSoporteClientePage() {
  const params = useParams();
  const id = params.id as string;
  const ticketId = params.ticketId as string;
  const [data, setData] = useState<Detalle | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const res = await fetch(`/api/clientes/${id}/soportes/${ticketId}`);
        const json = await res.json();
        if (cancel) return;
        if (!res.ok) {
          setError(json.error || "No se pudo cargar el detalle");
          return;
        }
        setData(json);
      } catch {
        if (!cancel) setError("Sin conexión");
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [id, ticketId]);

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-infinity-600" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-slate-50">
      <AppHeader title={data ? `Soporte ${data.ticket.codigo}` : "Detalle de soporte"} />
      <main className="max-w-4xl mx-auto p-4 space-y-4">
        <Link
          href={`/supervisor/clientes/${id}/soportes`}
          className="inline-flex items-center gap-1 text-sm text-infinity-600 hover:underline"
        >
          <ArrowLeft className="w-4 h-4" /> Volver al historial
        </Link>
        {error && <div className="bg-red-50 text-red-700 p-3 rounded-xl text-sm">{error}</div>}
        {data && (
          <>
            <section className="bg-white rounded-xl border p-4 space-y-3">
              <h2 className="font-semibold">Información general</h2>
              <div className="grid sm:grid-cols-2 gap-3">
                <Campo label="Número de ticket" value={data.ticket.codigo} />
                <Campo label="Fecha de creación" value={formatDateTime(data.ticket.createdAt)} />
                <Campo label="Cliente" value={data.cliente.nombre} />
                <Campo label="Dirección" value={data.cliente.direccion} />
                <Campo label="Teléfono" value={data.cliente.telefono} />
                <Campo label="Plan contratado" value={data.cliente.plan} />
                <Campo label="Técnico asignado" value={data.ticket.tecnicosLabel} />
                <Campo label="Estado" value={ESTADO_LABELS[data.ticket.estado] ?? data.ticket.estado} />
                <Campo label="Prioridad" value={PRIORIDAD_LABELS[data.ticket.prioridad] ?? data.ticket.prioridad} />
                <Campo
                  label="Fecha y hora de asignación"
                  value={data.ticket.asignadoEn ? formatDateTime(data.ticket.asignadoEn) : "—"}
                />
                <Campo label="Tipo" value={TIPO_LABELS[data.ticket.tipo] ?? data.ticket.tipo} />
                <Campo label="Resultado" value={data.ticket.resultado} />
              </div>
            </section>

            <section className="bg-white rounded-xl border p-4 space-y-3">
              <h2 className="font-semibold">Información de atención</h2>
              <div className="grid sm:grid-cols-2 gap-3">
                <Campo
                  label="Hora de llegada"
                  value={data.atencion.horaLlegada ? formatDateTime(data.atencion.horaLlegada) : "—"}
                />
                <Campo
                  label="Hora de inicio"
                  value={data.atencion.horaInicio ? formatDateTime(data.atencion.horaInicio) : "—"}
                />
                <Campo
                  label="Hora de finalización"
                  value={data.atencion.horaFin ? formatDateTime(data.atencion.horaFin) : "—"}
                />
                <Campo
                  label="Duración total"
                  value={
                    data.atencion.duracionSegundos > 0
                      ? formatDuration(data.atencion.duracionSegundos)
                      : "—"
                  }
                />
                <Campo label="Problema reportado por cliente" value={data.atencion.problemaReportado} />
                <Campo label="Diagnóstico" value={data.atencion.diagnostico} />
              </div>
              <Campo label="Trabajo realizado / solución aplicada" value={data.atencion.trabajoRealizado} />
              <Campo label="Observaciones" value={data.atencion.observaciones} />
            </section>

            {data.equipos.length > 0 && (
              <section className="bg-white rounded-xl border p-4 space-y-3">
                <h2 className="font-semibold">Equipos</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-[11px] uppercase text-slate-500">
                      <tr>
                        <th className="p-2">Equipo</th>
                        <th className="p-2">Marca</th>
                        <th className="p-2">Modelo</th>
                        <th className="p-2">Serie / MAC</th>
                        <th className="p-2">Cantidad</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.equipos.map((eq) => (
                        <tr key={eq.id} className="border-t">
                          <td className="p-2">{eq.inventario.nombre}</td>
                          <td className="p-2">{eq.marca || "—"}</td>
                          <td className="p-2">{eq.modelo || "—"}</td>
                          <td className="p-2">{eq.serie || "—"}</td>
                          <td className="p-2">{eq.cantidad}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            <MaterialesReporte
              materiales={[...data.equipos, ...data.materiales]}
              tipoTicket={data.ticket.tipo}
            />

            <section className="bg-white rounded-xl border p-4 space-y-4">
              <h2 className="font-semibold">Evidencia</h2>
              <PhotoGallery titulo="Fotos antes" fotos={data.evidencia.antes} />
              <PhotoGallery titulo="Fotos durante" fotos={data.evidencia.durante} />
              <PhotoGallery titulo="Fotos después" fotos={data.evidencia.despues} />
              <PhotoGallery titulo="Otras fotografías" fotos={data.evidencia.otras} />
              {data.evidencia.antes.length +
                data.evidencia.durante.length +
                data.evidencia.despues.length +
                data.evidencia.otras.length ===
                0 && <p className="text-sm text-slate-500">Sin fotografías vinculadas a este ticket.</p>}
            </section>

            <section className="bg-white rounded-xl border p-4 space-y-3">
              <h2 className="font-semibold">Cierre</h2>
              <Campo label="Reporte final del técnico" value={data.cierre.reporteFinal} />
              <Campo
                label="Fecha de cierre"
                value={data.cierre.fechaCierre ? formatDateTime(data.cierre.fechaCierre) : "—"}
              />
              <Campo label="Técnico que cerró" value={data.cierre.tecnicoCerro} />
              <Campo label="Observaciones finales" value={data.cierre.observaciones} />
              <Campo
                label="Calificación del servicio"
                value={
                  data.cierre.calificacion
                    ? `${data.cierre.calificacion.calificacion}/5${
                        data.cierre.calificacion.comentario
                          ? ` — ${data.cierre.calificacion.comentario}`
                          : ""
                      }`
                    : "Sin calificación registrada"
                }
              />
              {data.cierre.firma && <FirmaReporte firma={data.cierre.firma} />}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
