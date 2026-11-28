import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFullSession } from "@/lib/auth";
import { tecnicoAsignadoAlTicket } from "@/lib/ticket-tecnicos";
import { ticketPermiteEdicion } from "@/lib/ticket-cerrado";
import {
  TIPO_NUEVA_INSTALACION,
  validarMaterialesInstalacion,
} from "@/lib/nueva-instalacion";

class MaterialesInstalacionError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

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

  if (!esSupervisor && !ticketPermiteEdicion(ticket, ticket.orden)) {
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

  try {
    const guardados = await prisma.$transaction(async (tx) => {
      const ticketTx = await tx.ticket.findUnique({
        where: { id },
        select: {
          tipo: true,
          estado: true,
          estadoRevision: true,
          orden: { select: { finalizadoEn: true } },
        },
      });

      if (!ticketTx) {
        throw new MaterialesInstalacionError("Ticket no encontrado", 404);
      }

      if (ticketTx.tipo !== TIPO_NUEVA_INSTALACION) {
        throw new MaterialesInstalacionError(
          "Esta sección aplica únicamente a tickets de tipo Nueva instalación.",
          400
        );
      }

      if (!esSupervisor && !ticketPermiteEdicion(ticketTx, ticketTx.orden)) {
        throw new MaterialesInstalacionError(
          "La orden ya fue finalizada y no puede modificarse.",
          409
        );
      }

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
  } catch (err) {
    if (err instanceof MaterialesInstalacionError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error(
      "[materiales-instalacion][PUT]",
      err instanceof Error ? err.message : "Error de base de datos"
    );
    return NextResponse.json(
      { error: "No se pudieron guardar los materiales." },
      { status: 500 }
    );
  }
}
