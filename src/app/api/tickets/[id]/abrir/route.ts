import { NextResponse } from "next/server";
import { getFullSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { tecnicoAsignadoAlTicket } from "@/lib/ticket-tecnicos";
import { asegurarColaboracionOrden, infoReporteOrden } from "@/lib/ticket-reporte";
import { verificarTicketEditable } from "@/lib/ticket-cerrado";
import { FLUJO_TICKET, logFlujoTicket } from "@/lib/ticket-flujo-log";

/**
 * Al abrir la orden: marca LEIDO (semáforo). F5/E4: no reclama reportador.
 * No inicia el cronómetro: eso pasa al pulsar Iniciar (→ EN_PROCESO).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getFullSession();
  if (!session?.tecnicoId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  // GPS opcional en body (compat); no se usa al solo marcar leído
  await request.json().catch(() => ({}));

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

  const permiso = await asegurarColaboracionOrden(id, session.tecnicoId);
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

  if (ticket.estado === "PENDIENTE") {
    try {
      await prisma.ticket.update({
        where: { id },
        data: { estado: "LEIDO" },
      });
      await prisma.eventoTicket.create({
        data: {
          ticketId: id,
          usuarioId: session.id,
          accion: "TICKET_LEIDO",
          metadata: "Técnico abrió la orden — semáforo: leído",
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[abrir] No se pudo marcar LEIDO:", msg);
      return NextResponse.json(
        {
          ok: false,
          error:
            "No se pudo marcar el ticket como leído. Falta migrar el enum LEIDO en la base de datos.",
          detail: msg.includes("LEIDO") ? "enum_leido_missing" : "update_failed",
        },
        { status: 503 }
      );
    }
  }

  const reporte = await infoReporteOrden(id, session.tecnicoId);

  logFlujoTicket(FLUJO_TICKET.TICKET_RECEIVED_BY_TECHNICIAN, {
    ticketId: id,
    codigo: ticket.codigo,
    clienteId: ticket.clienteId,
    tecnicoId: session.tecnicoId,
    estado: ticket.estado === "PENDIENTE" ? "LEIDO" : ticket.estado,
    resultado: "recibido",
  });

  return NextResponse.json({
    ok: true,
    reporte,
    estado: ticket.estado === "PENDIENTE" ? "LEIDO" : ticket.estado,
  });
}
