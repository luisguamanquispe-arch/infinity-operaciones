import { prisma } from "@/lib/prisma";

/** Genera códigos SR-1001, SR-1002, … */
export async function generarCodigoSrTicket(): Promise<string> {
  const rows = await prisma.srTicket.findMany({ select: { codigo: true } });
  let max = 1000;
  const re = /^SR-(\d+)$/;
  for (const r of rows) {
    const m = r.codigo.match(re);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `SR-${max + 1}`;
}
