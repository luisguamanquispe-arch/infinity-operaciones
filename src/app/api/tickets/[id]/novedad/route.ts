import { NextResponse } from "next/server";
import { getFullSession } from "@/lib/auth";
import { reportarNovedadTicket, ticketPermiteNovedad } from "@/lib/novedad-ticket";
import { tecnicoAsignadoAlTicket } from "@/lib/ticket-tecnicos";
import { verificarTicketEditable } from "@/lib/ticket-cerrado";
import { prisma } from "@/lib/prisma";
import type { TipoNovedadTicket } from "@prisma/client";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getFullSession();
  if (!session?.tecnicoId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: { tecnicos: { select: { tecnicoId: true } } },
  });

  if (!ticket || !tecnicoAsignadoAlTicket(ticket, session.tecnicoId)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const editable = await verificarTicketEditable(id);
  if (!editable.ok) {
    return NextResponse.json({ error: editable.error }, { status: editable.status });
  }

  if (!ticketPermiteNovedad(ticket.tipo)) {
    return NextResponse.json({ error: "Este ticket no admite novedades de visita" }, { status: 400 });
  }

  const tipo = body.tipo as TipoNovedadTicket;
  if (!tipo || !["CLIENTE_AUSENTE", "SOLICITA_REPROGRAMACION", "OTRO"].includes(tipo)) {
    return NextResponse.json({ error: "Tipo de novedad inválido" }, { status: 400 });
  }

  try {
    const novedad = await reportarNovedadTicket({
      ticketId: id,
      tecnicoId: session.tecnicoId,
      usuarioId: session.id,
      tipo,
      comentario: body.comentario,
      fechaSolicitada: body.fechaSolicitada,
      lat: typeof body.lat === "number" ? body.lat : null,
      lng: typeof body.lng === "number" ? body.lng : null,
    });

    return NextResponse.json({ ok: true, novedad });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error al reportar novedad";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
