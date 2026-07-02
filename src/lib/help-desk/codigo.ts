import { prisma } from "@/lib/prisma";

/** Genera código HD-1001, HD-1002… */
export async function generarCodigoHelpDesk(): Promise<string> {
  const rows = await prisma.hdConversacion.findMany({
    select: { codigo: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  let max = 1000;
  for (const r of rows) {
    const m = r.codigo.match(/^HD-(\d+)$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `HD-${max + 1}`;
}
