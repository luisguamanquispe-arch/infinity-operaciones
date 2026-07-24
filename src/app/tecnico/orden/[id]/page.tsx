"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Phone, MapPin, CalendarClock } from "lucide-react";
import { Cronometro } from "@/components/Cronometro";
import { PhotoCapture } from "@/components/PhotoCapture";
import { SignatureCapture } from "@/components/SignatureCapture";
import {
  InstalacionOrdenSection,
  instalacionFormVacio,
  type InstalacionFormState,
} from "@/components/tecnico/InstalacionOrdenSection";
import { NovedadSoportePanel } from "@/components/tecnico/NovedadSoportePanel";
import { EnviarReporteSoporte } from "@/components/tecnico/EnviarReporteSoporte";
import { TIPO_LABELS, ESTADO_LABELS, formatDateTime, formatDuration } from "@/lib/utils";
import { fetchWithRetry } from "@/lib/compress-image";
import {
  materialEsPatchcord,
  materialRequiereDetalle,
  TIPO_PATCHCORD_LABELS,
  TIPOS_PATCHCORD,
  tipoInventarioEfectivo,
} from "@/lib/material-detalle";
import type { MotivoInfraestructura, TipoConexionInstalacion, TipoInventario, TipoPatchCord } from "@prisma/client";
import {
  esTicketInfraestructura,
  FOTOS_ANTES_INFRA,
  FOTOS_DURANTE_INFRA,
  FOTOS_FINAL_INFRA,
  MOTIVO_INFRA_LABELS,
} from "@/lib/ticket-infraestructura";
import {
  esTicketInstalacion,
  FOTOS_ANTES_INSTALACION,
  FOTOS_DURANTE_INSTALACION,
  FOTOS_FINAL_INSTALACION,
} from "@/lib/ticket-instalacion";
import {
  FOTOS_ANTES_DEFAULT,
  FOTOS_DURANTE_DEFAULT,
  FOTOS_FINAL_DEFAULT,
} from "@/lib/fotos-ticket";
import {
  calcularExcedenteMaterial,
  esFibraDropCliente,
  FIBRA_DROP_LIMITE_M,
} from "@/lib/fibra-excedente";

interface MaterialForm {
  inventarioId: string;
  cantidad: string;
  serie: string;
  modelo: string;
  marca: string;
  tipoPatchCord: TipoPatchCord | "";
}

function materialVacio(): MaterialForm {
  return {
    inventarioId: "",
    cantidad: "",
    serie: "",
    modelo: "",
    marca: "",
    tipoPatchCord: "",
  };
}

interface OrdenData {
  ticket: {
    id: string;
    codigo: string;
    tipo: string;
    estado: string;
    ordenCerrada?: boolean;
    editable?: boolean;
    motivo: string | null;
    descripcion: string | null;
    motivoInfraestructura: MotivoInfraestructura | null;
    nodoAfectado: string | null;
    zonaInfra: string | null;
    programadoEn: string | null;
    cliente: {
      nombre: string;
      cedula: string;
      telefono: string;
      plan: string;
      direccion: string;
      sector: string;
      lat: number | null;
      lng: number | null;
      nodo: string | null;
      referencia: string | null;
      potencia: number | null;
    };
  };
  orden: {
    servicioOk: boolean;
    potenciaOk: boolean;
    fotosOk: boolean;
    clienteConforme: boolean;
    firmaOk: boolean;
    tipoConexionInstalacion: TipoConexionInstalacion | null;
    direccionIp: string | null;
    pppoeUsuario: string | null;
    pppoeClave: string | null;
    nombreRedWifi: string | null;
    claveRedWifi: string | null;
    resumenTrabajo: string | null;
    whatsappEnviado?: boolean;
    reporteEnviadoWhatsapp?: boolean;
    reporteEnviadoEmail?: boolean;
    correoReporte?: string | null;
    cronometro: {
      inicio: string | null;
      fin: string | null;
      activo: boolean;
      pausado: boolean;
    } | null;
    medicion: {
      rxDbm: number;
      txDbm: number;
      pingMs: number | null;
      downloadMbps: number;
      uploadMbps: number;
    } | null;
    fotografias: { tipo: string; url: string }[];
    firma: {
      imagenUrl: string;
      imagenSrc?: string;
      nombreCliente: string;
      cedula: string;
      aceptacionCondiciones?: boolean;
      textoAceptacion?: string | null;
    } | null;
    materiales: {
      inventarioId: string;
      cantidad: number;
      serie: string | null;
      modelo: string | null;
      marca: string | null;
      tipoPatchCord: TipoPatchCord | null;
      excedenteMetros: number | null;
      inventario: { nombre: string; tipo: TipoInventario; unidad: string };
    }[];
  };
  duracionSegundos: number;
  inventario: { id: string; nombre: string; unidad: string; stock: number; tipo: TipoInventario }[];
  reporte?: {
    multiTecnico: boolean;
    puedeEditar: boolean;
    esReportador: boolean;
    reportadoPor: { id: string; nombre: string } | null;
    reportadoEn: string | null;
    mensaje: string | null;
  } | null;
  novedadPendiente?: {
    id: string;
    tipo: string;
    tipoLabel: string;
    comentario: string | null;
    fechaSolicitada: string | null;
    createdAt: string;
  } | null;
}

const FOTOS_ANTES = FOTOS_ANTES_DEFAULT;
const FOTOS_DURANTE = FOTOS_DURANTE_DEFAULT;
const FOTOS_FINAL = FOTOS_FINAL_DEFAULT;

export default function OrdenPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<OrdenData | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const initialLoadedRef = useRef(false);
  const abrirHecho = useRef(false);
  const cargandoRef = useRef(false);
  const [cerrando, setCerrando] = useState(false);
  const [error, setError] = useState("");

  const [medicion, setMedicion] = useState({
    rxDbm: "",
    txDbm: "",
    pingMs: "",
    downloadMbps: "",
    uploadMbps: "",
  });

  const [materiales, setMateriales] = useState<MaterialForm[]>([materialVacio()]);
  const [materialError, setMaterialError] = useState("");
  const [instalacionError, setInstalacionError] = useState("");

  const [instalacion, setInstalacion] = useState<InstalacionFormState>(instalacionFormVacio());

  const [checklist, setChecklist] = useState({
    servicioOk: false,
    potenciaOk: false,
    fotosOk: false,
    clienteConforme: false,
    firmaOk: false,
  });
  const [resumenTrabajo, setResumenTrabajo] = useState("");
  const resumenTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const aplicarDatosFormulario = useCallback((d: OrdenData) => {
    if (d.orden.medicion) {
      setMedicion({
        rxDbm: String(d.orden.medicion.rxDbm),
        txDbm: String(d.orden.medicion.txDbm),
        pingMs: String(d.orden.medicion.pingMs ?? ""),
        downloadMbps: String(d.orden.medicion.downloadMbps),
        uploadMbps: String(d.orden.medicion.uploadMbps),
      });
    }
    setChecklist({
      servicioOk: d.orden.servicioOk ?? false,
      potenciaOk: d.orden.potenciaOk ?? false,
      fotosOk: d.orden.fotosOk ?? false,
      clienteConforme: d.orden.clienteConforme ?? false,
      firmaOk: d.orden.firmaOk ?? false,
    });
    setResumenTrabajo(d.orden.resumenTrabajo ?? "");
    if (d.orden.materiales?.length) {
      setMateriales(
        d.orden.materiales.map(
          (m: OrdenData["orden"]["materiales"][number]): MaterialForm => ({
            inventarioId: m.inventarioId,
            cantidad: String(m.cantidad),
            serie: m.serie ?? "",
            modelo: m.modelo ?? "",
            marca: m.marca ?? "",
            tipoPatchCord: m.tipoPatchCord ?? "",
          })
        )
      );
    }
    setInstalacion({
      tipoConexion: d.orden.tipoConexionInstalacion ?? "",
      direccionIp: d.orden.direccionIp ?? "",
      pppoeUsuario: d.orden.pppoeUsuario ?? "",
      pppoeClave: d.orden.pppoeClave ?? "",
      nombreRedWifi: d.orden.nombreRedWifi ?? "",
      claveRedWifi: d.orden.claveRedWifi ?? "",
    });
  }, []);

  const cargar = useCallback(async (opts?: { silent?: boolean }): Promise<boolean> => {
    const silent = opts?.silent ?? initialLoadedRef.current;
    if (cargandoRef.current && silent) return initialLoadedRef.current;
    cargandoRef.current = true;

    if (!silent) setLoading(true);
    if (!silent) setError("");
    try {
      const res = await fetchWithRetry(
        `/api/tickets/${id}`,
        { method: "GET", cache: "no-store" },
        3
      );
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (!silent) {
          setData(null);
          setError(
            res.status === 403
              ? "No tiene acceso a esta orden. Verifique que el ticket esté asignado a usted."
              : res.status === 503
                ? "El servidor está iniciando. Espere unos segundos e intente de nuevo."
                : d.error || "No se pudo cargar la orden"
          );
        }
        return false;
      }
      if (!d.ticket || !d.orden) {
        if (!silent) {
          setData(null);
          setError("Respuesta inválida del servidor");
        }
        return false;
      }
      setData(d);
      if (!silent) {
        aplicarDatosFormulario(d);
      }
      if (!initialLoadedRef.current) {
        initialLoadedRef.current = true;
        setInitialLoaded(true);
      }
      return true;
    } catch {
      if (!silent) {
        setData(null);
        setError("Sin conexión. Verifique internet e intente de nuevo.");
      }
      return false;
    } finally {
      cargandoRef.current = false;
      if (!silent) setLoading(false);
    }
  }, [id, aplicarDatosFormulario]);

  const refrescar = useCallback(() => {
    void cargar({ silent: true });
  }, [cargar]);

  useEffect(() => {
    abrirHecho.current = false;
    initialLoadedRef.current = false;
    setInitialLoaded(false);
    setData(null);
    setLoading(true);
    void cargar();
  }, [id, cargar]);

  useEffect(() => {
    if (!initialLoaded || !data || abrirHecho.current) return;

    const cerrado = ["CERRADO", "FINALIZADO", "CANCELADO"].includes(data.ticket.estado);
    if (cerrado) return;

    abrirHecho.current = true;

    async function abrirOrden() {
      const gps = await new Promise<{ lat: number; lng: number }>((resolve) => {
        if (!navigator.geolocation) {
          resolve({ lat: -1.2491, lng: -78.6168 });
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          () => resolve({ lat: -1.2491, lng: -78.6168 }),
          { enableHighAccuracy: true, timeout: 5000 }
        );
      });

      try {
        await fetch(`/api/tickets/${id}/abrir`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(gps),
        });
      } catch {
        // El técnico puede iniciar el cronómetro manualmente si falla.
      }
      await cargar({ silent: true });
    }

    void abrirOrden();
  }, [initialLoaded, data?.ticket.estado, id, cargar]);

  async function guardarMedicion() {
    await fetch(`/api/tickets/${id}/medicion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(medicion),
    });
    refrescar();
  }

  async function guardarInstalacion() {
    setInstalacionError("");
    const res = await fetch(`/api/tickets/${id}/medicion`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instalacion }),
    });
    const result = await res.json();
    if (!res.ok) {
      setInstalacionError(result.error || "No se pudo guardar los datos de instalación");
      return;
    }
    refrescar();
  }

  async function guardarMateriales() {
    setMaterialError("");
    const validos = materiales.filter((m) => m.inventarioId && m.cantidad);
    if (validos.length === 0) return;

    const res = await fetch(`/api/tickets/${id}/medicion`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ materiales: validos }),
    });
    const result = await res.json();
    if (!res.ok) {
      setMaterialError(result.error || "No se pudo guardar el material");
      return;
    }
    refrescar();
  }

  function nombreMaterial(inventarioId: string): string {
    return data?.inventario.find((i) => i.id === inventarioId)?.nombre ?? "";
  }

  function tipoMaterialSeleccionado(inventarioId: string): TipoInventario | null {
    const inv = data?.inventario.find((i) => i.id === inventarioId);
    if (!inv) return null;
    return tipoInventarioEfectivo(inv.tipo, inv.nombre);
  }

  function actualizarMaterial(i: number, patch: Partial<MaterialForm>) {
    setMateriales((prev) => {
      const updated = [...prev];
      updated[i] = { ...updated[i], ...patch };
      return updated;
    });
  }

  async function actualizarChecklist(key: keyof typeof checklist, value: boolean) {
    const updated = { ...checklist, [key]: value };
    setChecklist(updated);
    await fetch(`/api/tickets/${id}/medicion`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checklist: updated }),
    });
  }

  function onChangeResumen(value: string) {
    setResumenTrabajo(value);
    if (resumenTimer.current) clearTimeout(resumenTimer.current);
    resumenTimer.current = setTimeout(() => {
      void fetch(`/api/tickets/${id}/medicion`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumenTrabajo: value }),
      });
    }, 600);
  }

  async function cerrarTicket() {
    setCerrando(true);
    setError("");
    // Persistir resumen antes de validar cierre
    await fetch(`/api/tickets/${id}/medicion`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resumenTrabajo }),
    });
    const res = await fetch(`/api/tickets/${id}/cerrar`, { method: "POST" });
    const result = await res.json();
    if (!res.ok) {
      setError(result.errores?.join(", ") || result.error);
      setCerrando(false);
      return;
    }
    await cargar({ silent: true });
    setCerrando(false);
  }

  if (!initialLoaded && loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-infinity-600" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-dvh bg-slate-50 flex flex-col">
        <header className="bg-infinity-800 text-white px-4 py-4">
          <div className="max-w-3xl mx-auto flex items-center gap-3">
            <Link href="/tecnico" className="p-1 hover:bg-white/10 rounded-lg">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="font-bold">Orden de trabajo</h1>
          </div>
        </header>
        <main className="flex-1 flex flex-col items-center justify-center p-6 gap-4">
          <p className="text-center text-slate-700 max-w-sm">{error}</p>
          <button
            type="button"
            onClick={() => void cargar()}
            className="px-4 py-2 bg-infinity-600 text-white rounded-lg font-medium"
          >
            Reintentar
          </button>
          <Link href="/tecnico" className="text-sm text-infinity-600 hover:underline">
            Volver al panel
          </Link>
        </main>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const { ticket, orden, reporte } = data;
  const fotoMap = Object.fromEntries(orden.fotografias.map((f) => [f.tipo, f]));
  const cerrado = ticket.estado === "CERRADO" || !!ticket.ordenCerrada;
  const puedeEditar =
    ticket.editable !== false && reporte?.puedeEditar !== false && !cerrado;
  const esInfra = esTicketInfraestructura(ticket.tipo);
  const esInstalacion = esTicketInstalacion(ticket.tipo);
  const fotosAntes = esInfra
    ? FOTOS_ANTES_INFRA
    : esInstalacion
      ? FOTOS_ANTES_INSTALACION
      : FOTOS_ANTES;
  const fotosDurante = esInfra
    ? FOTOS_DURANTE_INFRA
    : esInstalacion
      ? FOTOS_DURANTE_INSTALACION
      : FOTOS_DURANTE;
  const fotosFinal = esInfra ? FOTOS_FINAL_INFRA : FOTOS_FINAL;
  const checklistItems = esInfra
    ? [
        { key: "servicioOk" as const, label: "Infraestructura restablecida" },
        { key: "potenciaOk" as const, label: "Enlaces / nodo validados" },
        { key: "fotosOk" as const, label: "Fotos cargadas" },
      ]
    : [
        { key: "servicioOk" as const, label: "Servicio funcionando" },
        { key: "potenciaOk" as const, label: "Potencia validada" },
        { key: "fotosOk" as const, label: "Fotos cargadas" },
        { key: "clienteConforme" as const, label: "Cliente conforme" },
        { key: "firmaOk" as const, label: "Firma registrada" },
      ];

  return (
    <div className="min-h-dvh bg-slate-50 pb-8">
      <header className="bg-infinity-800 text-white px-4 py-4 sticky top-0 z-50">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <Link href="/tecnico" className="p-1 hover:bg-white/10 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="font-bold">{ticket.codigo}</h1>
            <p className="text-infinity-200 text-sm">
              {TIPO_LABELS[ticket.tipo]} — {ESTADO_LABELS[ticket.estado]}
              {esInstalacion && (
                <span className="ml-2 inline-block px-2 py-0.5 rounded bg-sky-500/30 text-sky-100 text-xs font-semibold">
                  Nueva instalación
                </span>
              )}
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 space-y-4">
        {reporte?.mensaje && (
          <section
            className={`rounded-xl border p-4 ${
              cerrado
                ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                : puedeEditar
                  ? "bg-infinity-50 border-infinity-200 text-infinity-900"
                  : "bg-amber-50 border-amber-200 text-amber-900"
            }`}
          >
            <p className="font-semibold">
              {cerrado ? "Reporte ya registrado" : "Ticket con varios técnicos"}
            </p>
            <p className="text-sm mt-1">{reporte.mensaje}</p>
            {data.duracionSegundos > 0 && (
              <p className="text-sm mt-2 font-medium">
                Tiempo registrado: {formatDuration(data.duracionSegundos)}
              </p>
            )}
          </section>
        )}

        {ticket.programadoEn && !cerrado && (
          <section className="bg-infinity-50 border border-infinity-200 rounded-xl p-4 flex gap-3">
            <CalendarClock className="w-6 h-6 text-infinity-600 shrink-0" />
            <div>
              <p className="font-semibold text-infinity-900">Reparación programada</p>
              <p className="text-lg font-bold text-infinity-700">
                {formatDateTime(ticket.programadoEn)}
              </p>
              <p className="text-sm text-infinity-800 mt-1">
                Inicie la reparación en la fecha y hora indicadas por el supervisor.
              </p>
            </div>
          </section>
        )}

        <NovedadSoportePanel
          ticketId={ticket.id}
          cerrado={cerrado}
          esInfra={esInfra}
          novedadPendiente={data.novedadPendiente ?? null}
          onReportada={refrescar}
        />

        {/* Datos del cliente / sitio */}
        <section className={`bg-white rounded-xl border p-4 space-y-2 ${esInfra ? "border-violet-200 bg-violet-50/30" : esInstalacion ? "border-sky-200 bg-sky-50/30" : ""}`}>
          {esInfra ? (
            <>
              <h2 className="font-semibold text-lg text-violet-900">Infraestructura — {ticket.codigo}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                <p>
                  <span className="text-slate-500">Incidente:</span>{" "}
                  {ticket.motivoInfraestructura
                    ? MOTIVO_INFRA_LABELS[ticket.motivoInfraestructura]
                    : ticket.motivo}
                </p>
                <p>
                  <span className="text-slate-500">Nodo:</span> {ticket.nodoAfectado || "—"}
                </p>
                {ticket.zonaInfra && (
                  <p>
                    <span className="text-slate-500">Zona:</span> {ticket.zonaInfra}
                  </p>
                )}
              </div>
            </>
          ) : (
            <>
              <h2 className="font-semibold text-lg">{ticket.cliente.nombre}</h2>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <p><span className="text-slate-500">Cédula:</span> {ticket.cliente.cedula}</p>
                <p className="flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  <a href={`tel:${ticket.cliente.telefono}`} className="text-infinity-600">
                    {ticket.cliente.telefono}
                  </a>
                </p>
                <p><span className="text-slate-500">Plan:</span> {ticket.cliente.plan}</p>
                <p><span className="text-slate-500">Sector:</span> {ticket.cliente.sector}</p>
              </div>
              <p className="text-sm flex items-start gap-1">
                <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
                {ticket.cliente.direccion}
              </p>
              {ticket.cliente.referencia && (
                <p className="text-sm bg-amber-50 border border-amber-200 rounded-lg p-2">
                  <span className="text-slate-500 font-medium">Referencia: </span>
                  {ticket.cliente.referencia}
                </p>
              )}
              <div className="grid grid-cols-2 gap-2 text-sm pt-2 border-t">
                <p><span className="text-slate-500">Nodo:</span> {ticket.cliente.nodo || "—"}</p>
                <p><span className="text-slate-500">Potencia:</span> {ticket.cliente.potencia ? `${ticket.cliente.potencia} dBm` : "—"}</p>
              </div>
            </>
          )}
        </section>

        {/* Info técnica */}
        <section className="bg-white rounded-xl border p-4 space-y-2">
          <h3 className="font-semibold">Información técnica</h3>
          <p className="text-sm"><span className="text-slate-500">Motivo:</span> {ticket.motivo}</p>
          <p className="text-sm"><span className="text-slate-500">Descripción:</span> {ticket.descripcion}</p>
        </section>

        {!cerrado && (
          <>
            <Cronometro
              ticketId={id}
              cronometro={orden.cronometro}
              duracionInicial={data.duracionSegundos}
              onUpdate={refrescar}
              readOnly={!puedeEditar}
            />

            {esInstalacion && puedeEditar && (
              <InstalacionOrdenSection
                instalacion={instalacion}
                onChange={setInstalacion}
                onSave={guardarInstalacion}
                error={instalacionError || undefined}
              />
            )}

            {esInstalacion && !puedeEditar && (
              <InstalacionOrdenSection
                instalacion={instalacion}
                onChange={setInstalacion}
                onSave={() => {}}
                readOnly
                showClausulas={false}
              />
            )}

            {puedeEditar ? (
              <>
            {/* Fotos antes */}
            <section className="bg-white rounded-xl border p-4 space-y-2">
              <h3 className="font-semibold">Evidencia — Antes de iniciar</h3>
              {fotosAntes.map((t) => (
                <PhotoCapture
                  key={t}
                  ticketId={id}
                  tipo={t}
                  existing={fotoMap[t]}
                  onUploaded={refrescar}
                />
              ))}
            </section>

            <section className="bg-white rounded-xl border p-4 space-y-2">
              <h3 className="font-semibold">Evidencia — Durante reparación</h3>
              {fotosDurante.map((t) => (
                <PhotoCapture
                  key={t}
                  ticketId={id}
                  tipo={t}
                  existing={fotoMap[t]}
                  onUploaded={refrescar}
                />
              ))}
            </section>

            {!esInfra && (
            <section className="bg-white rounded-xl border p-4 space-y-3">
              <h3 className="font-semibold">Medición técnica</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: "rxDbm", label: "Potencia RX (dBm)" },
                  { key: "txDbm", label: "Potencia TX (dBm)" },
                  { key: "pingMs", label: "Ping (ms)" },
                  { key: "downloadMbps", label: "Descarga (Mbps)" },
                  { key: "uploadMbps", label: "Subida (Mbps)" },
                ].map(({ key, label }) => (
                  <div key={key}>
                    <label className="text-xs text-slate-500">{label}</label>
                    <input
                      type="number"
                      step="any"
                      value={medicion[key as keyof typeof medicion]}
                      onChange={(e) =>
                        setMedicion({ ...medicion, [key]: e.target.value })
                      }
                      className="w-full px-3 py-2 border rounded-lg text-sm mt-0.5"
                    />
                  </div>
                ))}
              </div>
              <button
                onClick={guardarMedicion}
                className="w-full py-2 bg-infinity-600 text-white rounded-lg text-sm font-medium"
              >
                Guardar medición
              </button>
            </section>
            )}

            {/* Materiales */}
            <section className="bg-white rounded-xl border p-4 space-y-3">
              <h3 className="font-semibold">Material utilizado</h3>
              <p className="text-xs text-slate-500">
                Caja NAP, pigtails, patch cord y equipos requieren serie, modelo y marca.
                Cable drop / fibra droop: incluye {FIBRA_DROP_LIMITE_M} m; el excedente se marca en
                rojo para revisar cobro.
              </p>
              {materiales.map((m, i) => {
                const nombreMat = nombreMaterial(m.inventarioId);
                const invItem = data.inventario.find((x) => x.id === m.inventarioId);
                const tipoMat = tipoMaterialSeleccionado(m.inventarioId);
                const requiereDetalle = tipoMat ? materialRequiereDetalle(tipoMat, nombreMat) : false;
                const esPatchcord = tipoMat ? materialEsPatchcord(tipoMat, nombreMat) : false;
                const excedenteFibra =
                  !esInfra && nombreMat
                    ? calcularExcedenteMaterial(nombreMat, m.cantidad, false)
                    : 0;
                const esFibraDrop = !esInfra && esFibraDropCliente(nombreMat);

                return (
                  <div key={i} className="space-y-2 border border-slate-100 rounded-lg p-3">
                    <div className="flex gap-2">
                      <select
                        value={m.inventarioId}
                        onChange={(e) =>
                          actualizarMaterial(i, {
                            inventarioId: e.target.value,
                            serie: "",
                            modelo: "",
                            marca: "",
                            tipoPatchCord: "",
                          })
                        }
                        className="flex-1 px-3 py-2 border rounded-lg text-sm"
                      >
                        <option value="">Seleccionar material</option>
                        {data.inventario.map((inv) => (
                          <option key={inv.id} value={inv.id}>
                            {inv.nombre} (stock: {inv.stock} {inv.unidad})
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        placeholder={invItem?.unidad === "m" ? "Metros" : "Cant."}
                        value={m.cantidad}
                        onChange={(e) => actualizarMaterial(i, { cantidad: e.target.value })}
                        className={`w-24 px-3 py-2 border rounded-lg text-sm ${
                          excedenteFibra > 0
                            ? "border-red-500 bg-red-50 text-red-700 font-semibold"
                            : ""
                        }`}
                      />
                    </div>

                    {esFibraDrop && m.cantidad && (
                      <p
                        className={`text-xs ${
                          excedenteFibra > 0
                            ? "text-red-700 font-semibold bg-red-50 border border-red-200 rounded-lg p-2"
                            : "text-slate-500"
                        }`}
                      >
                        {excedenteFibra > 0 ? (
                          <>
                            Excedente:{" "}
                            <span className="text-red-700 font-bold">{excedenteFibra} m</span> sobre{" "}
                            {FIBRA_DROP_LIMITE_M} m incluidos — revisar si se cobra al cliente
                          </>
                        ) : (
                          <>Hasta {FIBRA_DROP_LIMITE_M} m incluidos en el plan</>
                        )}
                      </p>
                    )}

                    {requiereDetalle && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <input
                          type="text"
                          placeholder="Serie *"
                          value={m.serie}
                          onChange={(e) => actualizarMaterial(i, { serie: e.target.value })}
                          className="px-3 py-2 border rounded-lg text-sm uppercase"
                        />
                        <input
                          type="text"
                          placeholder="Modelo *"
                          value={m.modelo}
                          onChange={(e) => actualizarMaterial(i, { modelo: e.target.value })}
                          className="px-3 py-2 border rounded-lg text-sm uppercase"
                        />
                        <input
                          type="text"
                          placeholder="Marca *"
                          value={m.marca}
                          onChange={(e) => actualizarMaterial(i, { marca: e.target.value })}
                          className="px-3 py-2 border rounded-lg text-sm uppercase"
                        />
                      </div>
                    )}

                    {esPatchcord && (
                      <select
                        value={m.tipoPatchCord}
                        onChange={(e) =>
                          actualizarMaterial(i, {
                            tipoPatchCord: e.target.value as TipoPatchCord | "",
                          })
                        }
                        className="w-full px-3 py-2 border rounded-lg text-sm"
                      >
                        <option value="">Tipo patch cord *</option>
                        {TIPOS_PATCHCORD.map((t) => (
                          <option key={t} value={t}>
                            {TIPO_PATCHCORD_LABELS[t]}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                );
              })}
              <button
                onClick={() => setMateriales([...materiales, materialVacio()])}
                className="text-sm text-infinity-600"
              >
                + Agregar material
              </button>
              {materialError && (
                <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg">{materialError}</div>
              )}
              <button
                onClick={guardarMateriales}
                className="w-full py-2 border border-infinity-600 text-infinity-600 rounded-lg text-sm font-medium"
              >
                Descontar del inventario
              </button>
            </section>

            {/* Fotos final */}
            <section className="bg-white rounded-xl border p-4 space-y-2">
              <h3 className="font-semibold">Evidencia — Al finalizar</h3>
              {fotosFinal.map((t) => (
                <PhotoCapture
                  key={t}
                  ticketId={id}
                  tipo={t}
                  existing={fotoMap[t]}
                  onUploaded={refrescar}
                />
              ))}
            </section>

            {!esInfra && (
            <SignatureCapture
              ticketId={id}
              existing={orden.firma}
              clienteNombre={ticket.cliente.nombre}
              clienteCedula={ticket.cliente.cedula}
              onSaved={refrescar}
            />
            )}

            <EnviarReporteSoporte
              ticketId={id}
              resumenTrabajo={resumenTrabajo}
              cerrado={false}
              onResumenChange={onChangeResumen}
            />

            {/* Checklist y cierre */}
            <section className="bg-white rounded-xl border p-4 space-y-3">
              <h3 className="font-semibold">Checklist de cierre</h3>
              {checklistItems.map(({ key, label }) => (
                <label key={key} className="flex items-center gap-3 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checklist[key]}
                    onChange={(e) => actualizarChecklist(key, e.target.checked)}
                    className="w-4 h-4 rounded"
                  />
                  {label}
                </label>
              ))}

              {error && (
                <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg">{error}</div>
              )}

              <button
                onClick={cerrarTicket}
                disabled={cerrando}
                className="w-full py-3 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 disabled:opacity-50"
              >
                {cerrando ? "Cerrando..." : "✅ Cerrar ticket"}
              </button>
            </section>
              </>
            ) : (
              <>
                <section className="bg-white rounded-xl border p-4 space-y-2">
                  <h3 className="font-semibold">Evidencia registrada</h3>
                  {[...fotosAntes, ...fotosDurante, ...fotosFinal].map((t) => (
                    <PhotoCapture
                      key={t}
                      ticketId={id}
                      tipo={t}
                      existing={fotoMap[t]}
                      onUploaded={refrescar}
                      readOnly
                    />
                  ))}
                </section>

                {orden.medicion && !esInfra && (
                  <section className="bg-white rounded-xl border p-4 space-y-2">
                    <h3 className="font-semibold">Medición registrada</h3>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <p>RX: {orden.medicion.rxDbm} dBm</p>
                      <p>TX: {orden.medicion.txDbm} dBm</p>
                      {orden.medicion.pingMs != null && <p>Ping: {orden.medicion.pingMs} ms</p>}
                      <p>Descarga: {orden.medicion.downloadMbps} Mbps</p>
                      <p>Subida: {orden.medicion.uploadMbps} Mbps</p>
                    </div>
                  </section>
                )}

                {orden.materiales.length > 0 && (
                  <section className="bg-white rounded-xl border p-4 space-y-2">
                    <h3 className="font-semibold">Material utilizado</h3>
                    {orden.materiales.map((m, i) => (
                      <p key={i} className="text-sm">
                        {m.inventario.nombre}: {m.cantidad} {m.inventario.unidad}
                      </p>
                    ))}
                  </section>
                )}

                {orden.firma && (
                  <section className="bg-white rounded-xl border p-4 space-y-2">
                    <h3 className="font-semibold mb-2">Firma y aceptación</h3>
                    <p className="text-sm text-slate-600">
                      {orden.firma.nombreCliente} — {orden.firma.cedula}
                    </p>
                    {orden.firma.aceptacionCondiciones && (
                      <p className="text-xs text-emerald-700 font-medium">
                        ✓ Cliente aceptó las condiciones del soporte técnico
                      </p>
                    )}
                  </section>
                )}
              </>
            )}
          </>
        )}

        {cerrado && (
          <>
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl text-center font-medium space-y-2">
              <p>✅ Ticket cerrado exitosamente</p>
              {data.duracionSegundos > 0 && (
                <p className="text-sm font-normal">
                  Tiempo registrado: {formatDuration(data.duracionSegundos)}
                </p>
              )}
            </div>
            <EnviarReporteSoporte
              ticketId={id}
              resumenTrabajo={orden.resumenTrabajo || resumenTrabajo}
              cerrado
            />
            {esInstalacion && instalacion.tipoConexion && (
              <InstalacionOrdenSection
                instalacion={instalacion}
                onChange={setInstalacion}
                onSave={() => {}}
                readOnly
                showClausulas
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
