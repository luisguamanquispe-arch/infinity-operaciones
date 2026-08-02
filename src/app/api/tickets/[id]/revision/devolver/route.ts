import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFullSession } from "@/lib/auth";
import {
  MOTIVOS_DEVOLUCION,
  puedeRevisarReportes,
  registrarRevisionHistorial,
  reporteEnColaRevision,
} from "@/lib/revision-reporte";
import { notificarTecnicoDevolucion } from "@/lib/notificaciones-revision";
import { esTicketInfraestructura } from "@/lib/ticket-infraestructura";
import { registrarSiHistorial } from "@/lib/soporte-infraestructura/historial";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getFullSession();
  if (!session || !puedeRevisarReportes(session.rol)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const motivo = String(body.motivo || "").trim();
  const observaciones = String(body.observaciones || "").trim() || null;

  if (!motivo || motivo.length < 3) {
    return NextResponse.json(
      { error: "Indique el motivo de la devolución (obligatorio)" },
      { status: 400 }
    );
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      tecnico: { include: { usuario: { select: { nombre: true } } } },
      orden: { select: { id: true } },
      cliente: { select: { nombre: true, sector: true } },
    },
  });

  if (!ticket) {
    return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });
  }

  if (!reporteEnColaRevision(ticket.estadoRevision)) {
    return NextResponse.json(
      { error: "Solo se pueden devolver reportes pendientes de revisión o corregidos" },
      { status: 409 }
    );
  }

  const anterior = ticket.estadoRevision;

  await prisma.$transaction(async (tx) => {
    if (ticket.orden) {
      await tx.ordenServicio.update({
        where: { id: ticket.orden.id },
        data: { finalizadoEn: null },
      });
    }
    await tx.ticket.update({
      where: { id },
      data: { estadoRevision: "DEVUELTO_CORRECCION", estado: "FINALIZADO" },
    });
    await registrarRevisionHistorial(tx, {
      ticketId: id,
      accion: "DEVUELTO_CORRECCION",
      estadoAnterior: anterior,
      estadoNuevo: "DEVUELTO_CORRECCION",
      motivo,
      observaciones,
      usuarioId: session.id,
      usuarioNombre: session.nombre,
    });
  });

  if (esTicketInfraestructura(ticket.tipo)) {
    await registrarSiHistorial(prisma, {
      ticketId: id,
      usuarioId: session.id,
      usuarioNombre: session.nombre,
      accion: "REPORTE_DEVUELTO",
      detalle: motivo,
    });
  }

  await prisma.eventoTicket.create({
    data: {
      ticketId: id,
      usuarioId: session.id,
      accion: "REPORTE_DEVUELTO",
      metadata: JSON.stringify({ motivo, observaciones }),
    },
  });

  if (ticket.tecnico) {
    await notificarTecnicoDevolucion({
      codigo: ticket.codigo,
      motivo,
      observaciones,
      supervisorNombre: session.nombre,
      tecnico: {
        telefono: ticket.tecnico.telefono,
        nombre: ticket.tecnico.usuario.nombre,
      },
    });
  }

  return NextResponse.json({
    ok: true,
    estadoRevision: "DEVUELTO_CORRECCION",
    motivosSugeridos: MOTIVOS_DEVOLUCION,
  });
}
