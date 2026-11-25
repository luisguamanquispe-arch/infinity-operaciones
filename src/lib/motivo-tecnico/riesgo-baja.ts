import "server-only";
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { validarObservacionesRecuperacion } from "./reglas-patch";

export const ACCION_ALERTA_RIESGO_BAJA = "ALERTA_CLIENTE_RIESGO_BAJA";
export const ACCION_GESTION_RIESGO_BAJA = "GESTION_CLIENTE_RIESGO_BAJA";
export const ACCION_RIESGO_BAJA_RESUELTO = "CLIENTE_RIESGO_BAJA_RESUELTO";
export const ACCION_PRIORIDAD_CAMBIADA = "PRIORIDAD_CAMBIADA";

type Db = PrismaClient | Prisma.TransactionClient;

function esConflictoUnico(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "P2002"
  );
}

async function asegurarAlertaRiesgoUnaVez(
  db: Db,
  opts: {
    ticketId: string;
    usuarioId: string;
    codigo: string;
    motivoInconformidad: string;
    activadoEn: Date;
  }
): Promise<void> {
  const ya = await db.eventoTicket.findFirst({
    where: { ticketId: opts.ticketId, accion: ACCION_ALERTA_RIESGO_BAJA },
    select: { id: true },
  });
  if (ya) return;
  try {
    await db.eventoTicket.create({
      data: {
        ticketId: opts.ticketId,
        usuarioId: opts.usuarioId,
        accion: ACCION_ALERTA_RIESGO_BAJA,
        metadata: JSON.stringify({
          codigo: opts.codigo,
          motivo: opts.motivoInconformidad.slice(0, 500),
          activadoEn: opts.activadoEn.toISOString(),
        }),
      },
    });
    console.log(
      `[RiesgoBaja] Alerta Supervisor — ticket ${opts.codigo}: cliente manifiesta intención de cancelar`
    );
  } catch (err) {
    if (!esConflictoUnico(err)) throw err;
  }
}

/**
 * Activa riesgo de baja de forma idempotente (claim atómico con updateMany).
 * Fuerza prioridad ALTA. No altera contratos ni ejecuta bajas.
 */
export async function activarRiesgoBaja(opts: {
  ticketId: string;
  usuarioId: string;
  motivoInconformidad: string;
  db?: Db;
}): Promise<{ yaActivo: boolean }> {
  const run = async (db: Db): Promise<{ yaActivo: boolean }> => {
    const ticket = await db.ticket.findUnique({
      where: { id: opts.ticketId },
      select: {
        id: true,
        prioridad: true,
        clienteRiesgoBaja: true,
        codigo: true,
      },
    });
    if (!ticket) return { yaActivo: false };

    const now = new Date();
    const motivo = opts.motivoInconformidad.slice(0, 2000);

    const claimed = await db.ticket.updateMany({
      where: { id: opts.ticketId, clienteRiesgoBaja: false },
      data: {
        clienteRiesgoBaja: true,
        clienteRiesgoBajaMotivo: motivo,
        clienteRiesgoBajaActivadoEn: now,
        clienteRiesgoBajaActivadoPorId: opts.usuarioId,
        clienteRiesgoBajaResueltoEn: null,
        clienteRiesgoBajaResueltoPorId: null,
        ...(ticket.prioridad !== "ALTA" ? { prioridad: "ALTA" as const } : {}),
      },
    });

    if (claimed.count === 0) {
      await asegurarAlertaRiesgoUnaVez(db, {
        ticketId: opts.ticketId,
        usuarioId: opts.usuarioId,
        codigo: ticket.codigo,
        motivoInconformidad: motivo,
        activadoEn: now,
      });
      return { yaActivo: true };
    }

    if (ticket.prioridad !== "ALTA") {
      await db.eventoTicket.create({
        data: {
          ticketId: opts.ticketId,
          usuarioId: opts.usuarioId,
          accion: ACCION_PRIORIDAD_CAMBIADA,
          metadata: JSON.stringify({
            de: ticket.prioridad,
            a: "ALTA",
            motivo: "cliente_riesgo_baja",
          }),
        },
      });
    }

    await asegurarAlertaRiesgoUnaVez(db, {
      ticketId: opts.ticketId,
      usuarioId: opts.usuarioId,
      codigo: ticket.codigo,
      motivoInconformidad: motivo,
      activadoEn: now,
    });

    return { yaActivo: false };
  };

  if (opts.db) return run(opts.db);
  return prisma.$transaction((tx) => run(tx));
}

export async function registrarGestionRiesgoBaja(opts: {
  ticketId: string;
  usuarioId: string;
  usuarioNombre: string;
  resultado: "CONTACTO_REALIZADO" | "RECUPERADO" | "CONTINUA_RIESGO";
  observaciones?: string | null;
  db?: Db;
}): Promise<{ resuelto: boolean }> {
  const run = async (db: Db): Promise<{ resuelto: boolean }> => {
    const ticket = await db.ticket.findUnique({
      where: { id: opts.ticketId },
      select: {
        id: true,
        clienteRiesgoBaja: true,
        clienteRiesgoBajaResueltoEn: true,
      },
    });
    if (!ticket?.clienteRiesgoBaja) {
      throw new Error("El ticket no tiene alerta de riesgo de baja activa");
    }
    if (ticket.clienteRiesgoBajaResueltoEn) {
      throw new Error(
        "El riesgo de baja ya fue resuelto; no se aceptan gestiones adicionales"
      );
    }

    let observaciones = opts.observaciones?.trim() || null;
    if (opts.resultado === "RECUPERADO") {
      const obsVal = validarObservacionesRecuperacion(observaciones);
      if (!obsVal.ok) throw new Error(obsVal.error);
      observaciones = obsVal.texto;
    }

    const now = new Date();

    if (opts.resultado === "RECUPERADO") {
      const claimed = await db.ticket.updateMany({
        where: {
          id: opts.ticketId,
          clienteRiesgoBaja: true,
          clienteRiesgoBajaResueltoEn: null,
        },
        data: {
          clienteRiesgoBajaResueltoEn: now,
          clienteRiesgoBajaResueltoPorId: opts.usuarioId,
        },
      });
      if (claimed.count === 0) {
        throw new Error(
          "El riesgo de baja ya fue resuelto; no se aceptan gestiones adicionales"
        );
      }

      await db.ticketGestionRiesgoBaja.create({
        data: {
          ticketId: opts.ticketId,
          usuarioId: opts.usuarioId,
          usuarioNombre: opts.usuarioNombre,
          resultado: opts.resultado,
          observaciones,
        },
      });

      await db.eventoTicket.create({
        data: {
          ticketId: opts.ticketId,
          usuarioId: opts.usuarioId,
          accion: ACCION_GESTION_RIESGO_BAJA,
          metadata: JSON.stringify({
            resultado: opts.resultado,
            observaciones,
          }),
        },
      });

      try {
        await db.eventoTicket.create({
          data: {
            ticketId: opts.ticketId,
            usuarioId: opts.usuarioId,
            accion: ACCION_RIESGO_BAJA_RESUELTO,
            metadata: JSON.stringify({
              resultado: "RECUPERADO",
              en: now.toISOString(),
            }),
          },
        });
      } catch (err) {
        if (!esConflictoUnico(err)) throw err;
      }

      return { resuelto: true };
    }

    await db.ticketGestionRiesgoBaja.create({
      data: {
        ticketId: opts.ticketId,
        usuarioId: opts.usuarioId,
        usuarioNombre: opts.usuarioNombre,
        resultado: opts.resultado,
        observaciones,
      },
    });

    await db.eventoTicket.create({
      data: {
        ticketId: opts.ticketId,
        usuarioId: opts.usuarioId,
        accion: ACCION_GESTION_RIESGO_BAJA,
        metadata: JSON.stringify({
          resultado: opts.resultado,
          observaciones,
        }),
      },
    });

    return { resuelto: false };
  };

  if (opts.db) return run(opts.db);
  return prisma.$transaction((tx) => run(tx));
}

export { alertaRiesgoBajaActiva } from "./validacion";
