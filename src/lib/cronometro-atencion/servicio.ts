import { prisma } from "@/lib/prisma";
import { tecnicoAsignadoAlTicket } from "@/lib/ticket-tecnicos";
import {
  calcularDuracionAtencionSegundos,
  derivarEstadoCronometroAtencion,
  ticketAdmiteCronometroAtencion,
  type CronometroAtencionView,
} from "./estado";

export interface TicketAuthInput {
  id: string;
  tipo: string;
  estado: string;
  tecnicoId: string | null;
  tecnicos?: { tecnicoId: string }[];
}

export interface SessionAuthInput {
  id: string;
  rol?: string;
  tecnicoId?: string | null;
}

export type AutorizacionResultado =
  | { ok: true; tecnicoId: string }
  | { ok: false; status: 401 | 403 | 400 | 409; error: string };

const ESTADOS_TERMINALES = new Set(["CERRADO", "FINALIZADO", "CANCELADO"]);

/**
 * Valida que el usuario sea un técnico autenticado y asignado a ese ticket de soporte.
 * Impide que un usuario no autorizado inicie el cronómetro de otro técnico.
 */
export function autorizarInicioLectura(
  ticket: TicketAuthInput | null | undefined,
  session: SessionAuthInput | null | undefined
): AutorizacionResultado {
  if (!session?.id || !session.tecnicoId) {
    return {
      ok: false,
      status: 401,
      error: "Solo un técnico autenticado puede iniciar la lectura de atención",
    };
  }
  if (!ticket) {
    return { ok: false, status: 403, error: "No autorizado para este ticket" };
  }
  if (!ticketAdmiteCronometroAtencion(ticket.tipo)) {
    return {
      ok: false,
      status: 400,
      error: "El cronómetro de lectura aplica solo a tickets de soporte al cliente",
    };
  }
  if (!tecnicoAsignadoAlTicket(ticket, session.tecnicoId)) {
    return {
      ok: false,
      status: 403,
      error: "No está autorizado para iniciar el cronómetro de otro técnico",
    };
  }
  if (ESTADOS_TERMINALES.has(ticket.estado)) {
    return {
      ok: false,
      status: 409,
      error: "El ticket ya se encuentra finalizado o cerrado",
    };
  }
  return { ok: true, tecnicoId: session.tecnicoId };
}

export interface CronometroAtencionDbLike {
  ticketCronometroAtencion: {
    findUnique: (args: { where: { ticketId: string } }) => Promise<{
      id: string;
      ticketId: string;
      tecnicoId: string;
      iniciadoPorUsuarioId: string;
      iniciadoEn: Date;
      finalizadoEn: Date | null;
      finalizadoPorUsuarioId: string | null;
      finalizadoPorTecnicoId: string | null;
      duracionSegundos: number | null;
    } | null>;
    create: (args: {
      data: {
        ticketId: string;
        tecnicoId: string;
        iniciadoPorUsuarioId: string;
        iniciadoEn: Date;
      };
    }) => Promise<{
      id: string;
      ticketId: string;
      tecnicoId: string;
      iniciadoPorUsuarioId: string;
      iniciadoEn: Date;
      finalizadoEn: Date | null;
      finalizadoPorUsuarioId: string | null;
      finalizadoPorTecnicoId: string | null;
      duracionSegundos: number | null;
    }>;
    updateMany: (args: {
      where: { ticketId: string; finalizadoEn: null };
      data: {
        finalizadoEn: Date;
        duracionSegundos: number;
        finalizadoPorUsuarioId: string;
        finalizadoPorTecnicoId: string;
      };
    }) => Promise<{ count: number }>;
  };
  eventoTicket?: {
    create: (args: {
      data: {
        ticketId: string;
        usuarioId: string;
        accion: string;
        metadata?: string;
      };
    }) => Promise<unknown>;
  };
}

function esErrorUnicidadPrisma(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = (err as { code?: unknown }).code;
  return code === "P2002";
}

export type OrigenInicioLecturaAtencion =
  | "lectura_ticket"
  | "inicio_en_proceso"
  | "manual_tecnico"
  | "recuperacion_en_proceso";

/**
 * Inicia el cronómetro de lectura y atención de forma idempotente y segura ante concurrencia.
 * Nunca crea dos inicios para el mismo ticket (índice único en ticketId + manejo de P2002).
 */
export async function iniciarLecturaAtencion(params: {
  ticketId: string;
  tecnicoId: string;
  usuarioId: string;
  origen?: OrigenInicioLecturaAtencion;
  ahora?: Date;
  db?: CronometroAtencionDbLike;
}): Promise<{
  creado: boolean;
  yaIniciado: boolean;
  cronometro: CronometroAtencionView;
}> {
  const db = params.db ?? (prisma as unknown as CronometroAtencionDbLike);
  const ahora = params.ahora ?? new Date();

  const existente = await db.ticketCronometroAtencion.findUnique({
    where: { ticketId: params.ticketId },
  });
  if (existente) {
    return {
      creado: false,
      yaIniciado: true,
      cronometro: derivarEstadoCronometroAtencion(existente, ahora.getTime()),
    };
  }

  try {
    const creado = await db.ticketCronometroAtencion.create({
      data: {
        ticketId: params.ticketId,
        tecnicoId: params.tecnicoId,
        iniciadoPorUsuarioId: params.usuarioId,
        iniciadoEn: ahora,
      },
    });
    if (db.eventoTicket) {
      await db.eventoTicket.create({
        data: {
          ticketId: params.ticketId,
          usuarioId: params.usuarioId,
          accion: "LECTURA_ATENCION_INICIADA",
          metadata: JSON.stringify({
            tecnicoId: params.tecnicoId,
            iniciadoEn: ahora.toISOString(),
            origen: params.origen ?? "manual_tecnico",
          }),
        },
      });
    }
    return {
      creado: true,
      yaIniciado: false,
      cronometro: derivarEstadoCronometroAtencion(creado, ahora.getTime()),
    };
  } catch (err) {
    if (esErrorUnicidadPrisma(err)) {
      const concurrente = await db.ticketCronometroAtencion.findUnique({
        where: { ticketId: params.ticketId },
      });
      if (concurrente) {
        return {
          creado: false,
          yaIniciado: true,
          cronometro: derivarEstadoCronometroAtencion(concurrente, ahora.getTime()),
        };
      }
    }
    throw err;
  }
}

/**
 * Sincroniza el inicio del cronómetro de lectura y atención al marcar LEIDO (apertura de orden).
 * Solo actúa si el ticket admite cronómetro de atención y está en PENDIENTE o LEIDO.
 * No altera automáticamente tickets que ya estaban EN_PROCESO sin cronómetro.
 */
export async function sincronizarCronometroEnLectura(params: {
  ticket: { id: string; tipo: string; estado: string };
  tecnicoId: string;
  usuarioId: string;
  ahora?: Date;
  db?: CronometroAtencionDbLike;
}): Promise<{
  ejecutado: boolean;
  creado: boolean;
  yaIniciado: boolean;
  cronometro: CronometroAtencionView | null;
}> {
  if (!ticketAdmiteCronometroAtencion(params.ticket.tipo)) {
    return { ejecutado: false, creado: false, yaIniciado: false, cronometro: null };
  }
  if (params.ticket.estado !== "PENDIENTE" && params.ticket.estado !== "LEIDO") {
    return { ejecutado: false, creado: false, yaIniciado: false, cronometro: null };
  }
  const res = await iniciarLecturaAtencion({
    ticketId: params.ticket.id,
    tecnicoId: params.tecnicoId,
    usuarioId: params.usuarioId,
    origen: "lectura_ticket",
    ahora: params.ahora,
    db: params.db,
  });
  return {
    ejecutado: true,
    creado: res.creado,
    yaIniciado: res.yaIniciado,
    cronometro: res.cronometro,
  };
}

/**
 * Asegura que el cronómetro de atención esté iniciado al pasar el ticket a EN_PROCESO
 * (por ejemplo si el técnico pulsó Iniciar trabajo directamente). Idempotente.
 */
export async function sincronizarCronometroEnProceso(params: {
  ticket: { id: string; tipo: string; estadoAnterior: string };
  cronometroTrabajoYaIniciado?: boolean;
  tecnicoId: string;
  usuarioId: string;
  ahora?: Date;
  db?: CronometroAtencionDbLike;
}): Promise<{
  ejecutado: boolean;
  creado: boolean;
  yaIniciado: boolean;
  cronometro: CronometroAtencionView | null;
}> {
  if (!ticketAdmiteCronometroAtencion(params.ticket.tipo)) {
    return { ejecutado: false, creado: false, yaIniciado: false, cronometro: null };
  }
  const transicionAEnProceso =
    params.ticket.estadoAnterior === "PENDIENTE" ||
    params.ticket.estadoAnterior === "LEIDO" ||
    params.cronometroTrabajoYaIniciado === false;
  if (!transicionAEnProceso) {
    return { ejecutado: false, creado: false, yaIniciado: false, cronometro: null };
  }
  const res = await iniciarLecturaAtencion({
    ticketId: params.ticket.id,
    tecnicoId: params.tecnicoId,
    usuarioId: params.usuarioId,
    origen: "inicio_en_proceso",
    ahora: params.ahora,
    db: params.db,
  });
  return {
    ejecutado: true,
    creado: res.creado,
    yaIniciado: res.yaIniciado,
    cronometro: res.cronometro,
  };
}

/**
 * Detiene el cronómetro de lectura y atención DENTRO de la transacción de guardado del informe.
 * Si el guardado del informe falla antes o dentro de la transacción, el cronómetro permanece activo.
 */
export async function detenerCronometroAtencionEnTx(
  tx: CronometroAtencionDbLike,
  params: {
    ticketId: string;
    usuarioId: string;
    tecnicoId: string;
    ahora?: Date;
  }
): Promise<{ detenido: boolean; duracionSegundos: number | null }> {
  const ahora = params.ahora ?? new Date();
  const actual = await tx.ticketCronometroAtencion.findUnique({
    where: { ticketId: params.ticketId },
  });

  if (!actual || actual.finalizadoEn != null) {
    return {
      detenido: false,
      duracionSegundos: actual?.duracionSegundos ?? null,
    };
  }

  const duracionSegundos = calcularDuracionAtencionSegundos(
    actual.iniciadoEn,
    ahora,
    null,
    ahora.getTime()
  );

  const upd = await tx.ticketCronometroAtencion.updateMany({
    where: { ticketId: params.ticketId, finalizadoEn: null },
    data: {
      finalizadoEn: ahora,
      duracionSegundos,
      finalizadoPorUsuarioId: params.usuarioId,
      finalizadoPorTecnicoId: params.tecnicoId,
    },
  });

  return {
    detenido: upd.count > 0,
    duracionSegundos,
  };
}
