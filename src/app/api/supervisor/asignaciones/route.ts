import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFullSession } from "@/lib/auth";
import { ESTADOS_ACTIVOS_TICKET } from "@/lib/ticket-gerencia";
import {
  asignarTecnicosTicket,
  nombresTecnicosTicket,
  notificarTecnicosNuevos,
  sincronizarAsignacionesActivas,
  tecnicoIdsFromTicket,
  ticketIncludeTecnicos,
  validarTecnicoIds,
} from "@/lib/ticket-tecnicos";

export const runtime = "nodejs";

/** Lista tickets activos y permite destinar técnicos (aparecen en su app). */
export async function GET() {
  const session = await getFullSession();
  if (!session || !["SUPERVISOR", "ADMIN"].includes(session.rol)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const sync = await sincronizarAsignacionesActivas();

  const [tickets, tecnicos] = await Promise.all([
    prisma.ticket.findMany({
      where: { estado: { in: [...ESTADOS_ACTIVOS_TICKET] } },
      include: ticketIncludeTecnicos,
      orderBy: [{ prioridad: "asc" }, { programadoEn: "asc" }, { createdAt: "asc" }],
      take: 200,
    }),
    prisma.tecnico.findMany({
      where: { usuario: { activo: true } },
      include: { usuario: { select: { nombre: true, email: true } } },
      orderBy: { usuario: { nombre: "asc" } },
    }),
  ]);

  return NextResponse.json({
    sync,
    tecnicos: tecnicos.map((t) => ({
      id: t.id,
      nombre: t.usuario.nombre,
      email: t.usuario.email,
      estado: t.estadoActual,
    })),
    tickets: tickets.map((t) => {
      const ids = tecnicoIdsFromTicket(t);
      return {
        id: t.id,
        codigo: t.codigo,
        tipo: t.tipo,
        prioridad: t.prioridad,
        estado: t.estado,
        programadoEn: t.programadoEn?.toISOString() ?? null,
        motivo: t.motivo,
        cliente: {
          id: t.cliente.id,
          nombre: t.cliente.nombre,
          sector: t.cliente.sector,
          direccion: t.cliente.direccion,
        },
        tecnicoIds: ids,
        tecnicosLabel: nombresTecnicosTicket(t),
        sinAsignar: ids.length === 0,
      };
    }),
  });
}

/** Destina un ticket activo a uno o más técnicos designados. */
export async function PATCH(request: Request) {
  const session = await getFullSession();
  if (!session || !["SUPERVISOR", "ADMIN"].includes(session.rol)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json();
  const ticketId = String(body.ticketId || "").trim();
  const tecnicoIds: string[] = Array.isArray(body.tecnicoIds)
    ? body.tecnicoIds.map(String)
    : body.tecnicoId
      ? [String(body.tecnicoId)]
      : [];

  if (!ticketId) {
    return NextResponse.json({ error: "Falta ticketId" }, { status: 400 });
  }
  if (tecnicoIds.length === 0) {
    return NextResponse.json(
      { error: "Seleccione al menos un técnico para destinar el ticket" },
      { status: 400 }
    );
  }

  const err = await validarTecnicoIds(tecnicoIds);
  if (err) {
    return NextResponse.json({ error: err }, { status: 404 });
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: ticketIncludeTecnicos,
  });
  if (!ticket) {
    return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });
  }
  if (!(ESTADOS_ACTIVOS_TICKET as readonly string[]).includes(ticket.estado)) {
    return NextResponse.json(
      { error: "Solo se pueden destinar tickets activos (pendiente o en proceso)" },
      { status: 400 }
    );
  }

  const anteriores = tecnicoIdsFromTicket(ticket);
  const nuevos = await asignarTecnicosTicket(ticketId, tecnicoIds);

  const actualizado = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: ticketIncludeTecnicos,
  });
  if (actualizado) {
    await notificarTecnicosNuevos(actualizado, anteriores, nuevos);
  }

  await prisma.eventoTicket.create({
    data: {
      ticketId,
      usuarioId: session.id,
      accion: "TECNICOS_ASIGNADOS",
      metadata: JSON.stringify({ tecnicoIds: nuevos, anteriores }),
    },
  });

  return NextResponse.json({
    ok: true,
    ticketId,
    tecnicoIds: nuevos,
    tecnicosLabel: actualizado ? nombresTecnicosTicket(actualizado) : "",
    mensaje: `Ticket destinado a ${nuevos.length} técnico(s). Ya aparece en su app de trabajo.`,
  });
}
