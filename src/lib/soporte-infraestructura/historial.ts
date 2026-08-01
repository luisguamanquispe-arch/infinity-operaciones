import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function registrarSiHistorial(
  tx: Prisma.TransactionClient | typeof prisma,
  params: {
    ticketId: string;
    usuarioId?: string | null;
    usuarioNombre: string;
    accion: string;
    detalle?: string | null;
  }
) {
  await tx.siHistorial.create({
    data: {
      ticketId: params.ticketId,
      usuarioId: params.usuarioId || null,
      usuarioNombre: params.usuarioNombre,
      accion: params.accion,
      detalle: params.detalle?.trim() || null,
    },
  });
}
