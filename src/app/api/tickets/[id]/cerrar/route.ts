import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFullSession } from "@/lib/auth";
import { getOrCreateOrden, validarCierreOrden, enviarWhatsApp } from "@/lib/tickets";
import { tecnicoAsignadoAlTicket, tecnicoIdsFromTicket } from "@/lib/ticket-tecnicos";
import { esClienteInfraestructura } from "@/lib/cliente-infraestructura";
import { esTicketInfraestructura } from "@/lib/ticket-infraestructura";
import { asegurarReportadorOrden } from "@/lib/ticket-reporte";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getFullSession();
  if (!session?.tecnicoId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: { cliente: true, tecnicos: { select: { tecnicoId: true } } },
  });

  if (!ticket || !tecnicoAsignadoAlTicket(ticket, session.tecnicoId)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const permiso = await asegurarReportadorOrden(id, session.tecnicoId);
  if (!permiso.ok) {
    return NextResponse.json(
      { error: permiso.error, reportadoPor: permiso.reportadoPorNombre },
      { status: permiso.status }
    );
  }

  const orden = await getOrCreateOrden(id);
  const validacion = validarCierreOrden(orden, {
    esInfraestructura: esTicketInfraestructura(ticket.tipo),
  });

  if (!validacion.valido) {
    return NextResponse.json({ error: "Validación fallida", errores: validacion.errores }, { status: 400 });
  }

  const now = new Date();

  await prisma.$transaction([
    prisma.ordenServicio.update({
      where: { id: orden.id },
      data: {
        finalizadoEn: now,
        reportadoPorTecnicoId: orden.reportadoPorTecnicoId ?? session.tecnicoId,
        reportadoEn: orden.reportadoEn ?? now,
      },
    }),
    prisma.ticket.update({
      where: { id },
      data: { estado: "CERRADO" },
    }),
    prisma.tecnico.updateMany({
      where: { id: { in: tecnicoIdsFromTicket(ticket) } },
      data: { estadoActual: "DISPONIBLE" },
    }),
  ]);

  if (!esClienteInfraestructura(ticket.cliente.cedula)) {
    await enviarWhatsApp(ticket.codigo, ticket.cliente.telefono);
    await prisma.ordenServicio.update({
      where: { id: orden.id },
      data: { whatsappEnviado: true },
    });
  }

  await prisma.eventoTicket.create({
    data: {
      ticketId: id,
      usuarioId: session.id,
      accion: "TICKET_CERRADO",
      metadata: JSON.stringify({ tecnicoId: session.tecnicoId }),
    },
  });

  return NextResponse.json({ ok: true, codigo: ticket.codigo });
}
