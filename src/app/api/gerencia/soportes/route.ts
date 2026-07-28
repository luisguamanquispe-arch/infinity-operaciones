import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFullSession } from "@/lib/auth";
import { nombresTecnicosTicket, ticketIncludeTecnicos } from "@/lib/ticket-tecnicos";
import { whereTicketOperativamenteAbierto } from "@/lib/ticket-cerrado";
import {
  TIPOS_ELIMINABLES_GERENCIA,
  esCodigoTicketExacto,
} from "@/lib/ticket-gerencia";
import type { EstadoTicket, Prisma } from "@prisma/client";

const ESTADOS_VALIDOS: EstadoTicket[] = [
  "PENDIENTE",
  "LEIDO",
  "EN_PROCESO",
  "FINALIZADO",
  "CERRADO",
  "CANCELADO",
];

export async function GET(request: Request) {
  const session = await getFullSession();
  if (!session || session.rol !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // F4/E5: GET solo lectura — no sincronizar cierres en masa.

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const estado = searchParams.get("estado")?.trim() || "activos";

  const and: Prisma.TicketWhereInput[] = [
    { tipo: { in: TIPOS_ELIMINABLES_GERENCIA } },
  ];

  const busquedaExacta = q ? esCodigoTicketExacto(q) : false;

  if (!busquedaExacta) {
    if (estado === "activos") {
      and.push(whereTicketOperativamenteAbierto());
    } else if (estado !== "todos" && ESTADOS_VALIDOS.includes(estado as EstadoTicket)) {
      and.push({ estado: estado as EstadoTicket });
    }
  }

  if (q) {
    if (busquedaExacta) {
      and.push({ codigo: { equals: q.toUpperCase(), mode: "insensitive" } });
    } else {
      and.push({
        OR: [
          { codigo: { contains: q, mode: "insensitive" } },
          { motivo: { contains: q, mode: "insensitive" } },
          { cliente: { nombre: { contains: q, mode: "insensitive" } } },
          { cliente: { cedula: { contains: q } } },
        ],
      });
    }
  }

  const tickets = await prisma.ticket.findMany({
    where: { AND: and },
    include: {
      ...ticketIncludeTecnicos,
      cliente: { select: { nombre: true, cedula: true, sector: true } },
      orden: {
        select: {
          finalizadoEn: true,
          _count: { select: { materiales: true, fotografias: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    total: tickets.length,
    items: tickets.map((t) => ({
      id: t.id,
      codigo: t.codigo,
      tipo: t.tipo,
      estado: t.estado,
      prioridad: t.prioridad,
      motivo: t.motivo,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      programadoEn: t.programadoEn,
      cliente: {
        nombre: t.cliente.nombre,
        cedula: t.cliente.cedula,
        sector: t.cliente.sector,
      },
      tecnicosLabel: nombresTecnicosTicket(t),
      totalMateriales: t.orden?._count.materiales ?? 0,
      totalFotos: t.orden?._count.fotografias ?? 0,
      finalizadoEn: t.orden?.finalizadoEn ?? null,
    })),
  });
}
