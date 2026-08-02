import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFullSession } from "@/lib/auth";
import {
  puedeRevisarReportes,
  registrarRevisionHistorial,
  reporteEnColaRevision,
} from "@/lib/revision-reporte";
import { esClienteInfraestructura } from "@/lib/cliente-infraestructura";
import { enviarWhatsApp } from "@/lib/tickets";
import { esTicketInfraestructura } from "@/lib/ticket-infraestructura";
import { registrarSiHistorial } from "@/lib/soporte-infraestructura/historial";

/** Supervisor/Admin: aprueba el reporte → CERRADO + APROBADO (cierre oficial). */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getFullSession();
  if (!session || !puedeRevisarReportes(session.rol)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      cliente: true,
      orden: { select: { id: true, finalizadoEn: true, whatsappEnviado: true } },
    },
  });

  if (!ticket) {
    return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });
  }

  if (!reporteEnColaRevision(ticket.estadoRevision)) {
    return NextResponse.json(
      { error: "El reporte no está pendiente de revisión o corregido" },
      { status: 409 }
    );
  }

  if (!ticket.orden?.finalizadoEn) {
    return NextResponse.json(
      { error: "La orden no tiene fecha de finalización" },
      { status: 409 }
    );
  }

  const anterior = ticket.estadoRevision;

  await prisma.$transaction(async (tx) => {
    await tx.ticket.update({
      where: { id },
      data: { estado: "CERRADO", estadoRevision: "APROBADO" },
    });
    await registrarRevisionHistorial(tx, {
      ticketId: id,
      accion: "APROBADO",
      estadoAnterior: anterior,
      estadoNuevo: "APROBADO",
      usuarioId: session.id,
      usuarioNombre: session.nombre,
    });
  });

  await prisma.eventoTicket.create({
    data: {
      ticketId: id,
      usuarioId: session.id,
      accion: "REPORTE_APROBADO",
      metadata: JSON.stringify({}),
    },
  });

  if (esTicketInfraestructura(ticket.tipo)) {
    await registrarSiHistorial(prisma, {
      ticketId: id,
      usuarioId: session.id,
      usuarioNombre: session.nombre,
      accion: "REPORTE_APROBADO",
      detalle: "Supervisor aprobó el reporte",
    });
  }

  if (
    ticket.orden &&
    !ticket.orden.whatsappEnviado &&
    !esClienteInfraestructura(ticket.cliente.cedula)
  ) {
    await enviarWhatsApp(ticket.codigo, ticket.cliente.telefono);
    await prisma.ordenServicio.update({
      where: { id: ticket.orden.id },
      data: { whatsappEnviado: true },
    });
  }

  return NextResponse.json({ ok: true, estadoRevision: "APROBADO", codigo: ticket.codigo });
}
