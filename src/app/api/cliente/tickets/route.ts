import { NextResponse } from "next/server";
import { requireClienteSession } from "@/lib/cliente-app/auth";
import {
  CATEGORIAS_SOPORTE_CLIENTE,
  crearTicketCliente,
  listarTicketsCliente,
  type CategoriaSoporteCliente,
} from "@/lib/cliente-app/tickets";
import { ESTADO_LABELS } from "@/lib/utils";

export async function GET(request: Request) {
  try {
    const session = await requireClienteSession(request);
    const tickets = await listarTicketsCliente(session.clienteId);
    return NextResponse.json({
      categorias: CATEGORIAS_SOPORTE_CLIENTE,
      tickets: tickets.map((t) => ({
        id: t.id,
        codigo: t.codigo,
        tipo: t.tipo,
        estado: t.estado,
        estadoLabel: ESTADO_LABELS[t.estado] ?? t.estado,
        prioridad: t.prioridad,
        motivo: t.motivo,
        descripcion: t.descripcion,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
        programadoEn: t.programadoEn?.toISOString() ?? null,
      })),
    });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    console.error("[cliente/tickets GET]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireClienteSession(request);
    const body = await request.json();
    const categoria = body.categoria as CategoriaSoporteCliente;
    const descripcion = typeof body.descripcion === "string" ? body.descripcion : "";
    const lat = typeof body.lat === "number" ? body.lat : null;
    const lng = typeof body.lng === "number" ? body.lng : null;

    const ticket = await crearTicketCliente({
      session,
      categoria,
      descripcion,
      lat,
      lng,
    });

    return NextResponse.json(
      {
        ok: true,
        ticket: {
          id: ticket.id,
          codigo: ticket.codigo,
          estado: ticket.estado,
          motivo: ticket.motivo,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    const msg = err instanceof Error ? err.message : "Error al crear ticket";
    console.error("[cliente/tickets POST]", err);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
