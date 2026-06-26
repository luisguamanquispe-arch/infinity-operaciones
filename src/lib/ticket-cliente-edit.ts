import { prisma } from "./prisma";
import { esClienteInfraestructura } from "./cliente-infraestructura";
import { normalizarTextoCliente } from "./mayusculas";

export function ticketPermiteEditarCliente(tipo: string): boolean {
  return tipo === "SOPORTE";
}

export type CambiosClienteTicket = {
  clienteId?: string;
  clienteNombre?: string;
};

export type ResultadoCambiosCliente =
  | { ok: true; clienteId: string; nombreActualizado: boolean; clienteReasignado: boolean }
  | { ok: false; status: number; error: string };

/** Reasigna cliente y/o actualiza nombre en tickets de soporte. */
export async function aplicarCambiosClienteTicket(
  ticket: { id: string; clienteId: string; tipo: string },
  cambios: CambiosClienteTicket
): Promise<ResultadoCambiosCliente> {
  if (!ticketPermiteEditarCliente(ticket.tipo)) {
    return {
      ok: false,
      status: 400,
      error: "Solo se puede modificar el cliente en tickets de soporte",
    };
  }

  let clienteId = ticket.clienteId;
  let clienteReasignado = false;
  let nombreActualizado = false;

  if (cambios.clienteId !== undefined && cambios.clienteId !== ticket.clienteId) {
    const nuevo = await prisma.cliente.findUnique({ where: { id: cambios.clienteId } });
    if (!nuevo) {
      return { ok: false, status: 404, error: "Cliente no encontrado" };
    }
    if (esClienteInfraestructura(nuevo.cedula)) {
      return {
        ok: false,
        status: 400,
        error: "No se puede asignar el cliente interno de infraestructura",
      };
    }
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { clienteId: cambios.clienteId },
    });
    clienteId = cambios.clienteId;
    clienteReasignado = true;
  }

  if (cambios.clienteNombre !== undefined) {
    const nombre = cambios.clienteNombre.trim();
    if (!nombre) {
      return { ok: false, status: 400, error: "El nombre del cliente no puede estar vacío" };
    }

    const actual = await prisma.cliente.findUnique({
      where: { id: clienteId },
      select: { nombre: true, cedula: true },
    });
    if (!actual) {
      return { ok: false, status: 404, error: "Cliente no encontrado" };
    }
    if (esClienteInfraestructura(actual.cedula)) {
      return {
        ok: false,
        status: 400,
        error: "No se puede modificar el cliente interno de infraestructura",
      };
    }

    const datos = normalizarTextoCliente({ nombre });
    if (datos.nombre !== actual.nombre) {
      await prisma.cliente.update({
        where: { id: clienteId },
        data: datos,
      });
      nombreActualizado = true;
    }
  }

  if (!clienteReasignado && !nombreActualizado) {
    return { ok: true, clienteId, nombreActualizado: false, clienteReasignado: false };
  }

  return { ok: true, clienteId, nombreActualizado, clienteReasignado };
}
