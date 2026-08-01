import type { IrEstadoReporte, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function registrarIrHistorial(
  tx: Prisma.TransactionClient | typeof prisma,
  params: {
    reporteId: string;
    usuarioId: string;
    usuarioNombre: string;
    estado: IrEstadoReporte;
    nota?: string | null;
  }
) {
  await tx.irHistorial.create({
    data: {
      reporteId: params.reporteId,
      usuarioId: params.usuarioId,
      usuarioNombre: params.usuarioNombre,
      estado: params.estado,
      nota: params.nota?.trim() || null,
    },
  });
}
