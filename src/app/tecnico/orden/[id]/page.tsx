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
import { TIPO_LABELS, formatDateTime, formatDuration } from "@/lib/utils";
import { fetchWithRetry } from "@/lib/compress-image";
import { leerGpsActual } from "@/lib/gps-client";
import { useTecnicoGpsTracking } from "@/hooks/useTecnicoGpsTracking";
import { TicketSemaforo } from "@/components/TicketSemaforo";
import {
  etiquetasDetalleMaterial,
  materialEsCableOFibra,
  materialEsEquipoActivo,
  materialEsPatchcord,
  materialRequiereDetalle,
  TIPO_PATCHCORD_LABELS,
  TIPOS_PATCHCORD,
  tipoInventarioEfectivo,
} from "@/lib/material-detalle";
import type {
  MotivoInfraestructura,
  SiResultado,
  SiTipoTrabajo,
  TipoConexionInstalacion,
  TipoInventario,
  TipoPatchCord,
} from "@prisma/client";
import {
  esTicketInfraestructura,
  FOTOS_ANTES_INFRA,
  FOTOS_DURANTE_INFRA,
  FOTOS_FINAL_INFRA,
  MOTIVO_INFRA_LABELS,
  SI_RESULTADO_LABELS,
  SI_RESULTADOS,
  siTipoTrabajoTexto,
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
    estadoRevision?: string | null;
    motivo: string | null;
    descripcion: string | null;
    motivoInfraestructura: MotivoInfraestructura | null;
    siTipoTrabajo?: SiTipoTrabajo | null;
    siTipoTrabajoOtro?: string | null;
    nodoAfectado: string | null;
    zonaInfra: string | null;
    provincia?: string | null;
    canton?: string | null;
    parroquia?: string | null;
    sectorInfra?: string | null;
    direccionInfra?: string | null;
    referenciaInfra?: string | null;
    diagnosticoInfra?: string | null;
    trabajoRealizadoInfra?: string | null;
    resultadoInfra?: SiResultado | null;
    observacionesInfra?: string | null;
    tecnicoId?: string | null;
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
    fotografias: { id: string; tipo: string; url: string; imagenSrc?: string }[];
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
    fechaSolicitada?: string | null;
    createdAt?: string;
  } | null;
  esResponsableInfra?: boolean;
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
  /** F2/E3: errores de POST /abrir visibles (antes se tragaban). */
  const [abrirError, setAbrirError] = useState("");
  const [abrirRetry, setAbrirRetry] = useState(0);

  useTecnicoGpsTracking(true);

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
  const [diagnosticoInfra, setDiagnosticoInfra] = useState("");
  const [trabajoRealizadoInfra, setTrabajoRealizadoInfra] = useState("");
  const [resultadoInfra, setResultadoInfra] = useState<SiResultado | "">("");
  const [observacionesInfra, setObservacionesInfra] = useState("");
  const [comentarios, setComentarios] = useState<
    { id: string; texto: string; createdAt: string; tecnicoNombre: string }[]
  >([]);
  const [nuevoComentario, setNuevoComentario] = useState("");
  const [enviandoComentario, setEnviandoComentario] = useState(false);

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
    setDiagnosticoInfra(d.ticket.diagnosticoInfra ?? "");
    setTrabajoRealizadoInfra(d.ticket.trabajoRealizadoInfra ?? "");
    setResultadoInfra(d.ticket.resultadoInfra ?? "");
    setObservacionesInfra(d.ticket.observacionesInfra ?? "");
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

  /** Tras guardar firma: recarga completa para sincronizar checklist firmaOk/clienteConforme. */
  const refrescarTrasFirma = useCallback(() => {
    void cargar({ silent: false });
  }, [cargar]);

  useEffect(() => {
    abrirHecho.current = false;
    initialLoadedRef.current = false;
    setInitialLoaded(false);
    setData(null);
    setLoading(true);
    setAbrirError("");
    void cargar();
  }, [id, cargar]);

  useEffect(() => {
    if (!initialLoaded || !data || abrirHecho.current) return;

    const cerrado = ["CERRADO", "FINALIZADO", "CANCELADO"].includes(data.ticket.estado);
    if (cerrado) return;

    abrirHecho.current = true;

    async function abrirOrden() {
      const gps = await leerGpsActual({ timeoutMs: 8000, highAccuracy: true });

      try {
        const res = await fetch(`/api/tickets/${id}/abrir`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            gps ? { lat: gps.lat, lng: gps.lng } : { lat: null, lng: null }
          ),
        });
        const body = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
          detail?: string;
          yaCerrado?: boolean;
        };

        if (!res.ok || body.ok === false) {
          const msg =
            body.error ||
            (res.status === 403
              ? "No autorizado para abrir esta orden (¿asignación o reporte de otro técnico?)."
              : res.status === 503
                ? "No se pudo marcar como leída. El servidor puede estar migrando estados."
                : `No se pudo abrir la orden (HTTP ${res.status}).`);
          setAbrirError(msg);
          console.error("[abrir orden]", res.status, body);
        } else {
          setAbrirError("");
        }
      } catch (err) {
        const msg =
          err instanceof Error
            ? `Sin conexión al abrir la orden: ${err.message}`
            : "Sin conexión al marcar la orden como leída.";
        setAbrirError(msg);
        console.error("[abrir orden] red", err);
      }

      // Siempre refrescar: 403 multi-técnico trae mensaje de reporte en GET
      await cargar({ silent: true });
    }

    void abrirOrden();
  }, [initialLoaded, data?.ticket.estado, id, cargar, abrirRetry]);

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

  async function enviarCorreccion() {
    setCerrando(true);
    setError("");
    const body =
      data && esTicketInfraestructura(data.ticket.tipo)
        ? {
            diagnosticoInfra,
            trabajoRealizadoInfra,
            resultadoInfra: resultadoInfra || null,
            observacionesInfra: observacionesInfra || null,
          }
        : { resumenTrabajo, descripcion: data?.ticket.descripcion };
    const res = await fetch(`/api/tickets/${id}/revision/enviar-correccion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await res.json();
    if (!res.ok) {
      setError(result.errores?.join(", ") || result.error);
      setCerrando(false);
      return;
    }
    setCerrando(false);
    router.push(`/tecnico?cerrado=${encodeURIComponent(data?.ticket.codigo || id)}`);
  }

  async function cerrarTicket() {
    if (data?.ticket.estadoRevision === "DEVUELTO_CORRECCION") {
      return enviarCorreccion();
    }
    setCerrando(true);
    setError("");
    if (data && esTicketInfraestructura(data.ticket.tipo)) {
      const res = await fetch(`/api/tickets/${id}/cerrar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          diagnosticoInfra,
          trabajoRealizadoInfra,
          resultadoInfra: resultadoInfra || null,
          observacionesInfra: observacionesInfra || null,
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        setError(result.errores?.join(", ") || result.error);
        setCerrando(false);
        return;
      }
      setCerrando(false);
      router.push(`/tecnico?cerrado=${encodeURIComponent(data.ticket.codigo || id)}`);
      return;
    }
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
    setCerrando(false);
    router.push(`/tecnico?cerrado=${encodeURIComponent(data?.ticket.codigo || id)}`);
  }

  async function cargarComentarios() {
    try {
      const res = await fetch(`/api/tickets/${id}/comentarios-infra`);
      const d = await res.json();
      if (res.ok) setComentarios(d.comentarios || []);
    } catch {
      /* ignore */
    }
  }

  async function enviarComentario() {
    if (!nuevoComentario.trim()) return;
    setEnviandoComentario(true);
    try {
      const res = await fetch(`/api/tickets/${id}/comentarios-infra`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto: nuevoComentario }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error || "No se pudo enviar el comentario");
        return;
      }
      setNuevoComentario("");
      await cargarComentarios();
    } finally {
      setEnviandoComentario(false);
    }
  }

  useEffect(() => {
    if (data && esTicketInfraestructura(data.ticket.tipo)) {
      void cargarComentarios();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.ticket.id, data?.ticket.tipo]);

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
  const porCorregir = ticket.estadoRevision === "DEVUELTO_CORRECCION";
  const cerrado =
    !porCorregir && (ticket.estado === "CERRADO" || !!ticket.ordenCerrada);
  const puedeEditar =
    porCorregir ||
    (ticket.editable !== false && reporte?.puedeEditar !== false && !cerrado);
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

  const inventarioEquipos = data.inventario.filter(
    (inv) =>
      tipoInventarioEfectivo(inv.tipo, inv.nombre) === "EQUIPO" ||
      materialEsEquipoActivo(inv.nombre)
  );
  const inventarioCables = data.inventario.filter((inv) => materialEsCableOFibra(inv.nombre));
  const inventarioOtros = data.inventario.filter(
    (inv) =>
      !inventarioEquipos.some((e) => e.id === inv.id) &&
      !inventarioCables.some((c) => c.id === inv.id)
  );

  return (
    <div className="min-h-dvh bg-slate-50 pb-8">
      <header className="bg-infinity-800 text-white px-4 py-4 sticky top-0 z-50">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <Link href="/tecnico" className="p-1 hover:bg-white/10 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold">{ticket.codigo}</h1>
            <p className="text-infinity-200 text-sm">
              {TIPO_LABELS[ticket.tipo]}
              {esInstalacion && (
                <span className="ml-2 inline-block px-2 py-0.5 rounded bg-sky-500/30 text-sky-100 text-xs font-semibold">
                  Nueva instalación
                </span>
              )}
            </p>
            <div className="mt-1.5 [&_span.text-xs]:text-amber-100">
              <TicketSemaforo estado={ticket.estado} size="md" />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 space-y-4">
        {porCorregir && (
          <section className="rounded-xl border border-amber-300 bg-amber-50 text-amber-950 p-4">
            <p className="font-semibold">Reporte devuelto para corrección</p>
            <p className="text-sm mt-1">
              Puede corregir descripción, observaciones, materiales y fotografías.
              Luego pulse <strong>Enviar Corrección</strong>.
            </p>
          </section>
        )}
        {abrirError && (
          <section
            className="rounded-xl border border-red-200 bg-red-50 text-red-900 p-4"
            role="alert"
          >
            <p className="font-semibold">No se pudo registrar la apertura</p>
            <p className="text-sm mt-1">{abrirError}</p>
            <p className="text-xs mt-2 text-red-700/80">
              Puede seguir en la orden; si el semáforo no cambia a «Leído», reintente.
            </p>
            <button
              type="button"
              className="mt-3 text-sm font-semibold underline underline-offset-2"
              onClick={() => {
                setAbrirError("");
                abrirHecho.current = false;
                setAbrirRetry((n) => n + 1);
              }}
            >
              Reintentar apertura
            </button>
          </section>
        )}

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
          novedadPendiente={
            data.novedadPendiente
              ? {
                  id: data.novedadPendiente.id,
                  tipo: data.novedadPendiente.tipo,
                  tipoLabel: data.novedadPendiente.tipoLabel,
                  comentario: data.novedadPendiente.comentario,
                  fechaSolicitada: data.novedadPendiente.fechaSolicitada ?? null,
                  createdAt: data.novedadPendiente.createdAt ?? "",
                }
              : null
          }
          onReportada={refrescar}
        />

        {/* Datos del cliente / sitio */}
        <section className={`bg-white rounded-xl border p-4 space-y-2 ${esInfra ? "border-violet-200 bg-violet-50/30" : esInstalacion ? "border-sky-200 bg-sky-50/30" : ""}`}>
          {esInfra ? (
            <>
              <h2 className="font-semibold text-lg text-violet-900">
                Soporte de Infraestructura — {ticket.codigo}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                <p>
                  <span className="text-slate-500">Tipo:</span>{" "}
                  {siTipoTrabajoTexto(ticket.siTipoTrabajo, ticket.siTipoTrabajoOtro) ||
                    (ticket.motivoInfraestructura
                      ? MOTIVO_INFRA_LABELS[ticket.motivoInfraestructura]
                      : ticket.motivo)}
                </p>
                <p>
                  <span className="text-slate-500">Ubicación:</span>{" "}
                  {[ticket.provincia, ticket.canton, ticket.parroquia]
                    .filter(Boolean)
                    .join(" / ") || "—"}
                </p>
                <p>
                  <span className="text-slate-500">Sector:</span>{" "}
                  {ticket.sectorInfra || ticket.zonaInfra || "—"}
                </p>
                <p>
                  <span className="text-slate-500">Dirección:</span>{" "}
                  {ticket.direccionInfra || ticket.nodoAfectado || "—"}
                </p>
                {ticket.nodoAfectado && (
                  <p>
                    <span className="text-slate-500">Nodo:</span> {ticket.nodoAfectado}
                  </p>
                )}
                {ticket.referenciaInfra && (
                  <p className="sm:col-span-2">
                    <span className="text-slate-500">Referencia:</span> {ticket.referenciaInfra}
                  </p>
                )}
              </div>
              {!data.esResponsableInfra && puedeEditar && (
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2 mt-2">
                  Usted es colaborador: puede registrar fotos, materiales y comentarios. Solo el
                  Técnico Responsable puede finalizar la orden.
                </p>
              )}
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

        {esInfra && puedeEditar && (
          <section className="bg-white rounded-xl border p-4 space-y-3">
            <h3 className="font-semibold">Comentarios / avances</h3>
            <div className="flex gap-2">
              <input
                value={nuevoComentario}
                onChange={(e) => setNuevoComentario(e.target.value)}
                placeholder="Registrar avance o comentario…"
                className="flex-1 px-3 py-2 border rounded-lg text-sm"
              />
              <button
                type="button"
                disabled={enviandoComentario}
                onClick={() => void enviarComentario()}
                className="px-3 py-2 bg-violet-700 text-white rounded-lg text-sm disabled:opacity-50"
              >
                Enviar
              </button>
            </div>
            <ul className="space-y-2 max-h-48 overflow-auto text-sm">
              {comentarios.length === 0 ? (
                <li className="text-slate-400">Sin comentarios aún</li>
              ) : (
                comentarios.map((c) => (
                  <li key={c.id} className="border-b pb-2">
                    <p className="font-medium text-xs text-slate-500">
                      {c.tecnicoNombre} · {new Date(c.createdAt).toLocaleString("es-EC")}
                    </p>
                    <p>{c.texto}</p>
                  </li>
                ))
              )}
            </ul>
          </section>
        )}

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
              <h3 className="font-semibold">Evidencia — Antes</h3>
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
              <h3 className="font-semibold">Evidencia — Durante</h3>
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
                Soporte e instalaciones: ONU, router, bridge y RB requieren serie, modelo y marca.
                Cable drop y fibras: lote/bobina, modelo y marca. Patch cord: tipo APC/UPC.
                Cable drop / fibra droop: incluye {FIBRA_DROP_LIMITE_M} m; el excedente se marca en
                rojo.
              </p>
              {materiales.map((m, i) => {
                const nombreMat = nombreMaterial(m.inventarioId);
                const invItem = data.inventario.find((x) => x.id === m.inventarioId);
                const tipoMat = tipoMaterialSeleccionado(m.inventarioId);
                const requiereDetalle = tipoMat ? materialRequiereDetalle(tipoMat, nombreMat) : false;
                const esPatchcord = tipoMat ? materialEsPatchcord(tipoMat, nombreMat) : false;
                const labels = etiquetasDetalleMaterial(nombreMat);
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
                        {inventarioEquipos.length > 0 && (
                          <optgroup label="Equipos (ONU / router / bridge)">
                            {inventarioEquipos.map((inv) => (
                              <option key={inv.id} value={inv.id}>
                                {inv.nombre} (stock: {inv.stock} {inv.unidad})
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {inventarioCables.length > 0 && (
                          <optgroup label="Cable y fibra">
                            {inventarioCables.map((inv) => (
                              <option key={inv.id} value={inv.id}>
                                {inv.nombre} (stock: {inv.stock} {inv.unidad})
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {inventarioOtros.length > 0 && (
                          <optgroup label="Otros materiales">
                            {inventarioOtros.map((inv) => (
                              <option key={inv.id} value={inv.id}>
                                {inv.nombre} (stock: {inv.stock} {inv.unidad})
                              </option>
                            ))}
                          </optgroup>
                        )}
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
                      <>
                        <p className="text-[11px] text-slate-500">{labels.ayuda}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <input
                            type="text"
                            placeholder={labels.serie}
                            value={m.serie}
                            onChange={(e) => actualizarMaterial(i, { serie: e.target.value })}
                            className="px-3 py-2 border rounded-lg text-sm uppercase"
                            autoComplete="off"
                          />
                          <input
                            type="text"
                            placeholder={labels.modelo}
                            value={m.modelo}
                            onChange={(e) => actualizarMaterial(i, { modelo: e.target.value })}
                            className="px-3 py-2 border rounded-lg text-sm uppercase"
                            autoComplete="off"
                          />
                          <input
                            type="text"
                            placeholder={labels.marca}
                            value={m.marca}
                            onChange={(e) => actualizarMaterial(i, { marca: e.target.value })}
                            className="px-3 py-2 border rounded-lg text-sm uppercase"
                            autoComplete="off"
                          />
                        </div>
                      </>
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
                type="button"
                onClick={() => setMateriales([...materiales, materialVacio()])}
                className="text-sm text-infinity-600"
              >
                + Agregar material
              </button>
              {materialError && (
                <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg">{materialError}</div>
              )}
              <button
                type="button"
                onClick={() => void guardarMateriales()}
                className="w-full py-2 border border-infinity-600 text-infinity-600 rounded-lg text-sm font-medium"
              >
                Guardar materiales / descontar inventario
              </button>
            </section>

            {/* Fotos final */}
            <section className="bg-white rounded-xl border p-4 space-y-2">
              <h3 className="font-semibold">Evidencia — Después</h3>
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
              onSaved={refrescarTrasFirma}
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

              {esInfra && data.esResponsableInfra && (
                <div className="space-y-2 pt-2 border-t">
                  <h4 className="font-medium text-sm">Informe final (Responsable)</h4>
                  <label className="text-xs block space-y-1">
                    <span className="text-slate-500">Diagnóstico *</span>
                    <textarea
                      rows={3}
                      value={diagnosticoInfra}
                      onChange={(e) => setDiagnosticoInfra(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                    />
                  </label>
                  <label className="text-xs block space-y-1">
                    <span className="text-slate-500">Trabajo realizado *</span>
                    <textarea
                      rows={3}
                      value={trabajoRealizadoInfra}
                      onChange={(e) => setTrabajoRealizadoInfra(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                    />
                  </label>
                  <label className="text-xs block space-y-1">
                    <span className="text-slate-500">Resultado *</span>
                    <select
                      value={resultadoInfra}
                      onChange={(e) =>
                        setResultadoInfra(e.target.value as SiResultado | "")
                      }
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                    >
                      <option value="">Seleccionar…</option>
                      {SI_RESULTADOS.map((r) => (
                        <option key={r} value={r}>
                          {SI_RESULTADO_LABELS[r]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs block space-y-1">
                    <span className="text-slate-500">Observaciones</span>
                    <textarea
                      rows={2}
                      value={observacionesInfra}
                      onChange={(e) => setObservacionesInfra(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                    />
                  </label>
                </div>
              )}

              {error && (
                <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg">{error}</div>
              )}

              {esInfra && !data.esResponsableInfra ? (
                <p className="text-sm text-slate-600 bg-slate-50 border rounded-lg p-3">
                  Solo el Técnico Responsable puede finalizar esta orden.
                </p>
              ) : (
                <button
                  onClick={cerrarTicket}
                  disabled={cerrando}
                  className="w-full py-3 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 disabled:opacity-50"
                >
                  {cerrando
                    ? porCorregir
                      ? "Enviando corrección…"
                      : "Finalizando…"
                    : porCorregir
                      ? "Enviar Corrección"
                      : esInfra
                        ? "Enviar a revisión"
                        : "Enviar a revisión"}
                </button>
              )}
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
                  {esInfra && (
                    <a
                      href={`/api/soporte-infraestructura/ordenes/${id}/pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-center text-sm text-violet-700 font-medium hover:underline pt-2"
                    >
                      Descargar reporte PDF
                    </a>
                  )}
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
                      <div key={i} className="text-sm border-b border-slate-100 last:border-0 py-2">
                        <p className="font-medium">
                          {m.inventario.nombre}: {m.cantidad} {m.inventario.unidad}
                        </p>
                        {(m.serie || m.modelo || m.marca) && (
                          <p className="text-xs text-slate-500 mt-0.5">
                            {[
                              m.serie && `Serie/lote: ${m.serie}`,
                              m.modelo && `Modelo: ${m.modelo}`,
                              m.marca && `Marca: ${m.marca}`,
                              m.tipoPatchCord && `Patch: ${m.tipoPatchCord}`,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        )}
                      </div>
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
