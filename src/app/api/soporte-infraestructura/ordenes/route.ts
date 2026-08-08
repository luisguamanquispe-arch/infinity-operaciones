import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getFullSession } from "@/lib/auth";
import { ticketIncludeTecnicos, nombresTecnicosTicket } from "@/lib/ticket-tecnicos";
import { SI_ESTADO_LABELS, SI_TIPO_TRABAJO_LABELS } from "@/lib/ticket-infraestructura";
import { whereTicketNoAtendido } from "@/lib/ticket-antiguedad";

export async function GET(request: Request) {
  const session = await getFullSession();
  if (!session || !["SUPERVISOR", "ADMIN"].includes(session.rol)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const estado = searchParams.get("estado")?.trim();
  const tecnicoId = searchParams.get("tecnicoId")?.trim();
  const sector = searchParams.get("sector")?.trim();
  const siTipoTrabajo = searchParams.get("siTipoTrabajo")?.trim();
  const q = searchParams.get("q")?.trim();
  const take = Math.min(100, Math.max(1, parseInt(searchParams.get("take") || "50", 10)));

  const where: Prisma.TicketWhereInput = {
    AND: [
      {
        tipo: "INFRAESTRUCTURA",
        ...(estado ? { estado: estado as Prisma.EnumEstadoTicketFilter["equals"] } : {}),
        ...(tecnicoId
          ? {
              OR: [{ tecnicoId }, { tecnicos: { some: { tecnicoId } } }],
            }
          : {}),
        ...(sector
          ? {
              OR: [
                { sectorInfra: { contains: sector, mode: "insensitive" } },
                { zonaInfra: { contains: sector, mode: "insensitive" } },
              ],
            }
          : {}),
        ...(siTipoTrabajo ? { siTipoTrabajo: siTipoTrabajo as never } : {}),
        ...(q
          ? {
              OR: [
                { codigo: { contains: q, mode: "insensitive" } },
                { sectorInfra: { contains: q, mode: "insensitive" } },
                { direccionInfra: { contains: q, mode: "insensitive" } },
                { nodoAfectado: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      // Sin atención ≥4 días: solo en /supervisor/no-atendidos
      { NOT: whereTicketNoAtendido() },
    ],
  };

  const tickets = await prisma.ticket.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take,
    include: {
      ...ticketIncludeTecnicos,
      tecnico: { include: { usuario: { select: { nombre: true } } } },
    },
  });

  return NextResponse.json({
    ordenes: tickets.map((t) => ({
      id: t.id,
      codigo: t.codigo,
      fecha: t.createdAt,
      estado: t.estado,
      estadoLabel: SI_ESTADO_LABELS[t.estado] || t.estado,
      prioridad: t.prioridad,
      siTipoTrabajo: t.siTipoTrabajo,
      tipoLabel: t.siTipoTrabajo
        ? SI_TIPO_TRABAJO_LABELS[t.siTipoTrabajo]
        : t.motivo || "—",
      sector: t.sectorInfra || t.zonaInfra || "—",
      direccion: t.direccionInfra || t.nodoAfectado || "—",
      tecnicoResponsable: t.tecnico?.usuario.nombre ?? "—",
      cantidadTecnicos: t.tecnicos?.length ?? (t.tecnicoId ? 1 : 0),
      tecnicosLabel: nombresTecnicosTicket(t),
    })),
  });
}
