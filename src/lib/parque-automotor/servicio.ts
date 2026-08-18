import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  ClaseMantenimientoVehiculo,
  EstadoNovedadVehiculo,
  EstadoVehiculo,
  GravedadNovedadVehiculo,
  OrigenKmVehiculo,
  TipoActaVehiculo,
  TipoDocumentoVehiculo,
  TipoFirmaActaVehiculo,
  TipoMantenimientoVehiculo,
  TipoNovedadVehiculo,
  TipoVehiculo,
} from "@prisma/client";
import { registrarAuditoriaVehiculo } from "./auditoria";
import {
  MAX_FOTOS_NOVEDAD,
  MAX_FOTOS_REGISTRO,
  persistVehiculoImage,
  urlCargaFactura,
  urlFotoInspeccion,
  urlFotoMantenimiento,
  urlFotoNovedad,
  urlFotoVehiculo,
} from "./media";
import { mapTipoNovedadReporte } from "./labels";
import {
  ALERTA_NO_APTO,
  alertaDocumento,
  alertaMantenimientoFecha,
  alertaMantenimientoKm,
  auditoriaCambioEstado,
  calcularKmPorGalon,
  calcularTotalCombustible,
  consumoFueraPromedio,
  estadoTrasInspeccion,
  evaluarAsignacion,
  evaluarOperacionCampo,
  KM_INFERIOR_MSG,
  MSG_FUERA_SERVICIO_CAMPO,
  MSG_TECNICO_YA_ASIGNADO,
  MSG_VEHICULO_YA_ASIGNADO,
  normalizarPlaca,
  placaValida,
  resultadoInspeccionDesdeChecklist,
  validarKmNoDescendente,
} from "./reglas";

export class ParqueError extends Error {
  constructor(
    message: string,
    public status: number = 400
  ) {
    super(message);
  }
}

export function errorUnicidadAsignacion(err: unknown): ParqueError | null {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("AsignacionVehiculo_tecnico_abierta")) {
    return new ParqueError(MSG_TECNICO_YA_ASIGNADO, 409);
  }
  if (msg.includes("AsignacionVehiculo_abierta_uidx")) {
    return new ParqueError(MSG_VEHICULO_YA_ASIGNADO, 409);
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
    const target = JSON.stringify(err.meta ?? "");
    if (/tecnico/i.test(target)) {
      return new ParqueError(MSG_TECNICO_YA_ASIGNADO, 409);
    }
    if (/vehiculo/i.test(target) || /abierta/i.test(target)) {
      return new ParqueError(MSG_VEHICULO_YA_ASIGNADO, 409);
    }
  }
  return null;
}

function parqueDesdeMedia(err: unknown): never {
  if (err instanceof Error && "status" in err) {
    throw new ParqueError(err.message, Number((err as { status?: number }).status) || 400);
  }
  throw err;
}

async function guardarImagenParque(vehiculoId: string, filename: string, image: string) {
  try {
    return await persistVehiculoImage(vehiculoId, filename, image);
  } catch (err) {
    parqueDesdeMedia(err);
  }
}

function serializeAsignacion(
  a: {
    id: string;
    fechaInicio: Date;
    fechaFin: Date | null;
    kilometrajeEntrega: number;
    kilometrajeRecepcion: number | null;
    combustibleEntrega: number;
    combustibleRecepcion: number | null;
    observaciones: string | null;
    tecnico: { id: string; usuario: { nombre: string } };
    usuario: { nombre: string };
    actas?: Array<{
      id: string;
      tipo: "ENTREGA" | "RECEPCION";
      createdAt: Date;
      kilometraje: number;
      combustible: number;
    }>;
  }
) {
  return {
    id: a.id,
    fechaInicio: a.fechaInicio,
    fechaFin: a.fechaFin,
    kilometrajeEntrega: a.kilometrajeEntrega,
    kilometrajeRecepcion: a.kilometrajeRecepcion,
    combustibleEntrega: a.combustibleEntrega,
    combustibleRecepcion: a.combustibleRecepcion,
    observaciones: a.observaciones,
    tecnicoId: a.tecnico.id,
    tecnicoNombre: a.tecnico.usuario.nombre,
    asignadoPor: a.usuario.nombre,
    actas: (a.actas ?? []).map((act) => ({
      id: act.id,
      tipo: act.tipo,
      createdAt: act.createdAt,
      kilometraje: act.kilometraje,
      combustible: act.combustible,
    })),
  };
}

export async function listarVehiculos(filtros?: { estado?: EstadoVehiculo }) {
  const rows = await prisma.vehiculo.findMany({
    where: filtros?.estado ? { estado: filtros.estado } : undefined,
    include: {
      asignaciones: {
        where: { fechaFin: null },
        take: 1,
        include: {
          tecnico: { include: { usuario: { select: { nombre: true } } } },
        },
      },
    },
    orderBy: { placa: "asc" },
  });
  return rows.map((v) => ({
    id: v.id,
    placa: v.placa,
    marca: v.marca,
    modelo: v.modelo,
    anio: v.anio,
    tipo: v.tipo,
    estado: v.estado,
    kilometrajeActual: v.kilometrajeActual,
    responsable: v.asignaciones[0]
      ? {
          tecnicoId: v.asignaciones[0].tecnicoId,
          nombre: v.asignaciones[0].tecnico.usuario.nombre,
        }
      : null,
  }));
}

export async function crearVehiculo(
  input: {
    placa: string;
    marca: string;
    modelo: string;
    anio: number;
    color?: string | null;
    tipo?: TipoVehiculo;
    vin?: string | null;
    numeroMotor?: string | null;
    kilometrajeInicial?: number;
    fechaAdquisicion?: string | null;
    observaciones?: string | null;
  },
  usuarioId: string
) {
  const placa = normalizarPlaca(input.placa);
  if (!placaValida(placa)) {
    throw new ParqueError("Placa inválida.");
  }
  const existe = await prisma.vehiculo.findUnique({ where: { placa } });
  if (existe) {
    throw new ParqueError("Ya existe un vehículo con esa placa.", 409);
  }
  const km = Math.max(0, Math.floor(input.kilometrajeInicial ?? 0));
  const v = await prisma.vehiculo.create({
    data: {
      placa,
      marca: input.marca.trim().toLocaleUpperCase("es-EC"),
      modelo: input.modelo.trim().toLocaleUpperCase("es-EC"),
      anio: input.anio,
      color: input.color?.trim().toLocaleUpperCase("es-EC") || null,
      tipo: input.tipo ?? "CAMIONETA",
      vin: input.vin?.trim().toLocaleUpperCase("es-EC") || null,
      numeroMotor: input.numeroMotor?.trim().toLocaleUpperCase("es-EC") || null,
      kilometrajeInicial: km,
      kilometrajeActual: km,
      fechaAdquisicion: input.fechaAdquisicion
        ? new Date(input.fechaAdquisicion)
        : null,
      observaciones: input.observaciones?.trim() || null,
    },
  });
  if (km > 0) {
    await prisma.lecturaKilometraje.create({
      data: {
        vehiculoId: v.id,
        kilometraje: km,
        origen: "ASIGNACION",
        observacion: "Kilometraje inicial",
      },
    });
  }
  await registrarAuditoriaVehiculo({
    vehiculoId: v.id,
    entidad: "Vehiculo",
    registroId: v.id,
    usuarioId,
    accion: "CREAR",
    valorNuevo: { placa, km },
  });
  return v;
}

export async function actualizarVehiculo(
  id: string,
  patch: {
    marca?: string;
    modelo?: string;
    anio?: number;
    color?: string | null;
    tipo?: TipoVehiculo;
    vin?: string | null;
    numeroMotor?: string | null;
    fechaAdquisicion?: string | null;
    observaciones?: string | null;
    estado?: EstadoVehiculo;
  },
  usuarioId: string
) {
  const prev = await prisma.vehiculo.findUnique({ where: { id } });
  if (!prev) throw new ParqueError("Vehículo no encontrado.", 404);
  const v = await prisma.vehiculo.update({
    where: { id },
    data: {
      ...(patch.marca != null
        ? { marca: patch.marca.trim().toLocaleUpperCase("es-EC") }
        : {}),
      ...(patch.modelo != null
        ? { modelo: patch.modelo.trim().toLocaleUpperCase("es-EC") }
        : {}),
      ...(patch.anio != null ? { anio: patch.anio } : {}),
      ...(patch.color !== undefined
        ? { color: patch.color?.trim().toLocaleUpperCase("es-EC") || null }
        : {}),
      ...(patch.tipo != null ? { tipo: patch.tipo } : {}),
      ...(patch.vin !== undefined
        ? { vin: patch.vin?.trim().toLocaleUpperCase("es-EC") || null }
        : {}),
      ...(patch.numeroMotor !== undefined
        ? {
            numeroMotor:
              patch.numeroMotor?.trim().toLocaleUpperCase("es-EC") || null,
          }
        : {}),
      ...(patch.fechaAdquisicion !== undefined
        ? {
            fechaAdquisicion: patch.fechaAdquisicion
              ? new Date(patch.fechaAdquisicion)
              : null,
          }
        : {}),
      ...(patch.observaciones !== undefined
        ? { observaciones: patch.observaciones?.trim() || null }
        : {}),
      ...(patch.estado != null ? { estado: patch.estado } : {}),
    },
  });
  await registrarAuditoriaVehiculo({
    vehiculoId: id,
    entidad: "Vehiculo",
    registroId: id,
    usuarioId,
    accion: "EDITAR",
    valorAnterior: { estado: prev.estado },
    valorNuevo: { estado: v.estado },
  });
  return v;
}

export async function hojaDeVida(id: string) {
  const v = await prisma.vehiculo.findUnique({
    where: { id },
    include: {
      asignaciones: {
        orderBy: { fechaInicio: "desc" },
        include: {
          tecnico: { include: { usuario: { select: { nombre: true } } } },
          usuario: { select: { nombre: true } },
          actas: { orderBy: { createdAt: "desc" }, include: { firmas: true } },
        },
      },
      lecturasKm: {
        where: { estadoRegistro: "ACTIVO" },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { tecnico: { include: { usuario: { select: { nombre: true } } } } },
      },
      cargasCombustible: {
        where: { estadoRegistro: "ACTIVO" },
        orderBy: { fecha: "desc" },
        take: 50,
        include: { tecnico: { include: { usuario: { select: { nombre: true } } } } },
      },
      inspecciones: {
        orderBy: { fecha: "desc" },
        take: 20,
        include: {
          tecnico: { include: { usuario: { select: { nombre: true } } } },
          fotos: { orderBy: { tomadaEn: "asc" } },
        },
      },
      mantenimientos: {
        where: { estadoRegistro: "ACTIVO" },
        orderBy: { fecha: "desc" },
        take: 30,
        include: { fotos: { orderBy: { tomadaEn: "asc" } } },
      },
      novedades: {
        orderBy: { fecha: "desc" },
        take: 30,
        include: {
          tecnico: { include: { usuario: { select: { nombre: true } } } },
          fotos: { orderBy: { tomadaEn: "asc" } },
        },
      },
      documentos: { orderBy: { createdAt: "desc" } },
      fotos: { orderBy: { tomadaEn: "desc" }, take: 20 },
      usosTicket: {
        orderBy: { createdAt: "desc" },
        take: 30,
        include: { ticket: { select: { codigo: true, tipo: true, estado: true } } },
      },
    },
  });
  if (!v) throw new ParqueError("Vehículo no encontrado.", 404);

  const abierta = v.asignaciones.find((a) => !a.fechaFin) ?? null;
  const ultimoMant = v.mantenimientos[0] ?? null;
  const alertaMant = peorDe([
    alertaMantenimientoKm({
      kmActual: v.kilometrajeActual,
      proximoKm: ultimoMant?.proximoKm,
    }),
    alertaMantenimientoFecha(ultimoMant?.proximoFecha),
  ]);
  const docsAlertas = v.documentos
    .map((d) => ({
      id: d.id,
      tipo: d.tipo,
      numero: d.numero,
      fechaVencimiento: d.fechaVencimiento,
      alerta: alertaDocumento(d.fechaVencimiento),
    }))
    .filter((d) => d.alerta);

  const costos = resumirCostos(
    v.cargasCombustible.map((c) => ({ fecha: c.fecha, total: c.total })),
    v.mantenimientos.map((m) => ({
      fecha: m.fecha,
      costo: m.costo,
      clase: m.clase,
    }))
  );

  return {
    ...v,
    responsable: abierta
      ? {
          asignacionId: abierta.id,
          tecnicoId: abierta.tecnicoId,
          nombre: abierta.tecnico.usuario.nombre,
          fechaInicio: abierta.fechaInicio,
        }
      : null,
    asignaciones: v.asignaciones.map(serializeAsignacion),
    actas: v.asignaciones
      .flatMap((a) =>
        a.actas.map((act) => ({
          id: act.id,
          tipo: act.tipo,
          createdAt: act.createdAt,
          kilometraje: act.kilometraje,
          combustible: act.combustible,
        }))
      )
      .sort((x, y) => y.createdAt.getTime() - x.createdAt.getTime()),
    alertaMant,
    docsAlertas,
    costos,
    proximoMantenimientoKm: ultimoMant?.proximoKm ?? null,
    proximoMantenimientoFecha: ultimoMant?.proximoFecha ?? null,
    alertaNoApto:
      v.estado === "FUERA_SERVICIO" ||
      v.inspecciones[0]?.resultado === "NO_APTO"
        ? ALERTA_NO_APTO
        : null,
    ...serializarEvidenciaYTimeline(v),
  };
}

type FotoRef = { id: string; url: string; tomadaEn: Date };

function serializarEvidenciaYTimeline(v: {
  id: string;
  asignaciones: Array<{
    id: string;
    fechaInicio: Date;
    fechaFin: Date | null;
    observaciones: string | null;
    kilometrajeEntrega: number;
    kilometrajeRecepcion: number | null;
    tecnico: { usuario: { nombre: string } };
    usuario: { nombre: string };
  }>;
  lecturasKm: Array<{
    id: string;
    createdAt: Date;
    kilometraje: number;
    origen: string;
    observacion: string | null;
    tecnico: { usuario: { nombre: string } } | null;
  }>;
  cargasCombustible: Array<{
    id: string;
    fecha: Date;
    galones: number;
    total: number;
    kilometraje: number;
    estacion: string;
    comprobanteData: string | null;
    comprobanteUrl: string | null;
    tecnico: { usuario: { nombre: string } } | null;
  }>;
  inspecciones: Array<{
    id: string;
    fecha: Date;
    resultado: string;
    kilometraje: number;
    observaciones: string | null;
    tecnico: { usuario: { nombre: string } };
    fotos: FotoRef[];
  }>;
  mantenimientos: Array<{
    id: string;
    fecha: Date;
    tipo: string;
    descripcion: string;
    costo: number;
    kilometraje: number;
    facturaData?: string | null;
    fotos: FotoRef[];
  }>;
  novedades: Array<{
    id: string;
    fecha: Date;
    tipo: string;
    estado: string;
    descripcion: string;
    kilometraje: number;
    puedeCircular: boolean;
    tecnico: { usuario: { nombre: string } };
    fotos: FotoRef[];
  }>;
  fotos: FotoRef[];
}) {
  const facturas = v.cargasCombustible
    .filter((c) => c.comprobanteData || c.comprobanteUrl)
    .map((c) => ({
      id: c.id,
      url: urlCargaFactura(v.id, c.id),
      fecha: c.fecha,
      kilometraje: c.kilometraje,
      tecnicoNombre: c.tecnico?.usuario.nombre ?? null,
      descripcion: `${c.estacion} · ${c.galones} gal · $${c.total}`,
      registroId: c.id,
    }));
  const danos = v.novedades.flatMap((n) =>
    n.fotos.map((f) => ({
      id: f.id,
      url: urlFotoNovedad(v.id, f.id),
      fecha: f.tomadaEn ?? n.fecha,
      kilometraje: n.kilometraje,
      tecnicoNombre: n.tecnico.usuario.nombre,
      descripcion: n.descripcion,
      registroId: n.id,
      tipo: n.tipo,
    }))
  );
  const inspeccionFotos = v.inspecciones.flatMap((i) =>
    i.fotos.map((f) => ({
      id: f.id,
      url: urlFotoInspeccion(v.id, f.id),
      fecha: f.tomadaEn ?? i.fecha,
      kilometraje: i.kilometraje,
      tecnicoNombre: i.tecnico.usuario.nombre,
      descripcion: i.resultado,
      registroId: i.id,
    }))
  );
  const mantFotos = v.mantenimientos.flatMap((m) =>
    m.fotos.map((f) => ({
      id: f.id,
      url: urlFotoMantenimiento(v.id, f.id),
      fecha: f.tomadaEn ?? m.fecha,
      kilometraje: m.kilometraje,
      tecnicoNombre: null as string | null,
      descripcion: m.descripcion,
      registroId: m.id,
    }))
  );
  const estadoFisico = v.fotos.map((f) => ({
    id: f.id,
    url: urlFotoVehiculo(v.id, f.id),
    fecha: f.tomadaEn,
    kilometraje: null as number | null,
    tecnicoNombre: null as string | null,
    descripcion: "Foto del vehículo",
    registroId: f.id,
  }));

  type Evento = {
    id: string;
    fecha: Date;
    tipo: string;
    titulo: string;
    descripcion: string;
    estado?: string | null;
    tecnicoNombre?: string | null;
    kilometraje?: number | null;
    registroId: string;
    fotos: { id: string; url: string }[];
  };
  const timeline: Evento[] = [];
  for (const a of v.asignaciones) {
    timeline.push({
      id: `asig-${a.id}`,
      fecha: a.fechaInicio,
      tipo: "ASIGNACION",
      titulo: "Asignación",
      descripcion: `Entrega a ${a.tecnico.usuario.nombre}`,
      tecnicoNombre: a.tecnico.usuario.nombre,
      kilometraje: a.kilometrajeEntrega,
      registroId: a.id,
      fotos: [],
    });
    if (a.fechaFin) {
      timeline.push({
        id: `rec-${a.id}`,
        fecha: a.fechaFin,
        tipo: "RECEPCION",
        titulo: "Recepción",
        descripcion: a.observaciones || "Vehículo recibido",
        tecnicoNombre: a.tecnico.usuario.nombre,
        kilometraje: a.kilometrajeRecepcion,
        registroId: a.id,
        fotos: [],
      });
    }
  }
  for (const l of v.lecturasKm) {
    timeline.push({
      id: `km-${l.id}`,
      fecha: l.createdAt,
      tipo: "KM",
      titulo: "Kilometraje",
      descripcion: `${l.kilometraje} km (${l.origen})`,
      tecnicoNombre: l.tecnico?.usuario.nombre ?? null,
      kilometraje: l.kilometraje,
      registroId: l.id,
      fotos: [],
    });
  }
  for (const c of v.cargasCombustible) {
    timeline.push({
      id: `gas-${c.id}`,
      fecha: c.fecha,
      tipo: "GASOLINA",
      titulo: "Gasolina",
      descripcion: `${c.galones} gal · $${c.total}`,
      tecnicoNombre: c.tecnico?.usuario.nombre ?? null,
      kilometraje: c.kilometraje,
      registroId: c.id,
      fotos:
        c.comprobanteData || c.comprobanteUrl
          ? [{ id: c.id, url: urlCargaFactura(v.id, c.id) }]
          : [],
    });
  }
  for (const i of v.inspecciones) {
    timeline.push({
      id: `insp-${i.id}`,
      fecha: i.fecha,
      tipo: "INSPECCION",
      titulo: "Inspección",
      descripcion: i.observaciones || i.resultado,
      estado: i.resultado,
      tecnicoNombre: i.tecnico.usuario.nombre,
      kilometraje: i.kilometraje,
      registroId: i.id,
      fotos: i.fotos.map((f) => ({ id: f.id, url: urlFotoInspeccion(v.id, f.id) })),
    });
  }
  for (const n of v.novedades) {
    timeline.push({
      id: `nov-${n.id}`,
      fecha: n.fecha,
      tipo: "NOVEDAD",
      titulo: "Daño o problema",
      descripcion: n.descripcion,
      estado: n.estado,
      tecnicoNombre: n.tecnico.usuario.nombre,
      kilometraje: n.kilometraje,
      registroId: n.id,
      fotos: n.fotos.map((f) => ({ id: f.id, url: urlFotoNovedad(v.id, f.id) })),
    });
  }
  for (const m of v.mantenimientos) {
    timeline.push({
      id: `mant-${m.id}`,
      fecha: m.fecha,
      tipo: "MANTENIMIENTO",
      titulo: "Mantenimiento",
      descripcion: `${m.tipo} · ${m.descripcion}`,
      kilometraje: m.kilometraje,
      registroId: m.id,
      fotos: m.fotos.map((f) => ({ id: f.id, url: urlFotoMantenimiento(v.id, f.id) })),
    });
  }
  timeline.sort((a, b) => b.fecha.getTime() - a.fecha.getTime());

  return {
    evidencia: {
      facturas,
      danos,
      estadoFisico,
      inspecciones: inspeccionFotos,
      otras: mantFotos,
    },
    timeline,
    cargasCombustible: v.cargasCombustible.map((c) => {
      const { comprobanteData: _d, ...rest } = c;
      return {
        ...rest,
        comprobanteUrl:
          c.comprobanteData || c.comprobanteUrl ? urlCargaFactura(v.id, c.id) : null,
        tecnicoNombre: c.tecnico?.usuario.nombre ?? null,
      };
    }),
    lecturasKm: v.lecturasKm.map((l) => ({
      ...l,
      tecnicoNombre: l.tecnico?.usuario.nombre ?? null,
    })),
    novedades: v.novedades.map((n) => ({
      ...n,
      tecnicoNombre: n.tecnico.usuario.nombre,
      fotos: n.fotos.map((f) => ({ id: f.id, url: urlFotoNovedad(v.id, f.id), tomadaEn: f.tomadaEn })),
    })),
    inspecciones: v.inspecciones.map((i) => ({
      ...i,
      tecnicoNombre: i.tecnico.usuario.nombre,
      fotos: i.fotos.map((f) => ({
        id: f.id,
        url: urlFotoInspeccion(v.id, f.id),
        tomadaEn: f.tomadaEn,
      })),
    })),
    fotos: v.fotos.map((f) => ({
      id: f.id,
      url: urlFotoVehiculo(v.id, f.id),
      tomadaEn: f.tomadaEn,
    })),
    mantenimientos: v.mantenimientos.map((m) => {
      const { facturaData: _f, ...rest } = m;
      return {
        ...rest,
        fotos: m.fotos.map((f) => ({
          id: f.id,
          url: urlFotoMantenimiento(v.id, f.id),
          tomadaEn: f.tomadaEn,
        })),
      };
    }),
  };
}

function peorDe(
  niveles: Array<"proximo" | "urgente" | "vencido" | null>
): "proximo" | "urgente" | "vencido" | null {
  const rank = { proximo: 1, urgente: 2, vencido: 3, "": 0 };
  let best: "proximo" | "urgente" | "vencido" | null = null;
  for (const n of niveles) {
    if (!n) continue;
    if (!best || rank[n] > rank[best]) best = n;
  }
  return best;
}

export function resumirCostos(
  combustibles: { fecha: Date; total: number }[],
  mantenimientos: { fecha: Date; costo: number; clase: string }[],
  now = new Date()
) {
  const mes = now.getMonth();
  const anio = now.getFullYear();
  const inMonth = (d: Date) => d.getMonth() === mes && d.getFullYear() === anio;
  const inYear = (d: Date) => d.getFullYear() === anio;
  const combustibleMes = combustibles
    .filter((c) => inMonth(c.fecha))
    .reduce((s, c) => s + c.total, 0);
  const combustibleAnio = combustibles
    .filter((c) => inYear(c.fecha))
    .reduce((s, c) => s + c.total, 0);
  const mantMes = mantenimientos
    .filter((m) => inMonth(m.fecha))
    .reduce((s, m) => s + m.costo, 0);
  const repairing = (m: { clase: string }) => m.clase === "CORRECTIVO";
  const reparacionMes = mantenimientos
    .filter((m) => inMonth(m.fecha) && repairing(m))
    .reduce((s, m) => s + m.costo, 0);
  const mantAnio = mantenimientos
    .filter((m) => inYear(m.fecha))
    .reduce((s, m) => s + m.costo, 0);
  const reparacionAnio = mantenimientos
    .filter((m) => inYear(m.fecha) && repairing(m))
    .reduce((s, m) => s + m.costo, 0);
  return {
    combustibleMes: round2(combustibleMes),
    mantenimientoMes: round2(mantMes),
    reparacionMes: round2(reparacionMes),
    totalMes: round2(combustibleMes + mantMes),
    combustibleAnio: round2(combustibleAnio),
    mantenimientoAnio: round2(mantAnio),
    reparacionAnio: round2(reparacionAnio),
    totalAnio: round2(combustibleAnio + mantAnio),
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

type DbTx = Prisma.TransactionClient;

async function conLockVehiculo<T>(
  vehiculoId: string,
  fn: (tx: DbTx) => Promise<T>,
  tx?: DbTx
): Promise<T> {
  const run = async (client: DbTx) => {
    await client.$queryRaw`SELECT id FROM "Vehiculo" WHERE id = ${vehiculoId} FOR UPDATE`;
    return fn(client);
  };
  if (tx) return run(tx);
  return prisma.$transaction(run, { timeout: 15000 });
}

async function ultimoKmActivo(
  vehiculoId: string,
  tx: DbTx
): Promise<number | null> {
  const row = await tx.lecturaKilometraje.findFirst({
    where: { vehiculoId, estadoRegistro: "ACTIVO" },
    orderBy: { kilometraje: "desc" },
  });
  return row?.kilometraje ?? null;
}

export async function registrarKm(opts: {
  vehiculoId: string;
  tecnicoId?: string | null;
  usuarioId?: string | null;
  kilometraje: number;
  origen: OrigenKmVehiculo;
  observacion?: string | null;
  modoCampo?: boolean;
  tx?: DbTx;
}) {
  const { lectura, ultimo } = await conLockVehiculo(
    opts.vehiculoId,
    async (tx) => {
      const vehiculo = await tx.vehiculo.findUnique({
        where: { id: opts.vehiculoId },
      });
      if (!vehiculo) throw new ParqueError("Vehículo no encontrado.", 404);
      if (opts.modoCampo) {
        const campo = evaluarOperacionCampo(vehiculo.estado);
        if (!campo.ok) {
          throw new ParqueError(MSG_FUERA_SERVICIO_CAMPO, 409);
        }
      }
      const maxLectura = await ultimoKmActivo(opts.vehiculoId, tx);
      const ultimo = Math.max(
        vehiculo.kilometrajeActual,
        maxLectura ?? 0
      );
      const v = validarKmNoDescendente(ultimo, opts.kilometraje);
      if (!v.ok) throw new ParqueError(v.error, 409);
      const rec = await tx.lecturaKilometraje.create({
        data: {
          vehiculoId: opts.vehiculoId,
          tecnicoId: opts.tecnicoId ?? null,
          kilometraje: opts.kilometraje,
          origen: opts.origen,
          observacion: opts.observacion ?? null,
        },
      });
      const updated = await tx.vehiculo.updateMany({
        where: {
          id: opts.vehiculoId,
          kilometrajeActual: { lte: opts.kilometraje },
        },
        data: { kilometrajeActual: opts.kilometraje },
      });
      if (updated.count === 0) {
        throw new ParqueError(KM_INFERIOR_MSG, 409);
      }
      return { lectura: rec, ultimo };
    },
    opts.tx
  );
  if (!opts.tx) {
    await registrarAuditoriaVehiculo({
      vehiculoId: opts.vehiculoId,
      entidad: "LecturaKilometraje",
      registroId: lectura.id,
      usuarioId: opts.usuarioId,
      accion: "KM",
      valorAnterior: { km: ultimo },
      valorNuevo: { km: opts.kilometraje, origen: opts.origen },
    });
  }
  return lectura;
}

export async function asignarVehiculo(opts: {
  vehiculoId: string;
  tecnicoId: string;
  usuarioId: string;
  kilometrajeEntrega: number;
  combustibleEntrega: number;
  observaciones?: string | null;
  checklist?: Partial<Record<string, boolean>>;
  firmaTecnico?: { nombre: string; imagen: string } | null;
  firmaAdmin?: { nombre: string; imagen: string } | null;
}) {
  const tecnico = await prisma.tecnico.findUnique({
    where: { id: opts.tecnicoId },
    include: { usuario: { select: { nombre: true, activo: true } } },
  });
  if (!tecnico || !tecnico.usuario.activo) {
    throw new ParqueError("Técnico no encontrado o inactivo.", 404);
  }

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Vehiculo" WHERE id = ${opts.vehiculoId} FOR UPDATE`;
        await tx.$queryRaw`SELECT id FROM "Tecnico" WHERE id = ${opts.tecnicoId} FOR UPDATE`;
        const vehiculo = await tx.vehiculo.findUnique({
          where: { id: opts.vehiculoId },
        });
        if (!vehiculo) throw new ParqueError("Vehículo no encontrado.", 404);
        const tecAbierta = await tx.asignacionVehiculo.findFirst({
          where: { tecnicoId: opts.tecnicoId, fechaFin: null },
          select: { id: true },
        });
        const vehAbierta = await tx.asignacionVehiculo.findFirst({
          where: { vehiculoId: opts.vehiculoId, fechaFin: null },
          select: { id: true },
        });
        const ev = evaluarAsignacion({
          estadoVehiculo: vehiculo.estado,
          tecnicoTieneAsignacionAbierta: Boolean(tecAbierta),
          vehiculoTieneAsignacionAbierta: Boolean(vehAbierta),
        });
        if (!ev.ok) throw new ParqueError(ev.error, ev.status);

        await registrarKm({
          vehiculoId: opts.vehiculoId,
          tecnicoId: opts.tecnicoId,
          usuarioId: opts.usuarioId,
          kilometraje: opts.kilometrajeEntrega,
          origen: "ASIGNACION",
          observacion: "Entrega / asignación",
          tx,
        });

        const nueva = await tx.asignacionVehiculo.create({
          data: {
            vehiculoId: opts.vehiculoId,
            tecnicoId: opts.tecnicoId,
            kilometrajeEntrega: opts.kilometrajeEntrega,
            combustibleEntrega: opts.combustibleEntrega,
            observaciones: opts.observaciones ?? null,
            usuarioId: opts.usuarioId,
          },
        });
        await tx.vehiculo.update({
          where: { id: opts.vehiculoId },
          data: { estado: "ASIGNADO" },
        });
        const acta = await tx.actaVehiculo.create({
          data: {
            vehiculoId: opts.vehiculoId,
            asignacionId: nueva.id,
            tipo: "ENTREGA",
            kilometraje: opts.kilometrajeEntrega,
            combustible: opts.combustibleEntrega,
            estadoExterior: opts.checklist?.estadoExterior ?? true,
            estadoInterior: opts.checklist?.estadoInterior ?? true,
            llantas: opts.checklist?.llantas ?? true,
            llantaEmergencia: opts.checklist?.llantaEmergencia ?? true,
            gata: opts.checklist?.gata ?? true,
            herramientas: opts.checklist?.herramientas ?? true,
            extintor: opts.checklist?.extintor ?? true,
            botiquin: opts.checklist?.botiquin ?? true,
            documentosOk: opts.checklist?.documentosOk ?? true,
            accesorios: opts.checklist?.accesorios ?? true,
            observaciones: opts.observaciones ?? null,
          },
        });
        return { nueva, acta, estadoAnterior: vehiculo.estado };
      },
      { timeout: 20000 }
    );

    await firmarActaSiHay(result.acta.id, opts);
    const audit = auditoriaCambioEstado({
      accion: "ASIGNAR",
      estadoAnterior: result.estadoAnterior,
      estadoNuevo: "ASIGNADO",
    });
    await registrarAuditoriaVehiculo({
      vehiculoId: opts.vehiculoId,
      entidad: "AsignacionVehiculo",
      registroId: result.nueva.id,
      usuarioId: opts.usuarioId,
      accion: audit.accion,
      valorAnterior: audit.valorAnterior,
      valorNuevo: { ...audit.valorNuevo, tecnicoId: opts.tecnicoId },
      motivo: audit.motivo,
    });
    return result;
  } catch (err) {
    if (err instanceof ParqueError) throw err;
    const unique = errorUnicidadAsignacion(err);
    if (unique) throw unique;
    throw err;
  }
}

export async function recibirVehiculo(opts: {
  vehiculoId: string;
  usuarioId: string;
  kilometrajeRecepcion: number;
  combustibleRecepcion: number;
  observaciones?: string | null;
  checklist?: Partial<Record<string, boolean>>;
  dejarDisponible?: boolean;
  firmaTecnico?: { nombre: string; imagen: string } | null;
  firmaAdmin?: { nombre: string; imagen: string } | null;
}) {
  const abierta = await prisma.asignacionVehiculo.findFirst({
    where: { vehiculoId: opts.vehiculoId, fechaFin: null },
  });
  if (!abierta) throw new ParqueError("No hay asignación abierta.", 409);

  await registrarKm({
    vehiculoId: opts.vehiculoId,
    tecnicoId: abierta.tecnicoId,
    usuarioId: opts.usuarioId,
    kilometraje: opts.kilometrajeRecepcion,
    origen: "ASIGNACION",
    observacion: "Recepción",
  });

  const acta = await prisma.$transaction(async (tx) => {
    await tx.asignacionVehiculo.update({
      where: { id: abierta.id },
      data: {
        fechaFin: new Date(),
        kilometrajeRecepcion: opts.kilometrajeRecepcion,
        combustibleRecepcion: opts.combustibleRecepcion,
        observaciones: opts.observaciones ?? abierta.observaciones,
      },
    });
    if (opts.dejarDisponible !== false) {
      await tx.vehiculo.update({
        where: { id: opts.vehiculoId },
        data: { estado: "DISPONIBLE" },
      });
    }
    return tx.actaVehiculo.create({
      data: {
        vehiculoId: opts.vehiculoId,
        asignacionId: abierta.id,
        tipo: "RECEPCION" as TipoActaVehiculo,
        kilometraje: opts.kilometrajeRecepcion,
        combustible: opts.combustibleRecepcion,
        estadoExterior: opts.checklist?.estadoExterior ?? true,
        estadoInterior: opts.checklist?.estadoInterior ?? true,
        llantas: opts.checklist?.llantas ?? true,
        llantaEmergencia: opts.checklist?.llantaEmergencia ?? true,
        gata: opts.checklist?.gata ?? true,
        herramientas: opts.checklist?.herramientas ?? true,
        extintor: opts.checklist?.extintor ?? true,
        botiquin: opts.checklist?.botiquin ?? true,
        documentosOk: opts.checklist?.documentosOk ?? true,
        accesorios: opts.checklist?.accesorios ?? true,
        observaciones: opts.observaciones ?? null,
      },
    });
  });
  await firmarActaSiHay(acta.id, opts);
  await registrarAuditoriaVehiculo({
    vehiculoId: opts.vehiculoId,
    entidad: "AsignacionVehiculo",
    registroId: abierta.id,
    usuarioId: opts.usuarioId,
    accion: "RECIBIR",
    valorAnterior: { estado: "ASIGNADO" },
    valorNuevo: {
      estado: opts.dejarDisponible !== false ? "DISPONIBLE" : undefined,
    },
  });
  return { asignacionId: abierta.id, acta };
}

async function firmarActaSiHay(
  actaId: string,
  opts: {
    usuarioId?: string;
    firmaTecnico?: { nombre: string; imagen: string } | null;
    firmaAdmin?: { nombre: string; imagen: string } | null;
  }
) {
  const pairs: { tipo: TipoFirmaActaVehiculo; f: { nombre: string; imagen: string } }[] =
    [];
  if (opts.firmaTecnico?.imagen) {
    pairs.push({ tipo: "TECNICO", f: opts.firmaTecnico });
  }
  if (opts.firmaAdmin?.imagen) {
    pairs.push({ tipo: "ADMINISTRADOR", f: opts.firmaAdmin });
  }
  for (const p of pairs) {
    await prisma.actaVehiculoFirma.upsert({
      where: { actaId_tipo: { actaId, tipo: p.tipo } },
      create: {
        actaId,
        tipo: p.tipo,
        nombre: p.f.nombre,
        imagenUrl: `/api/media/vehiculos/acta/${actaId}/${p.tipo}.png`,
        imagenData: p.f.imagen,
        usuarioId: opts.usuarioId ?? null,
      },
      update: {
        nombre: p.f.nombre,
        imagenData: p.f.imagen,
      },
    });
  }
}

export async function registrarCombustible(opts: {
  vehiculoId: string;
  tecnicoId?: string | null;
  usuarioId?: string | null;
  estacion: string;
  kilometraje: number;
  galones: number;
  precioPorGalon: number;
  numeroFactura?: string | null;
  comprobante?: string | null;
  observaciones?: string | null;
  fecha?: string | null;
  modoCampo?: boolean;
}) {
  if (opts.galones <= 0 || opts.precioPorGalon < 0) {
    throw new ParqueError("Galones y precio deben ser válidos.");
  }
  await registrarKm({
    vehiculoId: opts.vehiculoId,
    tecnicoId: opts.tecnicoId,
    usuarioId: opts.usuarioId,
    kilometraje: opts.kilometraje,
    origen: "COMBUSTIBLE",
    modoCampo: opts.modoCampo,
  });
  const prev = await prisma.cargaCombustible.findFirst({
    where: { vehiculoId: opts.vehiculoId, estadoRegistro: "ACTIVO" },
    orderBy: { fecha: "desc" },
  });
  const hist = await prisma.cargaCombustible.findMany({
    where: {
      vehiculoId: opts.vehiculoId,
      estadoRegistro: "ACTIVO",
      kmPorGalon: { not: null },
    },
    orderBy: { fecha: "desc" },
    take: 8,
    select: { kmPorGalon: true },
  });
  const { kmRecorridos, kmPorGalon } = calcularKmPorGalon(
    prev?.kilometraje ?? null,
    opts.kilometraje,
    opts.galones
  );
  const historial = hist
    .map((h) => h.kmPorGalon)
    .filter((n): n is number => n != null && n > 0);
  const anormal = consumoFueraPromedio(kmPorGalon, historial);
  const total = calcularTotalCombustible(opts.galones, opts.precioPorGalon);
  const carga = await prisma.cargaCombustible.create({
    data: {
      vehiculoId: opts.vehiculoId,
      tecnicoId: opts.tecnicoId ?? null,
      estacion: (opts.estacion ?? "").trim().toLocaleUpperCase("es-EC") || "NO INDICADA",
      kilometraje: opts.kilometraje,
      galones: opts.galones,
      precioPorGalon: opts.precioPorGalon,
      total,
      numeroFactura: opts.numeroFactura?.trim() || null,
      comprobanteData: null,
      comprobanteUrl: null,
      observaciones: opts.observaciones ?? null,
      kmPorGalon,
      kmRecorridos,
      consumoFueraPromedio: anormal,
      fecha: opts.fecha ? new Date(opts.fecha) : undefined,
    },
  });
  if (opts.comprobante) {
    const stored = await guardarImagenParque(
      opts.vehiculoId,
      `carga-${carga.id}.jpg`,
      opts.comprobante
    );
    await prisma.cargaCombustible.update({
      where: { id: carga.id },
      data: {
        comprobanteData: stored.imagenData,
        comprobanteUrl: stored.url,
      },
    });
  }
  await registrarAuditoriaVehiculo({
    vehiculoId: opts.vehiculoId,
    entidad: "CargaCombustible",
    registroId: carga.id,
    usuarioId: opts.usuarioId,
    accion: "COMBUSTIBLE",
    valorNuevo: {
      total,
      galones: opts.galones,
      anormal,
      factura: Boolean(opts.comprobante),
    },
  });
  return {
    carga: {
      ...carga,
      comprobanteUrl: opts.comprobante ? urlCargaFactura(opts.vehiculoId, carga.id) : null,
    },
    mensajeAnormal: anormal ? "Consumo fuera del promedio." : null,
  };
}

export async function registrarInspeccion(opts: {
  vehiculoId: string;
  tecnicoId: string;
  usuarioId?: string | null;
  kilometraje: number;
  combustible: number;
  items: Record<string, boolean>;
  observaciones?: string | null;
  fotos?: string[];
  modoCampo?: boolean;
}) {
  const prev = await prisma.vehiculo.findUnique({
    where: { id: opts.vehiculoId },
    select: { estado: true },
  });
  if (!prev) throw new ParqueError("Vehículo no encontrado.", 404);
  await registrarKm({
    vehiculoId: opts.vehiculoId,
    tecnicoId: opts.tecnicoId,
    usuarioId: opts.usuarioId,
    kilometraje: opts.kilometraje,
    origen: "INSPECCION",
    modoCampo: opts.modoCampo,
  });
  const { resultado } = resultadoInspeccionDesdeChecklist(opts.items);
  const estadoDestino = estadoTrasInspeccion(resultado);
  const insp = await prisma.$transaction(async (tx) => {
    const rec = await tx.inspeccionVehiculo.create({
      data: {
        vehiculoId: opts.vehiculoId,
        tecnicoId: opts.tecnicoId,
        kilometraje: opts.kilometraje,
        combustible: opts.combustible,
        aceite: opts.items.aceite ?? true,
        refrigerante: opts.items.refrigerante ?? true,
        frenos: opts.items.frenos ?? true,
        luces: opts.items.luces ?? true,
        direccionales: opts.items.direccionales ?? true,
        llantas: opts.items.llantas ?? true,
        llantaEmergencia: opts.items.llantaEmergencia ?? true,
        gata: opts.items.gata ?? true,
        extintor: opts.items.extintor ?? true,
        botiquin: opts.items.botiquin ?? true,
        herramientas: opts.items.herramientas ?? true,
        carroceria: opts.items.carroceria ?? true,
        vidrios: opts.items.vidrios ?? true,
        espejos: opts.items.espejos ?? true,
        documentosOk: opts.items.documentosOk ?? true,
        resultado,
        observaciones: opts.observaciones ?? null,
      },
    });
    if (estadoDestino) {
      await tx.vehiculo.update({
        where: { id: opts.vehiculoId },
        data: { estado: estadoDestino },
      });
    }
    return rec;
  });
  const fotosIn = (opts.fotos ?? []).slice(0, MAX_FOTOS_REGISTRO);
  for (const img of fotosIn) {
    const row = await prisma.inspeccionVehiculoFoto.create({
      data: { inspeccionId: insp.id, url: "pending" },
    });
    const stored = await guardarImagenParque(
      opts.vehiculoId,
      `inspfoto-${row.id}.jpg`,
      img
    );
    await prisma.inspeccionVehiculoFoto.update({
      where: { id: row.id },
      data: { url: stored.url, imagenData: stored.imagenData },
    });
  }
  await registrarAuditoriaVehiculo({
    vehiculoId: opts.vehiculoId,
    entidad: "InspeccionVehiculo",
    registroId: insp.id,
    usuarioId: opts.usuarioId,
    accion: "INSPECCION",
    valorNuevo: { resultado, fotos: fotosIn.length },
    motivo: estadoDestino ? ALERTA_NO_APTO : null,
  });
  if (estadoDestino) {
    const audit = auditoriaCambioEstado({
      accion: "FUERA_SERVICIO",
      estadoAnterior: prev.estado,
      estadoNuevo: estadoDestino,
      motivo: ALERTA_NO_APTO,
    });
    await registrarAuditoriaVehiculo({
      vehiculoId: opts.vehiculoId,
      entidad: audit.entidad,
      registroId: opts.vehiculoId,
      usuarioId: opts.usuarioId,
      accion: audit.accion,
      valorAnterior: audit.valorAnterior,
      valorNuevo: audit.valorNuevo,
      motivo: audit.motivo,
    });
  }
  return insp;
}

export async function registrarMantenimiento(opts: {
  vehiculoId: string;
  usuarioId: string;
  kilometraje: number;
  clase: ClaseMantenimientoVehiculo;
  tipo: TipoMantenimientoVehiculo;
  descripcion: string;
  proveedor?: string | null;
  costo: number;
  factura?: string | null;
  proximoFecha?: string | null;
  proximoKm?: number | null;
  observaciones?: string | null;
  fotos?: string[];
}) {
  const prevEstado = await prisma.vehiculo.findUnique({
    where: { id: opts.vehiculoId },
    select: { estado: true },
  });
  await registrarKm({
    vehiculoId: opts.vehiculoId,
    usuarioId: opts.usuarioId,
    kilometraje: opts.kilometraje,
    origen: "MANTENIMIENTO",
  });
  const rec = await prisma.$transaction(async (tx) => {
    const m = await tx.mantenimientoVehiculo.create({
      data: {
        vehiculoId: opts.vehiculoId,
        kilometraje: opts.kilometraje,
        clase: opts.clase,
        tipo: opts.tipo,
        descripcion: opts.descripcion.trim(),
        proveedor: opts.proveedor?.trim() || null,
        costo: opts.costo,
        facturaData: opts.factura ?? null,
        proximoFecha: opts.proximoFecha ? new Date(opts.proximoFecha) : null,
        proximoKm: opts.proximoKm ?? null,
        observaciones: opts.observaciones ?? null,
      },
    });
    if (opts.clase === "CORRECTIVO") {
      await tx.vehiculo.update({
        where: { id: opts.vehiculoId },
        data: { estado: "MANTENIMIENTO" },
      });
    }
    return m;
  });
  const fotosMant = (opts.fotos ?? []).slice(0, MAX_FOTOS_REGISTRO);
  for (const img of fotosMant) {
    const row = await prisma.mantenimientoVehiculoFoto.create({
      data: { mantenimientoId: rec.id, url: "pending" },
    });
    const stored = await guardarImagenParque(
      opts.vehiculoId,
      `mantfoto-${row.id}.jpg`,
      img
    );
    await prisma.mantenimientoVehiculoFoto.update({
      where: { id: row.id },
      data: { url: stored.url, imagenData: stored.imagenData },
    });
  }
  await registrarAuditoriaVehiculo({
    vehiculoId: opts.vehiculoId,
    entidad: "MantenimientoVehiculo",
    registroId: rec.id,
    usuarioId: opts.usuarioId,
    accion: "MANTENIMIENTO",
    valorNuevo: { tipo: opts.tipo, costo: opts.costo, fotos: fotosMant.length },
  });
  if (opts.clase === "CORRECTIVO") {
    const audit = auditoriaCambioEstado({
      accion: "MANTENIMIENTO",
      estadoAnterior: prevEstado?.estado ?? "DESCONOCIDO",
      estadoNuevo: "MANTENIMIENTO",
      motivo: "Ingreso a mantenimiento",
    });
    await registrarAuditoriaVehiculo({
      vehiculoId: opts.vehiculoId,
      entidad: audit.entidad,
      registroId: opts.vehiculoId,
      usuarioId: opts.usuarioId,
      accion: audit.accion,
      valorAnterior: audit.valorAnterior,
      valorNuevo: audit.valorNuevo,
      motivo: audit.motivo,
    });
  }
  return rec;
}

export async function vehiculoOperativoTrasMant(
  vehiculoId: string,
  usuarioId: string
) {
  const prev = await prisma.vehiculo.findUnique({
    where: { id: vehiculoId },
    select: { estado: true },
  });
  const abierta = await prisma.asignacionVehiculo.findFirst({
    where: { vehiculoId, fechaFin: null },
  });
  const estado: EstadoVehiculo = abierta ? "ASIGNADO" : "DISPONIBLE";
  const v = await prisma.vehiculo.update({
    where: { id: vehiculoId },
    data: { estado },
  });
  const audit = auditoriaCambioEstado({
    accion: "OPERATIVO",
    estadoAnterior: prev?.estado ?? "DESCONOCIDO",
    estadoNuevo: estado,
    motivo: "Devolución a operativo",
  });
  await registrarAuditoriaVehiculo({
    vehiculoId,
    entidad: audit.entidad,
    registroId: vehiculoId,
    usuarioId,
    accion: audit.accion,
    valorAnterior: audit.valorAnterior,
    valorNuevo: audit.valorNuevo,
    motivo: audit.motivo,
  });
  return v;
}

export async function registrarNovedad(opts: {
  vehiculoId: string;
  tecnicoId: string;
  usuarioId?: string | null;
  kilometraje: number;
  tipo: TipoNovedadVehiculo | string;
  descripcion: string;
  gravedad?: GravedadNovedadVehiculo;
  puedeCircular: boolean;
  fotos?: string[];
  modoCampo?: boolean;
}) {
  const prev = await prisma.vehiculo.findUnique({
    where: { id: opts.vehiculoId },
    select: { estado: true },
  });
  await registrarKm({
    vehiculoId: opts.vehiculoId,
    tecnicoId: opts.tecnicoId,
    usuarioId: opts.usuarioId,
    kilometraje: opts.kilometraje,
    origen: "NOVEDAD",
    modoCampo: opts.modoCampo,
  });
  const rec = await prisma.$transaction(async (tx) => {
    const n = await tx.novedadVehiculo.create({
      data: {
        vehiculoId: opts.vehiculoId,
        tecnicoId: opts.tecnicoId,
        kilometraje: opts.kilometraje,
        tipo: mapTipoNovedadReporte(opts.tipo),
        descripcion: opts.descripcion.trim(),
        gravedad: opts.gravedad ?? "MEDIA",
        puedeCircular: opts.puedeCircular,
      },
    });
    if (!opts.puedeCircular) {
      await tx.vehiculo.update({
        where: { id: opts.vehiculoId },
        data: { estado: "FUERA_SERVICIO" },
      });
    }
    return n;
  });
  const fotosNov = (opts.fotos ?? []).slice(0, MAX_FOTOS_NOVEDAD);
  for (const img of fotosNov) {
    const row = await prisma.novedadVehiculoFoto.create({
      data: { novedadId: rec.id, url: "pending" },
    });
    const stored = await guardarImagenParque(
      opts.vehiculoId,
      `novfoto-${row.id}.jpg`,
      img
    );
    await prisma.novedadVehiculoFoto.update({
      where: { id: row.id },
      data: { url: stored.url, imagenData: stored.imagenData },
    });
  }
  await registrarAuditoriaVehiculo({
    vehiculoId: opts.vehiculoId,
    entidad: "NovedadVehiculo",
    registroId: rec.id,
    usuarioId: opts.usuarioId,
    accion: "NOVEDAD",
    valorNuevo: {
      puedeCircular: opts.puedeCircular,
      tipo: mapTipoNovedadReporte(opts.tipo),
      fotos: fotosNov.length,
    },
  });
  if (!opts.puedeCircular) {
    const audit = auditoriaCambioEstado({
      accion: "FUERA_SERVICIO",
      estadoAnterior: prev?.estado ?? "DESCONOCIDO",
      estadoNuevo: "FUERA_SERVICIO",
      motivo: "Novedad: no puede circular",
    });
    await registrarAuditoriaVehiculo({
      vehiculoId: opts.vehiculoId,
      entidad: audit.entidad,
      registroId: opts.vehiculoId,
      usuarioId: opts.usuarioId,
      accion: audit.accion,
      valorAnterior: audit.valorAnterior,
      valorNuevo: audit.valorNuevo,
      motivo: audit.motivo,
    });
  }
  return rec;
}

export async function transicionarNovedad(
  novedadId: string,
  estado: EstadoNovedadVehiculo,
  usuarioId: string
) {
  const prev = await prisma.novedadVehiculo.findUnique({
    where: { id: novedadId },
  });
  if (!prev) throw new ParqueError("Novedad no encontrada.", 404);
  const n = await prisma.novedadVehiculo.update({
    where: { id: novedadId },
    data: { estado },
  });
  if (estado === "RESUELTA" && prev.puedeCircular === false) {
    await vehiculoOperativoTrasMant(prev.vehiculoId, usuarioId);
  }
  if (estado === "EN_REPARACION") {
    const veh = await prisma.vehiculo.findUnique({
      where: { id: prev.vehiculoId },
      select: { estado: true },
    });
    await prisma.vehiculo.update({
      where: { id: prev.vehiculoId },
      data: { estado: "MANTENIMIENTO" },
    });
    const audit = auditoriaCambioEstado({
      accion: "MANTENIMIENTO",
      estadoAnterior: veh?.estado ?? "DESCONOCIDO",
      estadoNuevo: "MANTENIMIENTO",
      motivo: "Novedad en reparación",
    });
    await registrarAuditoriaVehiculo({
      vehiculoId: prev.vehiculoId,
      entidad: audit.entidad,
      registroId: prev.vehiculoId,
      usuarioId,
      accion: audit.accion,
      valorAnterior: audit.valorAnterior,
      valorNuevo: audit.valorNuevo,
      motivo: audit.motivo,
    });
  }
  await registrarAuditoriaVehiculo({
    vehiculoId: prev.vehiculoId,
    entidad: "NovedadVehiculo",
    registroId: novedadId,
    usuarioId,
    accion: "NOVEDAD_ESTADO",
    valorAnterior: { estado: prev.estado },
    valorNuevo: { estado },
  });
  return n;
}

export async function registrarDocumento(opts: {
  vehiculoId: string;
  usuarioId: string;
  tipo: TipoDocumentoVehiculo;
  numero?: string | null;
  fechaInicio?: string | null;
  fechaVencimiento?: string | null;
  archivo?: string | null;
  observacion?: string | null;
}) {
  const d = await prisma.documentoVehiculo.create({
    data: {
      vehiculoId: opts.vehiculoId,
      tipo: opts.tipo,
      numero: opts.numero ?? null,
      fechaInicio: opts.fechaInicio ? new Date(opts.fechaInicio) : null,
      fechaVencimiento: opts.fechaVencimiento
        ? new Date(opts.fechaVencimiento)
        : null,
      archivoData: opts.archivo ?? null,
      observacion: opts.observacion ?? null,
    },
  });
  await registrarAuditoriaVehiculo({
    vehiculoId: opts.vehiculoId,
    entidad: "DocumentoVehiculo",
    registroId: d.id,
    usuarioId: opts.usuarioId,
    accion: "DOCUMENTO",
    valorNuevo: { tipo: opts.tipo, numero: opts.numero },
  });
  return d;
}

export async function anularRegistro(opts: {
  entidad: "CargaCombustible" | "LecturaKilometraje" | "MantenimientoVehiculo";
  id: string;
  usuarioId: string;
  motivo: string;
}) {
  if (!opts.motivo.trim()) throw new ParqueError("Indique el motivo de anulación.");
  if (opts.entidad === "CargaCombustible") {
    const prev = await prisma.cargaCombustible.findUnique({ where: { id: opts.id } });
    if (!prev) throw new ParqueError("Registro no encontrado.", 404);
    const rec = await prisma.cargaCombustible.update({
      where: { id: opts.id },
      data: { estadoRegistro: "ANULADO" },
    });
    await registrarAuditoriaVehiculo({
      vehiculoId: prev.vehiculoId,
      entidad: opts.entidad,
      registroId: opts.id,
      usuarioId: opts.usuarioId,
      accion: "ANULADO",
      motivo: opts.motivo,
      valorAnterior: { estadoRegistro: prev.estadoRegistro },
      valorNuevo: { estadoRegistro: "ANULADO" },
    });
    return rec;
  }
  if (opts.entidad === "LecturaKilometraje") {
    const prev = await prisma.lecturaKilometraje.findUnique({
      where: { id: opts.id },
    });
    if (!prev) throw new ParqueError("Registro no encontrado.", 404);
    const rec = await prisma.lecturaKilometraje.update({
      where: { id: opts.id },
      data: { estadoRegistro: "ANULADO" },
    });
    await registrarAuditoriaVehiculo({
      vehiculoId: prev.vehiculoId,
      entidad: opts.entidad,
      registroId: opts.id,
      usuarioId: opts.usuarioId,
      accion: "ANULADO",
      motivo: opts.motivo,
      valorAnterior: { km: prev.kilometraje },
    });
    return rec;
  }
  const prev = await prisma.mantenimientoVehiculo.findUnique({
    where: { id: opts.id },
  });
  if (!prev) throw new ParqueError("Registro no encontrado.", 404);
  const rec = await prisma.mantenimientoVehiculo.update({
    where: { id: opts.id },
    data: { estadoRegistro: "ANULADO" },
  });
  await registrarAuditoriaVehiculo({
    vehiculoId: prev.vehiculoId,
    entidad: opts.entidad,
    registroId: opts.id,
    usuarioId: opts.usuarioId,
    accion: "ANULADO",
    motivo: opts.motivo,
  });
  return rec;
}

export async function dashboardParque(now = new Date()) {
  const vehiculos = await prisma.vehiculo.findMany({
    include: {
      cargasCombustible: { where: { estadoRegistro: "ACTIVO" } },
      mantenimientos: { where: { estadoRegistro: "ACTIVO" } },
      lecturasKm: {
        where: { estadoRegistro: "ACTIVO" },
        orderBy: { createdAt: "asc" },
        take: 1,
      },
      asignaciones: {
        where: { fechaFin: null },
        include: { tecnico: { include: { usuario: { select: { nombre: true } } } } },
      },
      novedades: { where: { estado: { in: ["REPORTADA", "EN_REVISION", "APROBADA", "EN_REPARACION"] } } },
      documentos: true,
      inspecciones: { orderBy: { fecha: "desc" }, take: 1 },
    },
  });
  const mes = now.getMonth();
  const anio = now.getFullYear();
  const inMonth = (d: Date) => d.getMonth() === mes && d.getFullYear() === anio;

  let combustibleMes = 0;
  let mantMes = 0;
  let kmMes = 0;
  const rankingConsumo: {
    placa: string;
    km: number;
    galones: number;
    kmPorGalon: number | null;
    costo: number;
  }[] = [];
  const rankingCostos: {
    placa: string;
    combustible: number;
    mantenimiento: number;
    reparaciones: number;
    total: number;
  }[] = [];
  const alertas: { placa: string; mensaje: string; nivel: string }[] = [];

  for (const v of vehiculos) {
    const cargasMes = v.cargasCombustible.filter((c) => inMonth(c.fecha));
    const gal = cargasMes.reduce((s, c) => s + c.galones, 0);
    const costC = cargasMes.reduce((s, c) => s + c.total, 0);
    const mantsMes = v.mantenimientos.filter((m) => inMonth(m.fecha));
    const costM = mantsMes.reduce((s, m) => s + m.costo, 0);
    const costR = mantsMes
      .filter((m) => m.clase === "CORRECTIVO")
      .reduce((s, m) => s + m.costo, 0);
    combustibleMes += costC;
    mantMes += costM;
    const kmDelMes = cargasMes.reduce((s, c) => s + (c.kmRecorridos ?? 0), 0);
    kmMes += kmDelMes;
    const kpg =
      gal > 0 ? Math.round((kmDelMes / gal) * 100) / 100 : null;
    rankingConsumo.push({
      placa: v.placa,
      km: kmDelMes,
      galones: round2(gal),
      kmPorGalon: kpg,
      costo: round2(costC),
    });
    rankingCostos.push({
      placa: v.placa,
      combustible: round2(costC),
      mantenimiento: round2(costM),
      reparaciones: round2(costR),
      total: round2(costC + costM),
    });
    const lastMant = v.mantenimientos.sort(
      (a, b) => b.fecha.getTime() - a.fecha.getTime()
    )[0];
    if (v.estado === "FUERA_SERVICIO" || v.inspecciones[0]?.resultado === "NO_APTO") {
      alertas.push({
        placa: v.placa,
        nivel: "urgente",
        mensaje: ALERTA_NO_APTO,
      });
    }
    const niv = peorDe([
      alertaMantenimientoKm({
        kmActual: v.kilometrajeActual,
        proximoKm: lastMant?.proximoKm,
      }),
      alertaMantenimientoFecha(lastMant?.proximoFecha, now),
      ...v.documentos.map((d) => alertaDocumento(d.fechaVencimiento, now)),
    ]);
    if (niv && lastMant?.proximoKm != null) {
      const restante = lastMant.proximoKm - v.kilometrajeActual;
      alertas.push({
        placa: v.placa,
        nivel: niv,
        mensaje: `${v.marca} ${v.modelo} ${v.placa}: próximo mantenimiento en ${Math.max(0, restante)} km.`,
      });
    } else if (niv) {
      alertas.push({
        placa: v.placa,
        nivel: niv,
        mensaje: `${v.placa}: alerta ${niv}`,
      });
    }
  }

  const byEstado = {
    total: vehiculos.length,
    operativos: vehiculos.filter(
      (v) => v.estado === "DISPONIBLE" || v.estado === "ASIGNADO"
    ).length,
    asignados: vehiculos.filter((v) => v.estado === "ASIGNADO").length,
    mantenimiento: vehiculos.filter((v) => v.estado === "MANTENIMIENTO").length,
    fueraServicio: vehiculos.filter((v) => v.estado === "FUERA_SERVICIO").length,
  };
  const novedadesPendientes = vehiculos.reduce(
    (s, v) => s + v.novedades.length,
    0
  );

  return {
    ...byEstado,
    combustibleMes: round2(combustibleMes),
    mantenimientoMes: round2(mantMes),
    kmMes,
    alertas: alertas.slice(0, 20),
    novedadesPendientes,
    rankingConsumo: rankingConsumo.sort((a, b) => b.costo - a.costo),
    rankingCostos: rankingCostos.sort((a, b) => b.total - a.total),
  };
}

/** Tickets del técnico en la ventana de la asignación abierta (solo lectura; no escribe en Ticket). */
export async function ticketsDeAsignacion(
  vehiculoId: string,
  limite = 50
) {
  const asig = await prisma.asignacionVehiculo.findFirst({
    where: { vehiculoId, fechaFin: null },
  });
  const historial = await prisma.asignacionVehiculo.findMany({
    where: { vehiculoId },
    orderBy: { fechaInicio: "desc" },
    take: 12,
  });
  const or = historial.map((a) => ({
    tecnicoId: a.tecnicoId,
    createdAt: {
      gte: a.fechaInicio,
      lte: a.fechaFin ?? new Date(),
    },
  }));
  if (or.length === 0) return { asignacionAbierta: null, tickets: [] };
  const tickets = await prisma.ticket.findMany({
    where: { OR: or, tipo: { not: "INFRAESTRUCTURA" } },
    select: {
      id: true,
      codigo: true,
      tipo: true,
      estado: true,
      createdAt: true,
      motivo: true,
    },
    orderBy: { createdAt: "desc" },
    take: limite,
  });
  return { asignacionAbierta: asig, tickets };
}
