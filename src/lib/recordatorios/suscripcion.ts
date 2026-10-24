import type { PrismaClient } from "@prisma/client";

export type AccionSuscripcionPush = "crear" | "actualizar" | "desvincular_y_crear";

export type SuscripcionExistente = {
  id: string;
  tecnicoId: string;
};

/**
 * Política explícita:
 * - Endpoint nuevo → crear para el técnico autenticado.
 * - Mismo técnico → actualizar claves.
 * - Otro técnico (mismo navegador / misma suscripción Web Push) → borrar la
 *   fila anterior y crear una nueva. El dueño previo deja de recibir push en
 *   ese dispositivo; su inbox interno no se mueve ni se expone.
 *
 * No se puede “tomar” un endpoint ajeno sin poseer las claves p256dh/auth,
 * que solo están en el navegador que generó la suscripción.
 */
export function decidirAccionSuscripcionPush(
  existente: SuscripcionExistente | null,
  tecnicoId: string
): AccionSuscripcionPush {
  if (!existente) return "crear";
  if (existente.tecnicoId === tecnicoId) return "actualizar";
  return "desvincular_y_crear";
}

type DbSuscripcion = Pick<PrismaClient, "tecnicoPushSubscription" | "$transaction">;

export async function registrarSuscripcionPush(
  db: DbSuscripcion,
  opts: {
    tecnicoId: string;
    endpoint: string;
    p256dh: string;
    auth: string;
    userAgent?: string | null;
  }
): Promise<{ accion: AccionSuscripcionPush }> {
  return db.$transaction(async (tx) => {
    const existente = await tx.tecnicoPushSubscription.findUnique({
      where: { endpoint: opts.endpoint },
      select: { id: true, tecnicoId: true },
    });
    const accion = decidirAccionSuscripcionPush(existente, opts.tecnicoId);

    if (accion === "actualizar" && existente) {
      await tx.tecnicoPushSubscription.update({
        where: { id: existente.id },
        data: {
          p256dh: opts.p256dh,
          auth: opts.auth,
          userAgent: opts.userAgent ?? null,
          activo: true,
        },
      });
      return { accion };
    }

    if (accion === "desvincular_y_crear" && existente) {
      await tx.tecnicoPushSubscription.delete({ where: { id: existente.id } });
    }

    await tx.tecnicoPushSubscription.create({
      data: {
        tecnicoId: opts.tecnicoId,
        endpoint: opts.endpoint,
        p256dh: opts.p256dh,
        auth: opts.auth,
        userAgent: opts.userAgent ?? null,
        activo: true,
      },
    });
    return { accion };
  });
}

export async function desactivarSuscripcionPush(
  db: Pick<PrismaClient, "tecnicoPushSubscription">,
  opts: { tecnicoId: string; endpoint: string }
): Promise<number> {
  const res = await db.tecnicoPushSubscription.updateMany({
    where: { tecnicoId: opts.tecnicoId, endpoint: opts.endpoint },
    data: { activo: false },
  });
  return res.count;
}
