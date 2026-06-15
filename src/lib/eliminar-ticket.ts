import { prisma } from "./prisma";
import { tecnicoIdsFromTicket } from "./ticket-tecnicos";

export interface EliminarTicketResult {
  ok: true;
  codigo: string;
  materialesRestaurados: number;
}

/** Elimina un ticket y restaura stock de materiales descontados. */
export async function eliminarTicketPorId(
  ticketId: string,
  opts?: { soloTipo?: "SOPORTE" }
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

  if (opts?.soloTipo && ticket.tipo !== opts.soloTipo) {
    throw new Error(`Solo se pueden eliminar tickets de tipo ${opts.soloTipo}`);
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
