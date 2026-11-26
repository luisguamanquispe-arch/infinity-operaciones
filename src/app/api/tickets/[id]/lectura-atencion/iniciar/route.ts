import { NextResponse } from "next/server";
import { getFullSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verificarTicketEditable } from "@/lib/ticket-cerrado";
import {
  autorizarInicioLectura,
  iniciarLecturaAtencion,
} from "@/lib/cronometro-atencion/servicio";

/**
 * POST /api/tickets/[id]/lectura-atencion/iniciar
 * Inicia el cronómetro de lectura y atención de un ticket de soporte.
 * Solo el técnico asignado autenticado puede iniciarlo; idempotente ante doble clic / concurrencia.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getFullSession();
  const { id } = await params;

  if (!session?.id || !session.tecnicoId) {
    return NextResponse.json(
      { error: "Solo un técnico autenticado puede iniciar la lectura de atención" },
      { status: 401 }
    );
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: { tecnicos: { select: { tecnicoId: true } } },
  });

  const auth = autorizarInicioLectura(ticket, session);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const editable = await verificarTicketEditable(id);
  if (!editable.ok) {
    return NextResponse.json({ error: editable.error }, { status: editable.status });
  }

  const res = await iniciarLecturaAtencion({
    ticketId: id,
    tecnicoId: auth.tecnicoId,
    usuarioId: session.id,
  });

  return NextResponse.json({
    ok: true,
    creado: res.creado,
    yaIniciado: res.yaIniciado,
    cronometroAtencion: res.cronometro,
  });
}
