import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Descuenta stock de inventario vinculado a materiales del reporte.
 * Idempotente vía flag inventarioDescontado.
 */
export async function descontarInventarioIrReporte(
  tx: Prisma.TransactionClient,
  reporteId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const reporte = await tx.irReporte.findUnique({
    where: { id: reporteId },
    include: { materiales: true },
  });
  if (!reporte) return { ok: false, error: "Reporte no encontrado" };
  if (reporte.inventarioDescontado) return { ok: true };

  const conStock = reporte.materiales.filter((m) => m.inventarioId);
  for (const m of conStock) {
    const inv = await tx.inventario.findUnique({ where: { id: m.inventarioId! } });
    if (!inv) {
      return { ok: false, error: `Inventario no encontrado para material ${m.material}` };
    }
    if (inv.stock < m.cantidad) {
      return {
        ok: false,
        error: `Stock insuficiente de ${inv.nombre}: disponible ${inv.stock}, requerido ${m.cantidad}`,
      };
    }
  }

  for (const m of conStock) {
    await tx.inventario.update({
      where: { id: m.inventarioId! },
      data: { stock: { decrement: m.cantidad } },
    });
  }

  await tx.irReporte.update({
    where: { id: reporteId },
    data: { inventarioDescontado: true },
  });

  return { ok: true };
}

export async function listarInventarioConsumible() {
  return prisma.inventario.findMany({
    where: { tipo: { in: ["CONSUMIBLE", "PATCHCORD"] } },
    orderBy: { nombre: "asc" },
    select: { id: true, nombre: true, unidad: true, stock: true },
  });
}
