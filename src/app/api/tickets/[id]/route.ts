import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFullSession } from "@/lib/auth";
import { getOrCreateOrden, calcularDuracionCronometro, slaHorasPorPrioridad } from "@/lib/tickets";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getFullSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      cliente: true,
      tecnico: { include: { usuario: true } },
      orden: {
        include: {
          cronometro: true,
          medicion: true,
          fotografias: true,
          firma: true,
          materiales: { include: { inventario: true } },
        },
      },
    },
  });

  if (!ticket) return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });

  if (session.rol === "TECNICO" && ticket.tecnicoId !== session.tecnicoId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const orden = ticket.orden || (await getOrCreateOrden(ticket.id));

  const duracionSegundos = orden.cronometro
    ? calcularDuracionCronometro(
        orden.cronometro.inicio,
        orden.cronometro.fin,
        orden.cronometro.pausasJson
      )
    : 0;

  const inventario = await prisma.inventario.findMany({ orderBy: { nombre: "asc" } });

  return NextResponse.json({ ticket, orden, duracionSegundos, inventario });
}

const TIPOS_VALIDOS = ["INSTALACION", "SOPORTE", "MIGRACION", "RECONEXION", "RETIRO", "CORTE"];
const PRIORIDADES_VALIDAS = ["ALTA", "MEDIA", "BAJA"];
const ESTADOS_VALIDOS = ["PENDIENTE", "EN_PROCESO", "FINALIZADO", "CERRADO", "CANCELADO"];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getFullSession();
  if (!session || !["SUPERVISOR", "ADMIN"].includes(session.rol)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();

  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket) {
    return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {};

  if (body.tipo && TIPOS_VALIDOS.includes(body.tipo)) updateData.tipo = body.tipo;
  if (body.prioridad && PRIORIDADES_VALIDAS.includes(body.prioridad)) {
    updateData.prioridad = body.prioridad;
    const slaHoras = slaHorasPorPrioridad(body.prioridad);
    updateData.slaHoras = slaHoras;
    updateData.slaVenceEn = new Date(ticket.createdAt.getTime() + slaHoras * 60 * 60 * 1000);
  }
  if (body.estado && ESTADOS_VALIDOS.includes(body.estado)) updateData.estado = body.estado;
  if (body.motivo !== undefined) updateData.motivo = body.motivo || null;
  if (body.descripcion !== undefined) updateData.descripcion = body.descripcion || null;
  if (body.tecnicoId !== undefined) {
    updateData.tecnicoId = body.tecnicoId || null;
    if (body.tecnicoId) {
      const tecnico = await prisma.tecnico.findUnique({ where: { id: body.tecnicoId } });
      if (!tecnico) {
        return NextResponse.json({ error: "Técnico no encontrado" }, { status: 404 });
      }
    }
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "Sin cambios" }, { status: 400 });
  }

  const updated = await prisma.ticket.update({
    where: { id },
    data: updateData,
    include: {
      cliente: true,
      tecnico: { include: { usuario: true } },
    },
  });

  await prisma.eventoTicket.create({
    data: {
      ticketId: id,
      usuarioId: session.id,
      accion: "TICKET_MODIFICADO",
      metadata: JSON.stringify(updateData),
    },
  });

  return NextResponse.json({ ticket: updated });
}
