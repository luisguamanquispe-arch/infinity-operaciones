import { prisma } from "./prisma";
import { tecnicoIdsFromTicket } from "./ticket-tecnicos";
import type { TipoTrabajo } from "@prisma/client";

export interface EliminarTicketResult {
  ok: true;
  codigo: string;
  materialesRestaurados: number;
}

/** Elimina un ticket y restaura stock de materiales descontados. */
export async function eliminarTicketPorId(
  ticketId: string,
  opts?: { tiposPermitidos?: TipoTrabajo[] }
): Promise<EliminarTicketResult> {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      orden: {
        include: {
          materiales: true,
        },
      },
    },
  });

  if (!ticket) {
    throw new Error("Ticket no encontrado");
  }

  if (opts?.tiposPermitidos?.length) {
    if (!opts.tiposPermitidos.includes(ticket.tipo)) {
      throw new Error(
        `No se puede eliminar un ticket de tipo ${ticket.tipo} desde esta pantalla`
      );
    }
  }

  const materiales = ticket.orden?.materiales ?? [];
  const tecnicoIds = tecnicoIdsFromTicket(ticket);

  await prisma.$transaction(async (tx) => {
    for (const m of materiales) {
      await tx.inventario.update({
        where: { id: m.inventarioId },
        data: { stock: { increment: m.cantidad } },
      });
    }

    if (tecnicoIds.length) {
      await tx.tecnico.updateMany({
        where: {
          id: { in: tecnicoIds },
          estadoActual: "TRABAJANDO",
        },
        data: { estadoActual: "DISPONIBLE" },
      });
    }

    await tx.ticket.delete({ where: { id: ticketId } });
  });

  return {
    ok: true,
    codigo: ticket.codigo,
    materialesRestaurados: materiales.length,
  };
}
