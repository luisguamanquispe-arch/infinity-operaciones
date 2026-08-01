import { prisma } from "@/lib/prisma";

/** Genera códigos IR-1001, IR-1002, … */
export async function generarCodigoIrReporte(): Promise<string> {
  const rows = await prisma.irReporte.findMany({ select: { codigo: true } });
  let max = 1000;
  const re = /^IR-(\d+)$/;
  for (const r of rows) {
    const m = r.codigo.match(re);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `IR-${max + 1}`;
}
