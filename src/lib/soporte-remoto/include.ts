import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export const srTicketInclude = {
  operador: { select: { id: true, nombre: true, email: true } },
  cliente: { select: { id: true, nombre: true, cedula: true, telefono: true } },
  ticketPresencial: { select: { id: true, codigo: true, estado: true } },
  adjuntos: { orderBy: { createdAt: "asc" as const } },
  historial: {
    orderBy: { fecha: "desc" as const },
    take: 50,
  },
} satisfies Prisma.SrTicketInclude;

export function parseDate(v: unknown): Date | null {
  if (v === null) return null;
  if (!v || typeof v !== "string") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export { prisma };
