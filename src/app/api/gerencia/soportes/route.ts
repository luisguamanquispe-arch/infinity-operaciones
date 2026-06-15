import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFullSession } from "@/lib/auth";
import { nombresTecnicosTicket, ticketIncludeTecnicos } from "@/lib/ticket-tecnicos";

export async function GET(request: Request) {
  const session = await getFullSession();
  if (!session || session.rol !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const estado = searchParams.get("estado")?.trim();

  const and: Record<string, unknown>[] = [{ tipo: "SOPORTE" }];

  if (estado && estado !== "todos") {
    and.push({ estado });
  }

  if (q) {
    and.push({
      OR: [
        { codigo: { contains: q, mode: "insensitive" } },
        { motivo: { contains: q, mode: "insensitive" } },
        { cliente: { nombre: { contains: q, mode: "insensitive" } } },
        { cliente: { cedula: { contains: q } } },
      ],
    });
  }

  const tickets = await prisma.ticket.findMany({
    where: { AND: and },
    include: {
      ...ticketIncludeTecnicos,
      orden: {
        select: {
          finalizadoEn: true,
          _count: { select: { materiales: true, fotografias: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({
    items: tickets.map((t) => ({
      id: t.id,
      codigo: t.codigo,
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
