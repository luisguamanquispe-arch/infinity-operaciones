import { prisma } from "@/lib/prisma";
import { tecnicoAsignadoAlTicket, tecnicoIdsFromTicket } from "@/lib/ticket-tecnicos";
import { TIPO_LABELS } from "@/lib/utils";
import {
  calcularExpiracionConfirmacion,
  derivarVistaConfirmacionVisita,
  ESTADOS_TICKET_BLOQUEAN_RESPUESTA_PUBLICA,
  evaluarDesplazamientoTicket,
  MARCA_HISTORICO_EN_CAMINO,
  mismoHorarioProgramado,
  obtenerFechaActivacionConfirmacion,
  ticketRequierePresenciaPorDefecto,
  tipoPermiteExencionPresencia,
  tokenConfirmacionValido,
  type ConfirmacionVisitaView,
  type EstadoConfirmacionVisitaVal,
} from "./reglas";
import { generarTokenConfirmacion } from "./token";
import { notificarTecnicosCambioDisponibilidad } from "./notificar";

const ESTADOS_TERMINALES = new Set(["CERRADO", "FINALIZADO", "CANCELADO"]);

export interface ConfirmacionRowLike {
  id: string;
  ticketId: string;
  estado: EstadoConfirmacionVisitaVal;
  requierePresencia: boolean;
  exentoMotivo: string | null;
  exentoPorUsuarioId: string | null;
  exentoEn: Date | null;
  token: string | null;
  tokenExpiraEn: Date | null;
  tokenRevocadoEn: Date | null;
  programadoEnConfirmado: Date | null;
  confirmadoEn: Date | null;
  confirmadoPorCanal: string | null;
  confirmadoPorUsuarioId: string | null;
  confirmadoPorNombre: string | null;
  personaRecibe: string | null;
  horarioSolicitado: string | null;
  observacionCliente: string | null;
  respondidoEn: Date | null;
  enCaminoEn: Date | null;
  enCaminoPorTecnicoId: string | null;
  enCaminoPorUsuarioId: string | null;
  ultimoEnvioEn: Date | null;
  ultimoEnvioCanal: string | null;
  ultimoEnvioEstado: string | null;
  enviosCount: number;
}

export interface TicketParaConfirmacionLike {
  id: string;
  codigo: string;
  tipo: string;
  estado: string;
  programadoEn: Date | null;
  createdAt?: Date | string | null;
  clienteId?: string;
  tecnicoId: string | null;
  tecnicos?: { tecnicoId: string }[];
  confirmacionVisita?: ConfirmacionRowLike | null;
}

export interface ConfirmacionVisitaDbLike {
  $transaction?: <T>(fn: (tx: ConfirmacionVisitaDbLike) => Promise<T>) => Promise<T>;
  ticket?: {
    findUnique: (args: {
      where: { id: string };
      include?: unknown;
      select?: unknown;
    }) => Promise<TicketParaConfirmacionLike | null>;
  };
  ticketConfirmacionVisita: {
    findUnique: (args: {
      where: { ticketId?: string; token?: string };
      include?: unknown;
    }) => Promise<(ConfirmacionRowLike & { ticket?: TicketParaConfirmacionLike }) | null>;
    create: (args: { data: Record<string, unknown> }) => Promise<ConfirmacionRowLike>;
    upsert: (args: {
      where: { ticketId: string };
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    }) => Promise<ConfirmacionRowLike>;
    update: (args: {
      where: { ticketId: string };
      data: Record<string, unknown>;
    }) => Promise<ConfirmacionRowLike>;
    updateMany: (args: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    }) => Promise<{ count: number }>;
  };
  eventoTicket: {
    create: (args: {
      data: {
        ticketId: string;
        usuarioId: string | null;
        accion: string;
        metadata?: string;
      };
    }) => Promise<unknown>;
  };
}

function getDb(db?: ConfirmacionVisitaDbLike): ConfirmacionVisitaDbLike {
  return db ?? (prisma as unknown as ConfirmacionVisitaDbLike);
}

async function runInTransaction<T>(
  db: ConfirmacionVisitaDbLike,
  fn: (tx: ConfirmacionVisitaDbLike) => Promise<T>
): Promise<T> {
  if (typeof db.$transaction === "function") {
    return db.$transaction((tx) => fn(tx as ConfirmacionVisitaDbLike));
  }
  return fn(db);
}

function esErrorUniqueP2002(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === "P2002"
  );
}

/**
 * Upsert tolerante a colisiones concurrentes `P2002` en PostgreSQL:
 * si dos solicitudes intentan crear simultáneamente la fila para el mismo `ticketId`,
 * la segunda reintenta con `update` sin fallar ni dejar inconsistencia.
 */
async function upsertConfirmacionSeguro(
  db: ConfirmacionVisitaDbLike,
  ticketId: string,
  createData: Record<string, unknown>,
  updateData: Record<string, unknown>
): Promise<ConfirmacionRowLike> {
  try {
    return await db.ticketConfirmacionVisita.upsert({
      where: { ticketId },
      create: createData,
      update: updateData,
    });
  } catch (err) {
    if (esErrorUniqueP2002(err)) {
      return await db.ticketConfirmacionVisita.update({
        where: { ticketId },
        data: updateData,
      });
    }
    throw err;
  }
}

/** Campos residuales de confirmación/desplazamiento que deben limpiarse al iniciar un nuevo ciclo. */
const CAMPOS_LIMPIOS_NUEVO_CICLO = {
  confirmadoEn: null,
  confirmadoPorCanal: null,
  confirmadoPorUsuarioId: null,
  confirmadoPorNombre: null,
  personaRecibe: null,
  horarioSolicitado: null,
  observacionCliente: null,
  respondidoEn: null,
  enCaminoEn: null,
  enCaminoPorTecnicoId: null,
  enCaminoPorUsuarioId: null,
} as const;

const CAMPOS_LIMPIOS_EXENCION = {
  exentoMotivo: null,
  exentoPorUsuarioId: null,
  exentoEn: null,
} as const;

/**
 * Crea o renueva la solicitud de confirmación de visita vinculada al ticket.
 * - Siempre crea la fila `TicketConfirmacionVisita` para tickets que requieren presencia,
 *   INCLUSO cuando `programadoEn` es `null` (evita que tickets nuevos caigan en `HISTORICO_SIN_CONTROL`).
 * - Solo emite token público cuando existe `programadoEn` válido.
 * - Si el ticket estaba `EXENTO` pero su tipo actual ya no admite exención, revoca la exención.
 * - No modifica estados del ticket ni cronómetros.
 */
export async function asegurarSolicitudConfirmacionVisita(params: {
  ticketId: string;
  programadoEn: Date | null;
  tipo: string;
  usuarioId?: string | null;
  forzarNuevoToken?: boolean;
  ahora?: Date;
  db?: ConfirmacionVisitaDbLike;
}): Promise<ConfirmacionRowLike | null> {
  if (!ticketRequierePresenciaPorDefecto(params.tipo)) {
    return null;
  }

  const db = getDb(params.db);
  const ahora = params.ahora ?? new Date();
  const existente = await db.ticketConfirmacionVisita.findUnique({
    where: { ticketId: params.ticketId },
  });

  const esExencionValida =
    existente &&
    existente.exentoMotivo !== MARCA_HISTORICO_EN_CAMINO &&
    (existente.requierePresencia === false || existente.estado === "EXENTO") &&
    tipoPermiteExencionPresencia(params.tipo);

  if (esExencionValida) {
    return existente;
  }

  const exencionRevocadaPorTipo = Boolean(
    existente &&
      existente.exentoMotivo !== MARCA_HISTORICO_EN_CAMINO &&
      (existente.requierePresencia === false || existente.estado === "EXENTO") &&
      !tipoPermiteExencionPresencia(params.tipo)
  );

  // Si aún no tiene horario programado, garantizamos la fila bloqueada sin token activo.
  if (!params.programadoEn) {
    const createSinHorario = {
      ticketId: params.ticketId,
      estado: "PENDIENTE_CONFIRMACION",
      requierePresencia: true,
      token: null,
      tokenExpiraEn: null,
      tokenRevocadoEn: null,
      programadoEnConfirmado: null,
      ...CAMPOS_LIMPIOS_EXENCION,
      ...CAMPOS_LIMPIOS_NUEVO_CICLO,
    };

    const necesitaReset =
      !existente ||
      exencionRevocadaPorTipo ||
      existente.programadoEnConfirmado !== null ||
      existente.token !== null ||
      existente.estado !== "PENDIENTE_CONFIRMACION";

    const updateSinHorario = necesitaReset
      ? {
          estado: "PENDIENTE_CONFIRMACION",
          requierePresencia: true,
          token: null,
          tokenExpiraEn: null,
          tokenRevocadoEn: existente?.token ? ahora : null,
          programadoEnConfirmado: null,
          ...CAMPOS_LIMPIOS_EXENCION,
          ...CAMPOS_LIMPIOS_NUEVO_CICLO,
        }
      : {
          requierePresencia: true,
        };

    const row = await upsertConfirmacionSeguro(
      db,
      params.ticketId,
      createSinHorario,
      updateSinHorario
    );

    if (!existente || exencionRevocadaPorTipo) {
      await db.eventoTicket.create({
        data: {
          ticketId: params.ticketId,
          usuarioId: params.usuarioId ?? null,
          accion: exencionRevocadaPorTipo
            ? "CONFIRMACION_VISITA_EXENCION_REVOCADA"
            : "CONFIRMACION_VISITA_SOLICITADA",
          metadata: JSON.stringify({
            programadoEn: null,
            sinHorarioProgramado: true,
            tipo: params.tipo,
          }),
        },
      });
    }

    return row;
  }

  const necesitaNuevoToken =
    params.forzarNuevoToken ||
    exencionRevocadaPorTipo ||
    existente?.exentoMotivo === MARCA_HISTORICO_EN_CAMINO ||
    !existente?.token ||
    Boolean(existente.tokenRevocadoEn) ||
    Boolean(existente.tokenExpiraEn && existente.tokenExpiraEn.getTime() <= ahora.getTime()) ||
    !mismoHorarioProgramado(params.programadoEn, existente.programadoEnConfirmado);

  const token = necesitaNuevoToken ? generarTokenConfirmacion() : existente!.token!;
  const tokenExpiraEn = calcularExpiracionConfirmacion(params.programadoEn, ahora);

  const createConHorario = {
    ticketId: params.ticketId,
    estado: "PENDIENTE_CONFIRMACION",
    requierePresencia: true,
    token,
    tokenExpiraEn,
    tokenRevocadoEn: null,
    programadoEnConfirmado: params.programadoEn,
    ...CAMPOS_LIMPIOS_EXENCION,
    ...CAMPOS_LIMPIOS_NUEVO_CICLO,
  };

  const updateConHorario = necesitaNuevoToken
    ? {
        estado: "PENDIENTE_CONFIRMACION",
        requierePresencia: true,
        token,
        tokenExpiraEn,
        tokenRevocadoEn: null,
        programadoEnConfirmado: params.programadoEn,
        ...CAMPOS_LIMPIOS_EXENCION,
        ...CAMPOS_LIMPIOS_NUEVO_CICLO,
      }
    : {
        tokenExpiraEn,
      };

  const row = await upsertConfirmacionSeguro(
    db,
    params.ticketId,
    createConHorario,
    updateConHorario
  );

  if (!existente || necesitaNuevoToken) {
    await db.eventoTicket.create({
      data: {
        ticketId: params.ticketId,
        usuarioId: params.usuarioId ?? null,
        accion: exencionRevocadaPorTipo
          ? "CONFIRMACION_VISITA_EXENCION_REVOCADA"
          : "CONFIRMACION_VISITA_SOLICITADA",
        metadata: JSON.stringify({
          programadoEn: params.programadoEn.toISOString(),
          expiraEn: tokenExpiraEn.toISOString(),
          renovado: Boolean(existente),
        }),
      },
    });
  }

  return row;
}

/**
 * Sincroniza e invalida la confirmación cuando cambian:
 * - el horario programado (`programadoEn`),
 * - el tipo de trabajo (`tipo`, ej. `INFRAESTRUCTURA` → presencial o `CORTE`/`RECONEXION` exento → `SOPORTE`/`INSTALACION`),
 * - o el cliente asignado (`clienteId`).
 *
 * Diseñada para ejecutarse dentro de la misma transacción `tx` que actualiza el `Ticket`.
 * Si solo cambia el técnico (sin cambios de horario, tipo ni cliente), conserva la confirmación vigente.
 */
export async function sincronizarConfirmacionPorCambioTicket(params: {
  ticketId: string;
  tipoAnterior: string;
  tipoNuevo: string;
  programadoEnAnterior: Date | null;
  programadoEnNuevo: Date | null;
  clienteIdAnterior?: string;
  clienteIdNuevo?: string;
  usuarioId?: string | null;
  ahora?: Date;
  db?: ConfirmacionVisitaDbLike;
}): Promise<{ invalidada: boolean; motivo: string | null; confirmacion: ConfirmacionRowLike | null }> {
  const db = getDb(params.db);
  const ahora = params.ahora ?? new Date();

  const cambioHorario = !mismoHorarioProgramado(
    params.programadoEnAnterior,
    params.programadoEnNuevo
  );
  const cambioCliente =
    Boolean(params.clienteIdAnterior && params.clienteIdNuevo) &&
    params.clienteIdAnterior !== params.clienteIdNuevo;
  const cambioTipo = params.tipoAnterior !== params.tipoNuevo;
  const requierePresenciaNuevo = ticketRequierePresenciaPorDefecto(params.tipoNuevo);
  const requeriaPresenciaAnterior = ticketRequierePresenciaPorDefecto(params.tipoAnterior);

  // Si el nuevo tipo no requiere presencia (ej. pasó a INFRAESTRUCTURA), no reactivar solicitud
  if (!requierePresenciaNuevo) {
    return { invalidada: false, motivo: null, confirmacion: null };
  }

  const existente = await db.ticketConfirmacionVisita.findUnique({
    where: { ticketId: params.ticketId },
  });

  const tieneExencionSupervisor = Boolean(
    existente &&
      existente.exentoMotivo !== MARCA_HISTORICO_EN_CAMINO &&
      (existente.requierePresencia === false || existente.estado === "EXENTO")
  );

  // Caso 1: tenía exención válida de supervisor pero el tipo cambió a uno que NO permite exención
  const exencionInvalidaPorTipo =
    tieneExencionSupervisor && !tipoPermiteExencionPresencia(params.tipoNuevo);

  // Caso 2: pasó de INFRAESTRUCTURA (sin presencia) a tipo presencial
  const pasoAVisitaPresencial = !requeriaPresenciaAnterior && requierePresenciaNuevo;

  // Caso 3: si mantiene exención válida y NO cambió cliente ni tipo incompatible, conservarla
  if (tieneExencionSupervisor && !exencionInvalidaPorTipo && !cambioCliente) {
    return { invalidada: false, motivo: null, confirmacion: existente };
  }

  if (!cambioHorario && !cambioCliente && !exencionInvalidaPorTipo && !pasoAVisitaPresencial) {
    return { invalidada: false, motivo: null, confirmacion: existente ?? null };
  }

  const motivos: string[] = [];
  if (cambioHorario) motivos.push("cambio_horario");
  if (cambioCliente) motivos.push("cambio_cliente");
  if (exencionInvalidaPorTipo) motivos.push("exencion_revocada_cambio_tipo");
  if (pasoAVisitaPresencial) motivos.push("cambio_tipo_presencial");
  const motivoResumen = motivos.join(",");

  const eraConfirmada = existente?.estado === "CONFIRMADO";
  const tieneNuevoHorario = params.programadoEnNuevo !== null;
  const nuevoToken = tieneNuevoHorario ? generarTokenConfirmacion() : null;
  const nuevaExpiracion = tieneNuevoHorario
    ? calcularExpiracionConfirmacion(params.programadoEnNuevo, ahora)
    : null;

  const createData = {
    ticketId: params.ticketId,
    estado: "PENDIENTE_CONFIRMACION",
    requierePresencia: true,
    token: nuevoToken,
    tokenExpiraEn: nuevaExpiracion,
    tokenRevocadoEn: null,
    programadoEnConfirmado: params.programadoEnNuevo,
    ...CAMPOS_LIMPIOS_EXENCION,
    ...CAMPOS_LIMPIOS_NUEVO_CICLO,
  };

  const updateData = {
    estado: "PENDIENTE_CONFIRMACION",
    requierePresencia: true,
    token: nuevoToken,
    tokenExpiraEn: nuevaExpiracion,
    tokenRevocadoEn: tieneNuevoHorario ? null : ahora,
    programadoEnConfirmado: params.programadoEnNuevo,
    ...CAMPOS_LIMPIOS_EXENCION,
    ...CAMPOS_LIMPIOS_NUEVO_CICLO,
  };

  const updated = await upsertConfirmacionSeguro(db, params.ticketId, createData, updateData);

  const accionEvento = exencionInvalidaPorTipo
    ? "CONFIRMACION_VISITA_EXENCION_REVOCADA"
    : eraConfirmada || cambioCliente
      ? "CONFIRMACION_VISITA_INVALIDADA"
      : pasoAVisitaPresencial
        ? "CONFIRMACION_VISITA_SOLICITADA"
        : "CONFIRMACION_VISITA_REPROGRAMADA";

  await db.eventoTicket.create({
    data: {
      ticketId: params.ticketId,
      usuarioId: params.usuarioId ?? null,
      accion: accionEvento,
      metadata: JSON.stringify({
        motivo: motivoResumen,
        tipoAnterior: cambioTipo ? params.tipoAnterior : undefined,
        tipoNuevo: cambioTipo ? params.tipoNuevo : undefined,
        clienteIdAnterior: cambioCliente ? params.clienteIdAnterior : undefined,
        clienteIdNuevo: cambioCliente ? params.clienteIdNuevo : undefined,
        programadoEnAnterior: params.programadoEnAnterior?.toISOString() ?? null,
        programadoEnNuevo: params.programadoEnNuevo?.toISOString() ?? null,
      }),
    },
  });

  return { invalidada: Boolean(existente || pasoAVisitaPresencial), motivo: motivoResumen, confirmacion: updated };
}

/**
 * Invalida la confirmación anterior si cambia la fecha u hora programada de la visita,
 * revocando el enlace previo, limpiando datos residuales y generando un nuevo token
 * para el nuevo horario. Compatible con ejecución dentro de una transacción `tx`.
 */
export async function invalidarConfirmacionPorCambioHorario(params: {
  ticketId: string;
  tipo: string;
  programadoEnAnterior: Date | null;
  programadoEnNuevo: Date | null;
  usuarioId?: string | null;
  ahora?: Date;
  db?: ConfirmacionVisitaDbLike;
}): Promise<{ invalidada: boolean; confirmacion: ConfirmacionRowLike | null }> {
  const res = await sincronizarConfirmacionPorCambioTicket({
    ticketId: params.ticketId,
    tipoAnterior: params.tipo,
    tipoNuevo: params.tipo,
    programadoEnAnterior: params.programadoEnAnterior,
    programadoEnNuevo: params.programadoEnNuevo,
    usuarioId: params.usuarioId,
    ahora: params.ahora,
    db: params.db,
  });
  return { invalidada: res.invalidada, confirmacion: res.confirmacion };
}

export interface ConsultaPublicaConfirmacion {
  ok: true;
  codigoTicket: string;
  tipoServicioLabel: string;
  programadoEn: string | null;
  estado: ConfirmacionVisitaView["estado"];
  estadoLabel: string;
  confirmadoEn: string | null;
  puedeResponder: boolean;
  motivoNoResponder: string | null;
}

export type ConsultaPublicaError = {
  ok: false;
  status: 404 | 410;
  error: string;
};

/**
 * Consulta pública por token (estrictamente SIN PII: no expone nombre del cliente,
 * ni `personaRecibe`, ni datos de confirmación manual, ni teléfono, ni dirección, ni IDs internos).
 */
export async function consultarConfirmacionPorToken(
  token: string,
  opts?: { ahora?: Date; db?: ConfirmacionVisitaDbLike }
): Promise<ConsultaPublicaConfirmacion | ConsultaPublicaError> {
  if (!tokenConfirmacionValido(token)) {
    return { ok: false, status: 404, error: "Enlace de confirmación no válido." };
  }

  const db = getDb(opts?.db);
  const ahora = opts?.ahora ?? new Date();
  const row = await db.ticketConfirmacionVisita.findUnique({
    where: { token },
    include: {
      ticket: {
        select: {
          id: true,
          codigo: true,
          tipo: true,
          estado: true,
          programadoEn: true,
          createdAt: true,
          tecnicoId: true,
        },
      },
    },
  });

  if (!row || !row.ticket) {
    return { ok: false, status: 404, error: "Enlace de confirmación no encontrado." };
  }

  if (row.tokenRevocadoEn) {
    return {
      ok: false,
      status: 410,
      error: "Este enlace ya no es válido porque fue reemplazado o revocado.",
    };
  }

  if (ESTADOS_TERMINALES.has(row.ticket.estado)) {
    return {
      ok: false,
      status: 410,
      error: "Esta orden técnica ya fue finalizada o cerrada.",
    };
  }

  if (
    !ticketRequierePresenciaPorDefecto(row.ticket.tipo) ||
    row.requierePresencia === false ||
    row.estado === "EXENTO"
  ) {
    return {
      ok: false,
      status: 410,
      error: "Esta orden técnica no requiere confirmación de presencia en domicilio.",
    };
  }

  if (row.estado === "CANCELADO") {
    return {
      ok: false,
      status: 410,
      error: "Esta solicitud de confirmación fue cancelada.",
    };
  }

  if (!row.tokenExpiraEn || ahora.getTime() > row.tokenExpiraEn.getTime()) {
    return {
      ok: false,
      status: 410,
      error:
        "Este enlace de confirmación ha expirado. Comuníquese con INFINITY INTERNET para recibir uno nuevo.",
    };
  }

  if (
    !row.ticket.programadoEn ||
    !row.programadoEnConfirmado ||
    !mismoHorarioProgramado(row.ticket.programadoEn, row.programadoEnConfirmado)
  ) {
    return {
      ok: false,
      status: 410,
      error:
        "El horario de esta visita fue actualizado. Por favor utilice el enlace más reciente.",
    };
  }

  const vista = derivarVistaConfirmacionVisita(row.ticket, row, ahora);

  let puedeResponder = true;
  let motivoNoResponder: string | null = null;
  if (row.ticket.estado === "EN_PROCESO") {
    puedeResponder = false;
    motivoNoResponder =
      "La visita técnica ya se encuentra en proceso. Comuníquese con soporte si necesita asistencia.";
  } else if (row.enCaminoEn) {
    puedeResponder = false;
    motivoNoResponder =
      "Nuestro técnico ya inició el desplazamiento hacia su domicilio. Si requiere un cambio urgente, comuníquese con soporte.";
  }

  return {
    ok: true,
    codigoTicket: row.ticket.codigo,
    tipoServicioLabel: TIPO_LABELS[row.ticket.tipo] ?? "Visita técnica",
    programadoEn: row.ticket.programadoEn.toISOString(),
    estado: vista.estado,
    estadoLabel: vista.estadoLabel,
    confirmadoEn: vista.confirmadoEn,
    puedeResponder,
    motivoNoResponder,
  };
}

export type AccionRespuestaCliente =
  | "CONFIRMAR"
  | "SOLICITA_REPROGRAMACION"
  | "NO_DISPONIBLE";

export async function responderConfirmacionPorToken(params: {
  token: string;
  ticketIdEsperado?: string;
  accion: AccionRespuestaCliente;
  personaRecibe?: string | null;
  horarioSolicitado?: string | null;
  observacionCliente?: string | null;
  ahora?: Date;
  db?: ConfirmacionVisitaDbLike;
  omitirNotificacionTecnico?: boolean;
}): Promise<
  | { ok: true; duplicada: boolean; vista: ConfirmacionVisitaView }
  | { ok: false; status: 400 | 403 | 404 | 409 | 410; error: string }
> {
  if (!tokenConfirmacionValido(params.token)) {
    return { ok: false, status: 404, error: "Enlace de confirmación no válido." };
  }

  const personaRecibe = (params.personaRecibe ?? "").trim().slice(0, 120) || null;
  const horarioSolicitado = (params.horarioSolicitado ?? "").trim().slice(0, 140) || null;
  const observacionCliente = (params.observacionCliente ?? "").trim().slice(0, 400) || null;

  if (params.accion === "CONFIRMAR" && (!personaRecibe || personaRecibe.length < 2)) {
    return {
      ok: false,
      status: 400,
      error: "Indique el nombre de la persona que recibirá al técnico (mínimo 2 caracteres).",
    };
  }
  if (
    params.accion === "SOLICITA_REPROGRAMACION" &&
    (!horarioSolicitado || horarioSolicitado.length < 3)
  ) {
    return {
      ok: false,
      status: 400,
      error: "Indique un día y horario sugerido para reprogramar la visita.",
    };
  }

  const db = getDb(params.db);
  const ahora = params.ahora ?? new Date();

  const estadoDestino: EstadoConfirmacionVisitaVal =
    params.accion === "CONFIRMAR"
      ? "CONFIRMADO"
      : params.accion === "SOLICITA_REPROGRAMACION"
        ? "SOLICITA_REPROGRAMACION"
        : "NO_DISPONIBLE";

  const txResult = await runInTransaction(db, async (tx) => {
    const row = await tx.ticketConfirmacionVisita.findUnique({
      where: { token: params.token },
      include: {
        ticket: {
          select: {
            id: true,
            codigo: true,
            tipo: true,
            estado: true,
            programadoEn: true,
            createdAt: true,
            tecnicoId: true,
            tecnicos: { select: { tecnicoId: true } },
          },
        },
      },
    });

    if (!row || !row.ticket) {
      return { ok: false as const, status: 404 as const, error: "Enlace de confirmación no encontrado." };
    }

    // Protección explícita: un token solo puede confirmar el ticket al que pertenece
    if (params.ticketIdEsperado && row.ticketId !== params.ticketIdEsperado) {
      return {
        ok: false as const,
        status: 403 as const,
        error: "El enlace no corresponde a este ticket.",
      };
    }

    if (row.tokenRevocadoEn) {
      return { ok: false as const, status: 410 as const, error: "Este enlace fue revocado." };
    }
    if (ESTADOS_TERMINALES.has(row.ticket.estado)) {
      return { ok: false as const, status: 410 as const, error: "Esta orden técnica ya fue finalizada." };
    }
    if (
      !ticketRequierePresenciaPorDefecto(row.ticket.tipo) ||
      row.requierePresencia === false ||
      row.estado === "EXENTO"
    ) {
      return {
        ok: false as const,
        status: 410 as const,
        error: "Esta visita no requiere confirmación de presencia.",
      };
    }
    if (row.estado === "CANCELADO") {
      return {
        ok: false as const,
        status: 410 as const,
        error: "La solicitud de confirmación fue cancelada.",
      };
    }
    if (row.ticket.estado === "EN_PROCESO") {
      return {
        ok: false as const,
        status: 409 as const,
        error: "La visita técnica ya está en proceso y no puede modificarse por este enlace.",
      };
    }
    if (row.enCaminoEn) {
      return {
        ok: false as const,
        status: 409 as const,
        error: "El técnico ya inició el desplazamiento; comuníquese con soporte para cambios.",
      };
    }
    if (!row.tokenExpiraEn || ahora.getTime() > row.tokenExpiraEn.getTime()) {
      return { ok: false as const, status: 410 as const, error: "El enlace de confirmación expiró." };
    }
    if (
      !row.ticket.programadoEn ||
      !row.programadoEnConfirmado ||
      !mismoHorarioProgramado(row.ticket.programadoEn, row.programadoEnConfirmado)
    ) {
      return {
        ok: false as const,
        status: 410 as const,
        error: "El horario cambió; utilice el enlace actualizado.",
      };
    }

    // Idempotencia previa: misma acción ya registrada sobre este token y horario
    if (
      row.estado === estadoDestino &&
      row.respondidoEn &&
      (estadoDestino !== "CONFIRMADO" || row.confirmadoEn)
    ) {
      return {
        ok: true as const,
        duplicada: true,
        vista: derivarVistaConfirmacionVisita(row.ticket, row, ahora),
        notif: null,
      };
    }

    const updatePayload: Record<string, unknown> =
      params.accion === "CONFIRMAR"
        ? {
            estado: "CONFIRMADO",
            confirmadoEn: ahora,
            confirmadoPorCanal: "ENLACE_PUBLICO",
            confirmadoPorUsuarioId: null,
            confirmadoPorNombre: null,
            personaRecibe,
            observacionCliente,
            horarioSolicitado: null,
            respondidoEn: ahora,
            programadoEnConfirmado: row.ticket.programadoEn,
          }
        : params.accion === "SOLICITA_REPROGRAMACION"
          ? {
              estado: "SOLICITA_REPROGRAMACION",
              confirmadoEn: null,
              confirmadoPorCanal: null,
              confirmadoPorUsuarioId: null,
              confirmadoPorNombre: null,
              horarioSolicitado,
              observacionCliente,
              respondidoEn: ahora,
            }
          : {
              estado: "NO_DISPONIBLE",
              confirmadoEn: null,
              confirmadoPorCanal: null,
              confirmadoPorUsuarioId: null,
              confirmadoPorNombre: null,
              observacionCliente,
              respondidoEn: ahora,
            };

    // Actualización condicional atómica:
    // Verifica en una sola operación SQL que el token, revocación, estado, enCaminoEn,
    // horario confirmado y estado/horario del ticket sigan exactamente vigentes.
    const { count } = await tx.ticketConfirmacionVisita.updateMany({
      where: {
        ticketId: row.ticketId,
        token: params.token,
        tokenRevocadoEn: null,
        requierePresencia: true,
        enCaminoEn: null,
        estado: { notIn: ["CANCELADO", "EXENTO", estadoDestino] },
        programadoEnConfirmado: row.ticket.programadoEn,
        ticket: {
          estado: { notIn: Array.from(ESTADOS_TICKET_BLOQUEAN_RESPUESTA_PUBLICA) },
          programadoEn: row.ticket.programadoEn,
        },
      },
      data: updatePayload,
    });

    if (count === 0) {
      const actual = await tx.ticketConfirmacionVisita.findUnique({
        where: { ticketId: row.ticketId },
        include: {
          ticket: {
            select: {
              id: true,
              codigo: true,
              tipo: true,
              estado: true,
              programadoEn: true,
              createdAt: true,
              tecnicoId: true,
            },
          },
        },
      });

      if (
        actual &&
        actual.ticket &&
        actual.token === params.token &&
        !actual.tokenRevocadoEn &&
        !actual.enCaminoEn &&
        !ESTADOS_TICKET_BLOQUEAN_RESPUESTA_PUBLICA.has(actual.ticket.estado) &&
        actual.estado === estadoDestino &&
        mismoHorarioProgramado(actual.ticket.programadoEn, actual.programadoEnConfirmado)
      ) {
        return {
          ok: true as const,
          duplicada: true,
          vista: derivarVistaConfirmacionVisita(actual.ticket, actual, ahora),
          notif: null,
        };
      }

      if (actual?.enCaminoEn || actual?.ticket?.estado === "EN_PROCESO") {
        return {
          ok: false as const,
          status: 409 as const,
          error: "La visita ya inició o el técnico salió en camino; no es posible modificarla.",
        };
      }

      return {
        ok: false as const,
        status: 410 as const,
        error: "La visita fue reprogramada o el enlace dejó de estar vigente.",
      };
    }

    const updated = await tx.ticketConfirmacionVisita.findUnique({
      where: { ticketId: row.ticketId },
    });

    const accionEvento =
      params.accion === "CONFIRMAR"
        ? "CONFIRMACION_VISITA_CONFIRMADA"
        : params.accion === "SOLICITA_REPROGRAMACION"
          ? "CONFIRMACION_VISITA_REPROGRAMACION_SOLICITADA"
          : "CONFIRMACION_VISITA_NO_DISPONIBLE";

    const metadata =
      params.accion === "CONFIRMAR"
        ? {
            canal: "ENLACE_PUBLICO",
            personaRecibe,
            programadoEn: row.ticket.programadoEn.toISOString(),
            confirmadoEn: ahora.toISOString(),
          }
        : params.accion === "SOLICITA_REPROGRAMACION"
          ? {
              canal: "ENLACE_PUBLICO",
              horarioSolicitado,
              observacionCliente,
              respondidoEn: ahora.toISOString(),
            }
          : {
              canal: "ENLACE_PUBLICO",
              observacionCliente,
              respondidoEn: ahora.toISOString(),
            };

    await tx.eventoTicket.create({
      data: {
        ticketId: row.ticketId,
        usuarioId: null,
        accion: accionEvento,
        metadata: JSON.stringify(metadata),
      },
    });

    const notif =
      !params.omitirNotificacionTecnico && params.accion !== "CONFIRMAR"
        ? {
            ticketId: row.ticketId,
            codigoTicket: row.ticket.codigo,
            tecnicoIds: tecnicoIdsFromTicket({
              tecnicoId: row.ticket.tecnicoId,
              tecnicos: row.ticket.tecnicos ?? [],
            }),
            motivoEstado: estadoDestino as "SOLICITA_REPROGRAMACION" | "NO_DISPONIBLE",
            detalle:
              params.accion === "SOLICITA_REPROGRAMACION"
                ? horarioSolicitado
                  ? `Cliente solicitó reprogramar (${horarioSolicitado}). Esperar confirmación del supervisor.`
                  : "Cliente solicitó reprogramar la visita. No iniciar desplazamiento."
                : observacionCliente ||
                  "El cliente indicó que no estará en casa. No iniciar desplazamiento.",
            marcaEvento: `${params.token.slice(0, 16)}:${estadoDestino}:${ahora.getTime()}`,
          }
        : null;

    return {
      ok: true as const,
      duplicada: false,
      vista: derivarVistaConfirmacionVisita(row.ticket, updated ?? row, ahora),
      notif,
    };
  });

  if (!txResult.ok) {
    return txResult;
  }

  if (txResult.notif && txResult.notif.tecnicoIds.length > 0) {
    await notificarTecnicosCambioDisponibilidad(txResult.notif);
  }

  return {
    ok: true,
    duplicada: txResult.duplicada,
    vista: txResult.vista,
  };
}

/**
 * Confirmación telefónica manual por Supervisor/Admin (auditada).
 * - Exige horario programado válido y no vencido.
 * - Si el caller envía `programadoEnEsperado`, valida coincidencia exacta con el horario actual.
 * - Revoca cualquier enlace público previo (`token: null`, `tokenRevocadoEn: ahora`)
 *   para impedir que un enlace antiguo sobrescriba la confirmación telefónica.
 */
export async function confirmarManualSupervisor(params: {
  ticket: TicketParaConfirmacionLike;
  usuarioId: string;
  usuarioNombre: string;
  rol: string;
  personaRecibe: string;
  nota?: string | null;
  programadoEnEsperado?: Date | string | null;
  ahora?: Date;
  db?: ConfirmacionVisitaDbLike;
}): Promise<
  | { ok: true; vista: ConfirmacionVisitaView }
  | { ok: false; status: 400 | 403 | 409; error: string }
> {
  if (!["SUPERVISOR", "ADMIN"].includes(params.rol)) {
    return {
      ok: false,
      status: 403,
      error: "Solo Supervisor o Admin puede registrar confirmación telefónica manual.",
    };
  }
  if (ESTADOS_TERMINALES.has(params.ticket.estado)) {
    return { ok: false, status: 409, error: "El ticket ya se encuentra cerrado." };
  }
  if (!ticketRequierePresenciaPorDefecto(params.ticket.tipo)) {
    return {
      ok: false,
      status: 400,
      error: `El tipo de trabajo ${params.ticket.tipo} no requiere confirmación de presencia.`,
    };
  }
  if (!params.ticket.programadoEn || Number.isNaN(params.ticket.programadoEn.getTime())) {
    return {
      ok: false,
      status: 400,
      error:
        "El ticket debe tener fecha y hora programada válida antes de registrar confirmación telefónica.",
    };
  }
  if (
    params.programadoEnEsperado !== undefined &&
    params.programadoEnEsperado !== null &&
    !mismoHorarioProgramado(params.ticket.programadoEn, params.programadoEnEsperado)
  ) {
    return {
      ok: false,
      status: 409,
      error:
        "El horario del ticket cambió antes de guardar. Actualice la vista y confirme el nuevo horario con el cliente.",
    };
  }

  const personaRecibe = params.personaRecibe.trim().slice(0, 120);
  if (personaRecibe.length < 2) {
    return {
      ok: false,
      status: 400,
      error: "Indique el nombre de la persona que recibirá al técnico.",
    };
  }

  const db = getDb(params.db);
  const ahora = params.ahora ?? new Date();
  const expira = calcularExpiracionConfirmacion(params.ticket.programadoEn, ahora);
  if (expira.getTime() <= ahora.getTime()) {
    return {
      ok: false,
      status: 400,
      error:
        "El horario programado ya venció. Reprograme la visita antes de registrar confirmación.",
    };
  }

  const nota = (params.nota ?? "").trim().slice(0, 400) || null;

  // Revocamos cualquier token público previo (nunca reactivamos enlaces antiguos).
  const dataConfirmacion = {
    estado: "CONFIRMADO",
    requierePresencia: true,
    ...CAMPOS_LIMPIOS_EXENCION,
    token: null,
    tokenExpiraEn: expira,
    tokenRevocadoEn: ahora,
    programadoEnConfirmado: params.ticket.programadoEn,
    confirmadoEn: ahora,
    confirmadoPorCanal: "TELEFONICA_SUPERVISOR",
    confirmadoPorUsuarioId: params.usuarioId,
    confirmadoPorNombre: params.usuarioNombre,
    personaRecibe,
    observacionCliente: nota,
    horarioSolicitado: null,
    respondidoEn: ahora,
  };

  const row = await upsertConfirmacionSeguro(
    db,
    params.ticket.id,
    {
      ticketId: params.ticket.id,
      ...dataConfirmacion,
    },
    dataConfirmacion
  );

  await db.eventoTicket.create({
    data: {
      ticketId: params.ticket.id,
      usuarioId: params.usuarioId,
      accion: "CONFIRMACION_VISITA_MANUAL",
      metadata: JSON.stringify({
        canal: "TELEFONICA_SUPERVISOR",
        confirmadoPorUsuarioId: params.usuarioId,
        confirmadoPorNombre: params.usuarioNombre,
        personaRecibe,
        nota,
        programadoEn: params.ticket.programadoEn.toISOString(),
        confirmadoEn: ahora.toISOString(),
        tokenPublicoRevocado: true,
      }),
    },
  });

  return {
    ok: true,
    vista: derivarVistaConfirmacionVisita(params.ticket, row, ahora),
  };
}

/** Exención explícita y auditada por Supervisor (solo tipos permitidos y tickets no terminales). */
export async function marcarExentoPresenciaSupervisor(params: {
  ticket: TicketParaConfirmacionLike;
  usuarioId: string;
  usuarioNombre: string;
  rol: string;
  motivo: string;
  ahora?: Date;
  db?: ConfirmacionVisitaDbLike;
}): Promise<
  | { ok: true; vista: ConfirmacionVisitaView }
  | { ok: false; status: 400 | 403 | 409; error: string }
> {
  if (!["SUPERVISOR", "ADMIN"].includes(params.rol)) {
    return {
      ok: false,
      status: 403,
      error: "Solo Supervisor o Admin puede eximir la presencia del cliente.",
    };
  }
  if (ESTADOS_TERMINALES.has(params.ticket.estado)) {
    return {
      ok: false,
      status: 409,
      error: "No se puede eximir un ticket cerrado o finalizado.",
    };
  }
  if (!tipoPermiteExencionPresencia(params.ticket.tipo)) {
    return {
      ok: false,
      status: 400,
      error: `El tipo de trabajo ${params.ticket.tipo} requiere confirmación de presencia del cliente.`,
    };
  }
  const motivo = params.motivo.trim().slice(0, 300);
  if (motivo.length < 5) {
    return {
      ok: false,
      status: 400,
      error: "Debe registrar el motivo por el cual la visita no requiere presencia del cliente.",
    };
  }

  const db = getDb(params.db);
  const ahora = params.ahora ?? new Date();
  const dataExento = {
    estado: "EXENTO",
    requierePresencia: false,
    exentoMotivo: motivo,
    exentoPorUsuarioId: params.usuarioId,
    exentoEn: ahora,
    token: null,
    tokenExpiraEn: null,
    tokenRevocadoEn: ahora,
    programadoEnConfirmado: params.ticket.programadoEn,
    confirmadoEn: null,
    confirmadoPorCanal: null,
    confirmadoPorUsuarioId: null,
    confirmadoPorNombre: null,
    personaRecibe: null,
    horarioSolicitado: null,
    observacionCliente: null,
  };

  const row = await upsertConfirmacionSeguro(
    db,
    params.ticket.id,
    {
      ticketId: params.ticket.id,
      ...dataExento,
    },
    dataExento
  );

  await db.eventoTicket.create({
    data: {
      ticketId: params.ticket.id,
      usuarioId: params.usuarioId,
      accion: "CONFIRMACION_VISITA_EXENTA",
      metadata: JSON.stringify({
        motivo,
        usuarioNombre: params.usuarioNombre,
        exentoEn: ahora.toISOString(),
      }),
    },
  });

  return {
    ok: true,
    vista: derivarVistaConfirmacionVisita(params.ticket, row, ahora),
  };
}

/**
 * Marca explícitamente SIN_RESPUESTA por Supervisor/Admin (auditado).
 * - Restablece `requierePresencia: true` y limpia cualquier exención previa.
 * - Revoca el token público y limpia datos residuales de confirmación/desplazamiento.
 * - Usa transacción + `upsertConfirmacionSeguro` para tolerar concurrencia / `P2002`.
 */
export async function marcarSinRespuestaSupervisor(params: {
  ticket: TicketParaConfirmacionLike;
  usuarioId: string;
  usuarioNombre: string;
  rol: string;
  nota?: string | null;
  ahora?: Date;
  db?: ConfirmacionVisitaDbLike;
}): Promise<
  | { ok: true; vista: ConfirmacionVisitaView }
  | { ok: false; status: 403 | 409; error: string }
> {
  if (!["SUPERVISOR", "ADMIN"].includes(params.rol)) {
    return {
      ok: false,
      status: 403,
      error: "Solo Supervisor o Admin puede marcar sin respuesta.",
    };
  }
  if (ESTADOS_TERMINALES.has(params.ticket.estado)) {
    return {
      ok: false,
      status: 409,
      error: "No se puede gestionar confirmación en un ticket cerrado.",
    };
  }

  const db = getDb(params.db);
  const ahora = params.ahora ?? new Date();
  const nota = (params.nota ?? "").trim().slice(0, 300) || null;

  const dataSinRespuesta = {
    estado: "SIN_RESPUESTA",
    requierePresencia: true,
    ...CAMPOS_LIMPIOS_EXENCION,
    ...CAMPOS_LIMPIOS_NUEVO_CICLO,
    token: null,
    tokenExpiraEn: null,
    tokenRevocadoEn: ahora,
    programadoEnConfirmado: params.ticket.programadoEn,
    observacionCliente: nota,
  };

  const updated = await runInTransaction(db, async (tx) => {
    const row = await upsertConfirmacionSeguro(
      tx,
      params.ticket.id,
      { ticketId: params.ticket.id, ...dataSinRespuesta },
      dataSinRespuesta
    );

    await tx.eventoTicket.create({
      data: {
        ticketId: params.ticket.id,
        usuarioId: params.usuarioId,
        accion: "CONFIRMACION_VISITA_SIN_RESPUESTA",
        metadata: JSON.stringify({ nota, registradoPor: params.usuarioNombre }),
      },
    });

    return row;
  });

  return {
    ok: true,
    vista: derivarVistaConfirmacionVisita(params.ticket, updated, ahora),
  };
}

/**
 * Cancela/invalida la confirmación de visita por Supervisor/Admin (auditado).
 * - Restablece `requierePresencia: true` y limpia cualquier exención previa.
 * - Revoca el token público y limpia todos los datos residuales.
 * - Usa transacción + `upsertConfirmacionSeguro` para manejar concurrencia / `P2002`.
 */
export async function cancelarConfirmacionSupervisor(params: {
  ticket: TicketParaConfirmacionLike;
  usuarioId: string;
  usuarioNombre: string;
  rol: string;
  motivo?: string | null;
  ahora?: Date;
  db?: ConfirmacionVisitaDbLike;
  omitirNotificacionTecnico?: boolean;
}): Promise<
  | { ok: true; vista: ConfirmacionVisitaView }
  | { ok: false; status: 403 | 409; error: string }
> {
  if (!["SUPERVISOR", "ADMIN"].includes(params.rol)) {
    return {
      ok: false,
      status: 403,
      error: "Solo Supervisor o Admin puede cancelar la confirmación.",
    };
  }
  if (ESTADOS_TERMINALES.has(params.ticket.estado)) {
    return {
      ok: false,
      status: 409,
      error: "No se puede cancelar confirmación en un ticket cerrado.",
    };
  }

  const db = getDb(params.db);
  const ahora = params.ahora ?? new Date();
  const motivo = (params.motivo ?? "").trim().slice(0, 300) || null;

  const dataCancelado = {
    estado: "CANCELADO",
    requierePresencia: true,
    ...CAMPOS_LIMPIOS_EXENCION,
    ...CAMPOS_LIMPIOS_NUEVO_CICLO,
    token: null,
    tokenExpiraEn: null,
    tokenRevocadoEn: ahora,
    programadoEnConfirmado: params.ticket.programadoEn,
    observacionCliente: motivo,
  };

  const updated = await runInTransaction(db, async (tx) => {
    const row = await upsertConfirmacionSeguro(
      tx,
      params.ticket.id,
      { ticketId: params.ticket.id, ...dataCancelado },
      dataCancelado
    );

    await tx.eventoTicket.create({
      data: {
        ticketId: params.ticket.id,
        usuarioId: params.usuarioId,
        accion: "CONFIRMACION_VISITA_CANCELADA",
        metadata: JSON.stringify({ motivo, canceladoPor: params.usuarioNombre }),
      },
    });

    return row;
  });

  if (!params.omitirNotificacionTecnico) {
    const ids = tecnicoIdsFromTicket({
      tecnicoId: params.ticket.tecnicoId,
      tecnicos: params.ticket.tecnicos ?? [],
    });
    await notificarTecnicosCambioDisponibilidad({
      ticketId: params.ticket.id,
      codigoTicket: params.ticket.codigo,
      tecnicoIds: ids,
      motivoEstado: "CANCELADO",
      detalle: motivo || "El supervisor canceló la confirmación de la visita.",
      marcaEvento: `cancelar:${params.usuarioId}:${ahora.getTime()}`,
    });
  }

  return {
    ok: true,
    vista: derivarVistaConfirmacionVisita(params.ticket, updated, ahora),
  };
}

/**
 * Acción EN CAMINO del técnico (validación obligatoria e idempotente en backend).
 * - Exige rol TECNICO asignado al ticket.
 * - Exige confirmación válida, vigente y coincidente con `programadoEn` (o exención válida / histórico verificado).
 * - Idempotente incluso bajo requests concurrentes (updateMany condicional / captura P2002).
 * - Persiste `enCaminoEn` también para tickets históricos y exentos sin modificar `Ticket.estado` ni cronómetros.
 */
export async function registrarEnCaminoTecnico(params: {
  ticket: TicketParaConfirmacionLike | null;
  session: { id: string; rol: string; tecnicoId?: string | null } | null;
  ahora?: Date;
  fechaActivacion?: Date;
  db?: ConfirmacionVisitaDbLike;
}): Promise<
  | { ok: true; yaEnCamino: boolean; enCaminoEn: string; vista: ConfirmacionVisitaView }
  | { ok: false; status: 401 | 403 | 404 | 409; error: string; codigo?: string }
> {
  if (!params.session?.id || params.session.rol !== "TECNICO" || !params.session.tecnicoId) {
    return {
      ok: false,
      status: 401,
      error: "Solo un técnico autenticado puede iniciar el desplazamiento.",
    };
  }
  if (!params.ticket) {
    return { ok: false, status: 404, error: "Ticket no encontrado." };
  }
  if (
    !tecnicoAsignadoAlTicket(
      {
        tecnicoId: params.ticket.tecnicoId,
        tecnicos: params.ticket.tecnicos ?? [],
      },
      params.session.tecnicoId
    )
  ) {
    return {
      ok: false,
      status: 403,
      error: "No está autorizado para operar sobre un ticket asignado a otro técnico.",
    };
  }
  if (ESTADOS_TERMINALES.has(params.ticket.estado)) {
    return {
      ok: false,
      status: 409,
      error: "El ticket ya se encuentra finalizado o cerrado.",
    };
  }

  const db = getDb(params.db);
  const ahora = params.ahora ?? new Date();
  const fechaActivacion = params.fechaActivacion ?? obtenerFechaActivacionConfirmacion();

  const confirmacion =
    params.ticket.confirmacionVisita !== undefined
      ? params.ticket.confirmacionVisita
      : await db.ticketConfirmacionVisita.findUnique({
          where: { ticketId: params.ticket.id },
        });

  const evalRes = evaluarDesplazamientoTicket(params.ticket, confirmacion, ahora, {
    fechaActivacion,
  });
  if (!evalRes.permitido) {
    return {
      ok: false,
      status: 409,
      error: evalRes.motivoBloqueo || "La visita no cuenta con confirmación válida.",
      codigo: evalRes.codigoBloqueo,
    };
  }

  if (confirmacion?.enCaminoEn) {
    return {
      ok: true,
      yaEnCamino: true,
      enCaminoEn: confirmacion.enCaminoEn.toISOString(),
      vista: derivarVistaConfirmacionVisita(params.ticket, confirmacion, ahora, {
        fechaActivacion,
      }),
    };
  }

  if (confirmacion) {
    // Actualización condicional atómica (D-1):
    // Revalida en la misma operación SQL las condiciones que autorizaron el desplazamiento
    // para impedir que una reprogramación, cancelación, respuesta NO_DISPONIBLE o cambio
    // de tipo concurrente permita iniciar EN CAMINO sin autorización vigente.
    const whereCondicional: Record<string, unknown> = {
      ticketId: params.ticket.id,
      enCaminoEn: null,
    };

    if (evalRes.estadoEfectivo === "CONFIRMADO") {
      whereCondicional.estado = "CONFIRMADO";
      whereCondicional.requierePresencia = true;
      whereCondicional.programadoEnConfirmado = params.ticket.programadoEn;
      if (confirmacion.confirmadoPorCanal !== "TELEFONICA_SUPERVISOR") {
        whereCondicional.tokenRevocadoEn = null;
      }
      whereCondicional.ticket = {
        estado: { notIn: Array.from(ESTADOS_TERMINALES) },
        programadoEn: params.ticket.programadoEn,
      };
    } else if (evalRes.estadoEfectivo === "HISTORICO_SIN_CONTROL") {
      whereCondicional.estado = "EXENTO";
      whereCondicional.exentoMotivo = MARCA_HISTORICO_EN_CAMINO;
      whereCondicional.ticket = {
        estado: { notIn: Array.from(ESTADOS_TERMINALES) },
      };
    } else {
      // EXENTO (por tipo sin presencia o exención explícita de supervisor)
      whereCondicional.estado = "EXENTO";
      whereCondicional.requierePresencia = false;
      whereCondicional.ticket = {
        estado: { notIn: Array.from(ESTADOS_TERMINALES) },
        tipo: params.ticket.tipo,
      };
    }

    const { count } = await db.ticketConfirmacionVisita.updateMany({
      where: whereCondicional,
      data: {
        enCaminoEn: ahora,
        enCaminoPorTecnicoId: params.session.tecnicoId,
        enCaminoPorUsuarioId: params.session.id,
      },
    });

    const filaActual = await db.ticketConfirmacionVisita.findUnique({
      where: { ticketId: params.ticket.id },
    });

    if (count === 0) {
      if (filaActual?.enCaminoEn) {
        return {
          ok: true,
          yaEnCamino: true,
          enCaminoEn: filaActual.enCaminoEn.toISOString(),
          vista: derivarVistaConfirmacionVisita(params.ticket, filaActual, ahora, {
            fechaActivacion,
          }),
        };
      }
      return {
        ok: false,
        status: 409,
        error:
          "La confirmación de la visita cambió o fue invalidada antes de iniciar el desplazamiento.",
        codigo: "CONFIRMACION_CAMBIADA",
      };
    }

    await db.eventoTicket.create({
      data: {
        ticketId: params.ticket.id,
        usuarioId: params.session.id,
        accion: "TECNICO_EN_CAMINO",
        metadata: JSON.stringify({
          tecnicoId: params.session.tecnicoId,
          enCaminoEn: ahora.toISOString(),
          estadoConfirmacion: evalRes.estadoEfectivo,
          esHistorico: evalRes.esHistorico,
        }),
      },
    });

    return {
      ok: true,
      yaEnCamino: false,
      enCaminoEn: ahora.toISOString(),
      vista: derivarVistaConfirmacionVisita(
        params.ticket,
        filaActual ?? { ...confirmacion, enCaminoEn: ahora },
        ahora,
        { fechaActivacion }
      ),
    };
  }

  // Sin fila previa (ticket histórico legítimo o INFRAESTRUCTURA):
  // Revalidamos estado/tipo del ticket justo antes del create atómico + manejo `P2002`
  // con predicado condicional en el fallback para impedir bypass si el ticket se cancela
  // o cambia de tipo concurrentemente. No altera `Ticket.estado` ni cronómetros.
  const whereCondicionalSinFila: Record<string, unknown> = evalRes.esHistorico
    ? {
        ticketId: params.ticket.id,
        enCaminoEn: null,
        estado: "EXENTO",
        exentoMotivo: MARCA_HISTORICO_EN_CAMINO,
        ticket: { estado: { notIn: Array.from(ESTADOS_TERMINALES) } },
      }
    : {
        ticketId: params.ticket.id,
        enCaminoEn: null,
        estado: "EXENTO",
        requierePresencia: false,
        ticket: {
          estado: { notIn: Array.from(ESTADOS_TERMINALES) },
          tipo: params.ticket.tipo,
        },
      };

  const ticketFresco = db.ticket
    ? await db.ticket.findUnique({
        where: { id: params.ticket.id },
        select: {
          id: true,
          codigo: true,
          tipo: true,
          estado: true,
          programadoEn: true,
          createdAt: true,
          tecnicoId: true,
          tecnicos: { select: { tecnicoId: true } },
          confirmacionVisita: true,
        },
      })
    : params.ticket;
  if (!ticketFresco || ESTADOS_TERMINALES.has(ticketFresco.estado)) {
    return {
      ok: false,
      status: 409,
      error: "El ticket fue cerrado o cancelado antes de iniciar el desplazamiento.",
      codigo: "CONFIRMACION_CAMBIADA",
    };
  }
  const evalFresco = evaluarDesplazamientoTicket(
    ticketFresco,
    ticketFresco.confirmacionVisita ?? null,
    ahora,
    { fechaActivacion }
  );
  if (!evalFresco.permitido) {
    return {
      ok: false,
      status: 409,
      error:
        evalFresco.motivoBloqueo ||
        "La confirmación de la visita cambió antes de iniciar el desplazamiento.",
      codigo: "CONFIRMACION_CAMBIADA",
    };
  }

  let creada: ConfirmacionRowLike;
  try {
    creada = await db.ticketConfirmacionVisita.create({
      data: {
        ticketId: params.ticket.id,
        estado: "EXENTO",
        requierePresencia: false,
        exentoMotivo: evalRes.esHistorico
          ? MARCA_HISTORICO_EN_CAMINO
          : `Tipo ${params.ticket.tipo} no requiere presencia`,
        programadoEnConfirmado: ticketFresco.programadoEn,
        enCaminoEn: ahora,
        enCaminoPorTecnicoId: params.session.tecnicoId,
        enCaminoPorUsuarioId: params.session.id,
      },
    });
  } catch (err) {
    if (esErrorUniqueP2002(err)) {
      const existente = await db.ticketConfirmacionVisita.findUnique({
        where: { ticketId: params.ticket.id },
      });
      if (existente?.enCaminoEn) {
        return {
          ok: true,
          yaEnCamino: true,
          enCaminoEn: existente.enCaminoEn.toISOString(),
          vista: derivarVistaConfirmacionVisita(ticketFresco, existente, ahora, {
            fechaActivacion,
          }),
        };
      }
      // Si otra operación creó la fila sin enCaminoEn simultáneamente, solo marcamos si
      // la autorización sigue vigente en forma atómica.
      const { count } = await db.ticketConfirmacionVisita.updateMany({
        where: whereCondicionalSinFila,
        data: {
          enCaminoEn: ahora,
          enCaminoPorTecnicoId: params.session.tecnicoId,
          enCaminoPorUsuarioId: params.session.id,
        },
      });
      const actual = await db.ticketConfirmacionVisita.findUnique({
        where: { ticketId: params.ticket.id },
      });
      if (count === 0) {
        if (actual?.enCaminoEn) {
          return {
            ok: true,
            yaEnCamino: true,
            enCaminoEn: actual.enCaminoEn.toISOString(),
            vista: derivarVistaConfirmacionVisita(ticketFresco, actual, ahora, {
              fechaActivacion,
            }),
          };
        }
        return {
          ok: false,
          status: 409,
          error:
            "La confirmación de la visita cambió o fue invalidada antes de iniciar el desplazamiento.",
          codigo: "CONFIRMACION_CAMBIADA",
        };
      }
      creada = actual!;
    } else {
      throw err;
    }
  }

  await db.eventoTicket.create({
    data: {
      ticketId: params.ticket.id,
      usuarioId: params.session.id,
      accion: "TECNICO_EN_CAMINO",
      metadata: JSON.stringify({
        tecnicoId: params.session.tecnicoId,
        enCaminoEn: ahora.toISOString(),
        estadoConfirmacion: evalRes.estadoEfectivo,
        esHistorico: evalRes.esHistorico,
      }),
    },
  });

  return {
    ok: true,
    yaEnCamino: false,
    enCaminoEn: ahora.toISOString(),
    vista: derivarVistaConfirmacionVisita(params.ticket, creada, ahora, {
      fechaActivacion,
    }),
  };
}
