import { NextResponse } from "next/server";
import { getFullSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { iniciarCronometroTicket } from "@/lib/cronometro";
import { tecnicoAsignadoAlTicket } from "@/lib/ticket-tecnicos";
import { asegurarReportadorOrden, infoReporteOrden } from "@/lib/ticket-reporte";
import { verificarTicketEditable } from "@/lib/ticket-cerrado";

/** Una sola vez al abrir la orden: reclama reporte (multi-técnico) e inicia cronómetro. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getFullSession();
  if (!session?.tecnicoId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const lat = typeof body.lat === "number" ? body.lat : null;
  const lng = typeof body.lng === "number" ? body.lng : null;

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: { tecnicos: { select: { tecnicoId: true } } },
  });

  if (!ticket || !tecnicoAsignadoAlTicket(ticket, session.tecnicoId)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const editable = await verificarTicketEditable(id);
  if (!editable.ok) {
    return NextResponse.json({ ok: true, yaCerrado: true });
  }

  if (["CERRADO", "FINALIZADO", "CANCELADO"].includes(ticket.estado)) {
    return NextResponse.json({ ok: true, yaCerrado: true });
  }

  const permiso = await asegurarReportadorOrden(id, session.tecnicoId);
  if (!permiso.ok) {
    const reporte = await infoReporteOrden(id, session.tecnicoId);
    return NextResponse.json(
      {
        ok: false,
        error: permiso.error,
        reporte,
      },
      { status: permiso.status }
    );
  }

  await iniciarCronometroTicket({
    ticketId: id,
    tecnicoId: session.tecnicoId,
    usuarioId: session.id,
    lat,
    lng,
  });

  const reporte = await infoReporteOrden(id, session.tecnicoId);

  return NextResponse.json({ ok: true, reporte });
}
