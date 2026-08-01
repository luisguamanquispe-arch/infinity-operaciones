import type { Prisma } from "@prisma/client";

export const irReporteInclude = {
  tecnico: { include: { usuario: { select: { id: true, nombre: true, email: true } } } },
  supervisor: { select: { id: true, nombre: true, email: true } },
  materiales: { include: { inventario: { select: { id: true, nombre: true, stock: true, unidad: true } } } },
  equipos: true,
  participantes: {
    include: { tecnico: { include: { usuario: { select: { id: true, nombre: true } } } } },
  },
  clientesAfectados: {
    include: {
      cliente: { select: { id: true, nombre: true, cedula: true, telefono: true, sector: true } },
    },
  },
  fotografias: { orderBy: { tomadaEn: "asc" as const } },
  firmas: true,
  historial: { orderBy: { fecha: "desc" as const }, take: 100 },
} satisfies Prisma.IrReporteInclude;
