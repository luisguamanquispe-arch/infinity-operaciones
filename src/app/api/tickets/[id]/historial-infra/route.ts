import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFullSession } from "@/lib/auth";
import { tecnicoAsignadoAlTicket } from "@/lib/ticket-tecnicos";
import { esTicketInfraestructura } from "@/lib/ticket-infraestructura";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getFullSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: { tecnicos: { select: { tecnicoId: true } } },
  });
  if (!ticket || !esTicketInfraestructura(ticket.tipo)) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }
  if (
    session.rol === "TECNICO" &&
    (!session.tecnicoId || !tecnicoAsignadoAlTicket(ticket, session.tecnicoId))
  ) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const historial = await prisma.siHistorial.findMany({
    where: { ticketId: id },
    orderBy: { fecha: "desc" },
    take: 200,
  });

  return NextResponse.json({ historial });
}
