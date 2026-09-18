import { prisma } from "@/lib/prisma";

export async function registrarAuditoriaInventario(opts: {
  entidad: string;
  registroId: string;
  usuarioId?: string | null;
  accion: string;
  ticketId?: string | null;
  motivo?: string | null;
  valorAnterior?: unknown;
  valorNuevo?: unknown;
}) {
  await prisma.inventoryAuditLog.create({
    data: {
      entidad: opts.entidad,
      registroId: opts.registroId,
      usuarioId: opts.usuarioId ?? null,
      accion: opts.accion,
      ticketId: opts.ticketId ?? null,
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
