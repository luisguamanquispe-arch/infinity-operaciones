import { prisma } from "@/lib/prisma";

export async function registrarAuditoriaVehiculo(opts: {
  vehiculoId?: string | null;
  entidad: string;
  registroId: string;
  usuarioId?: string | null;
  accion: string;
  motivo?: string | null;
  valorAnterior?: unknown;
  valorNuevo?: unknown;
}) {
  await prisma.vehiculoAuditoria.create({
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
