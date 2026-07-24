import { NextResponse } from "next/server";
import { requireClienteSession } from "@/lib/cliente-app/auth";
import { obtenerTicketCliente } from "@/lib/cliente-app/tickets";
import { ESTADO_LABELS } from "@/lib/utils";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireClienteSession(request);
    const { id } = await params;
    const ticket = await obtenerTicketCliente(session.clienteId, id);
    if (!ticket) {
      return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });
    }

    return NextResponse.json({
      ticket: {
        id: ticket.id,
        codigo: ticket.codigo,
        tipo: ticket.tipo,
        estado: ticket.estado,
        estadoLabel: ESTADO_LABELS[ticket.estado] ?? ticket.estado,
        prioridad: ticket.prioridad,
        motivo: ticket.motivo,
        descripcion: ticket.descripcion,
        createdAt: ticket.createdAt.toISOString(),
        updatedAt: ticket.updatedAt.toISOString(),
        programadoEn: ticket.programadoEn?.toISOString() ?? null,
        eventos: ticket.eventos.map((e) => ({
          accion: e.accion,
          createdAt: e.createdAt.toISOString(),
          metadata: e.metadata,
        })),
      },
    });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    console.error("[cliente/tickets/:id]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
