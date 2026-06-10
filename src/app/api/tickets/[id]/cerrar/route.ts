import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFullSession } from "@/lib/auth";
import { getOrCreateOrden, validarCierreOrden, enviarWhatsApp } from "@/lib/tickets";

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
    include: { cliente: true },
  });

  if (!ticket || ticket.tecnicoId !== session.tecnicoId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const orden = await getOrCreateOrden(id);
  const validacion = validarCierreOrden(orden);

  if (!validacion.valido) {
    return NextResponse.json({ error: "Validación fallida", errores: validacion.errores }, { status: 400 });
  }

  const now = new Date();

  await prisma.ordenServicio.update({
    where: { id: orden.id },
    data: { finalizadoEn: now },
  });

  await prisma.ticket.update({
    where: { id },
    data: { estado: "CERRADO" },
  });

  await prisma.tecnico.update({
    where: { id: session.tecnicoId },
    data: { estadoActual: "DISPONIBLE" },
  });

  await enviarWhatsApp(ticket.codigo, ticket.cliente.telefono);

  await prisma.ordenServicio.update({
    where: { id: orden.id },
    data: { whatsappEnviado: true },
  });

  await prisma.eventoTicket.create({
    data: {
      ticketId: id,
      usuarioId: session.id,
      accion: "TICKET_CERRADO",
    },
  });

  return NextResponse.json({ ok: true, codigo: ticket.codigo });
}
