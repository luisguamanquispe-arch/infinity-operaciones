import { NextResponse } from "next/server";
import { getFullSession } from "@/lib/auth";
import { ESTADO_NOVEDAD_LABELS, listarNovedadesSupervisor, TIPO_NOVEDAD_LABELS } from "@/lib/novedad-ticket";
import type { EstadoNovedadTicket } from "@prisma/client";

export async function GET(request: Request) {
  const session = await getFullSession();
  if (!session || !["SUPERVISOR", "ADMIN"].includes(session.rol)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const estado = (searchParams.get("estado") || "PENDIENTE") as EstadoNovedadTicket;

  const items = await listarNovedadesSupervisor(estado);

  return NextResponse.json({
    items: items.map((n) => ({
      id: n.id,
      tipo: n.tipo,
      tipoLabel: TIPO_NOVEDAD_LABELS[n.tipo],
      estado: n.estado,
      estadoLabel: ESTADO_NOVEDAD_LABELS[n.estado],
      comentario: n.comentario,
      fechaSolicitada: n.fechaSolicitada?.toISOString() ?? null,
      programadoEnAnterior: n.programadoEnAnterior?.toISOString() ?? null,
      programadoEnNuevo: n.programadoEnNuevo?.toISOString() ?? null,
      createdAt: n.createdAt.toISOString(),
      tecnico: n.tecnico.usuario.nombre,
      ticket: {
        id: n.ticket.id,
        codigo: n.ticket.codigo,
        tipo: n.ticket.tipo,
        motivo: n.ticket.motivo,
        programadoEn: n.ticket.programadoEn?.toISOString() ?? null,
        cliente: n.ticket.cliente,
        tecnicoIds: n.ticket.tecnicos.map((t) => t.tecnicoId),
        tecnicos: n.ticket.tecnicos.map((t) => t.tecnico.usuario.nombre),
      },
    })),
  });
}
