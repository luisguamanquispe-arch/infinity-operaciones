import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFullSession } from "@/lib/auth";
import { tecnicoAsignadoAlTicket } from "@/lib/ticket-tecnicos";
import { ordenServicioCerrada } from "@/lib/ticket-cerrado";
import {
  TIPO_NUEVA_INSTALACION,
  validarMaterialesInstalacion,
} from "@/lib/nueva-instalacion";

/**
 * GET /api/tickets/[id]/materiales-instalacion
 * Devuelve los materiales y equipos utilizados en la instalación (sin relación con Kardex/Inventario).
 */
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
    select: {
      id: true,
      tipo: true,
      numeroContratoInstalar: true,
      tecnicoId: true,
      tecnicos: { select: { tecnicoId: true } },
      materialesInstalacion: {
        orderBy: [{ orden: "asc" }, { createdAt: "asc" }],
      },
    },
  });

  if (!ticket) {
    return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });
  }

  const esSupervisor = ["SUPERVISOR", "ADMIN"].includes(session.rol);
  const esTecnicoAsignado =
    session.rol === "TECNICO" &&
    Boolean(session.tecnicoId) &&
    tecnicoAsignadoAlTicket(ticket, session.tecnicoId!);

  if (!esSupervisor && !esTecnicoAsignado) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  return NextResponse.json({
    ok: true,
    numeroContratoInstalar: ticket.numeroContratoInstalar,
    materialesInstalacion: ticket.materialesInstalacion,
  });
}

/**
 * PUT /api/tickets/[id]/materiales-instalacion
 * Guarda/actualiza el listado de materiales y equipos utilizados en una Nueva instalación.
 * NO modifica Inventario ni genera movimientos de Kardex.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getFullSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      tecnicos: { select: { tecnicoId: true } },
      orden: true,
    },
  });

  if (!ticket) {
    return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });
  }

  if (ticket.tipo !== TIPO_NUEVA_INSTALACION) {
    return NextResponse.json(
      { error: "Esta sección aplica únicamente a tickets de tipo Nueva instalación." },
      { status: 400 }
    );
  }

  const esSupervisor = ["SUPERVISOR", "ADMIN"].includes(session.rol);
  const esTecnicoAsignado =
    session.rol === "TECNICO" &&
    Boolean(session.tecnicoId) &&
    tecnicoAsignadoAlTicket(ticket, session.tecnicoId!);

  if (!esSupervisor && !esTecnicoAsignado) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  if (
    !esSupervisor &&
    ticket.orden &&
    ordenServicioCerrada(ticket.orden) &&
    ticket.estadoRevision !== "DEVUELTO_CORRECCION"
  ) {
    return NextResponse.json(
      { error: "La orden ya fue finalizada y no puede modificarse." },
      { status: 409 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    items?: unknown;
  };
  const val = validarMaterialesInstalacion(body.items);
  if (!val.ok) {
    return NextResponse.json({ error: val.error }, { status: 400 });
  }

  const guardados = await prisma.$transaction(async (tx) => {
    await tx.ticketMaterialInstalacion.deleteMany({
      where: { ticketId: id },
    });

    await tx.ticketMaterialInstalacion.createMany({
      data: val.items.map((item, idx) => ({
        ticketId: id,
        categoria: item.categoria,
        item: item.item,
        cantidad: item.cantidad,
        unidad: item.unidad,
        marca: item.marca,
        series: item.series,
        orden: idx,
      })),
    });

    return tx.ticketMaterialInstalacion.findMany({
      where: { ticketId: id },
      orderBy: [{ orden: "asc" }, { createdAt: "asc" }],
    });
  });

  return NextResponse.json({
    ok: true,
    materialesInstalacion: guardados,
  });
}
