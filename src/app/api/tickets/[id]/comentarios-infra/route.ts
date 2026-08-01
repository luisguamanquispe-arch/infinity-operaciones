import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFullSession } from "@/lib/auth";
import { tecnicoAsignadoAlTicket } from "@/lib/ticket-tecnicos";
import { esTicketInfraestructura } from "@/lib/ticket-infraestructura";
import { registrarSiHistorial } from "@/lib/soporte-infraestructura/historial";
import { verificarTicketEditable } from "@/lib/ticket-cerrado";

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

  const comentarios = await prisma.siComentario.findMany({
    where: { ticketId: id },
    orderBy: { createdAt: "desc" },
    include: {
      tecnico: { include: { usuario: { select: { nombre: true } } } },
    },
    take: 100,
  });

  return NextResponse.json({
    comentarios: comentarios.map((c) => ({
      id: c.id,
      texto: c.texto,
      createdAt: c.createdAt,
      tecnicoNombre: c.tecnico.usuario.nombre,
      tecnicoId: c.tecnicoId,
    })),
  });
}

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
    include: {
      cliente: true,
      tecnicos: { select: { tecnicoId: true } },
      tecnico: { include: { usuario: { select: { nombre: true } } } },
    },
  });
  if (!ticket || !esTicketInfraestructura(ticket.tipo)) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }
  if (!tecnicoAsignadoAlTicket(ticket, session.tecnicoId)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const editable = await verificarTicketEditable(id);
  if (!editable.ok) {
    return NextResponse.json({ error: editable.error }, { status: editable.status });
  }

  const body = await request.json();
  const texto = String(body.texto || "").trim();
  if (texto.length < 3) {
    return NextResponse.json({ error: "Comentario demasiado corto" }, { status: 400 });
  }

  const comentario = await prisma.siComentario.create({
    data: {
      ticketId: id,
      tecnicoId: session.tecnicoId,
      texto,
    },
    include: {
      tecnico: { include: { usuario: { select: { nombre: true } } } },
    },
  });

  await registrarSiHistorial(prisma, {
    ticketId: id,
    usuarioId: session.id,
    usuarioNombre: session.nombre,
    accion: "COMENTARIO",
    detalle: texto.slice(0, 200),
  });

  return NextResponse.json(
    {
      comentario: {
        id: comentario.id,
        texto: comentario.texto,
        createdAt: comentario.createdAt,
        tecnicoNombre: comentario.tecnico.usuario.nombre,
        tecnicoId: comentario.tecnicoId,
      },
    },
    { status: 201 }
  );
}
