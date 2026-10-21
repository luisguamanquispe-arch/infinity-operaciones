import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type ClienteAuditoria = Prisma.TransactionClient | typeof prisma;

export async function registrarAuditoriaVehiculo(opts: {
  vehiculoId?: string | null;
  entidad: string;
  registroId: string;
  usuarioId?: string | null;
  accion: string;
  motivo?: string | null;
  valorAnterior?: unknown;
  valorNuevo?: unknown;
  tx?: ClienteAuditoria;
}) {
  const db = opts.tx ?? prisma;
  await db.vehiculoAuditoria.create({
    data: {
      vehiculoId: opts.vehiculoId ?? null,
      entidad: opts.entidad,
      registroId: opts.registroId,
      usuarioId: opts.usuarioId ?? null,
      accion: opts.accion,
      motivo: opts.motivo ?? null,
      valorAnterior:
        opts.valorAnterior === undefined
          ? null
          : JSON.stringify(opts.valorAnterior),
      valorNuevo:
        opts.valorNuevo === undefined ? null : JSON.stringify(opts.valorNuevo),
    },
  });
}
