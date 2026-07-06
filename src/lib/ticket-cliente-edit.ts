import { prisma } from "./prisma";
import { esClienteInfraestructura } from "./cliente-infraestructura";
import { normalizarTextoCliente } from "./mayusculas";
import { actualizarNombreCliente } from "./cliente-crud";

/** Editar nombre del cliente (todos los tipos con cliente real). */
export function ticketPermiteEditarNombreCliente(tipo: string): boolean {
  return tipo !== "INFRAESTRUCTURA";
}

/** Reasignar ticket a otro cliente (solo soporte). */
export function ticketPermiteReasignarCliente(tipo: string): boolean {
  return tipo === "SOPORTE";
}

export type CambiosClienteTicket = {
  clienteId?: string;
  clienteNombre?: string;
};

export type ResultadoCambiosCliente =
  | { ok: true; clienteId: string; nombreActualizado: boolean; clienteReasignado: boolean }
  | { ok: false; status: number; error: string };

/** Reasigna cliente y/o actualiza nombre según el tipo de ticket. */
export async function aplicarCambiosClienteTicket(
  ticket: { id: string; clienteId: string; tipo: string },
  cambios: CambiosClienteTicket,
  usuarioId?: string
): Promise<ResultadoCambiosCliente> {
  let clienteId = ticket.clienteId;
  let clienteReasignado = false;
  let nombreActualizado = false;

  if (cambios.clienteId !== undefined && cambios.clienteId !== ticket.clienteId) {
    if (!ticketPermiteReasignarCliente(ticket.tipo)) {
      return {
        ok: false,
        status: 400,
        error: "Solo se puede cambiar de cliente en tickets de soporte",
      };
    }

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
    if (!ticketPermiteEditarNombreCliente(ticket.tipo)) {
      return {
        ok: false,
        status: 400,
        error: "No se puede modificar el cliente en tickets de infraestructura",
      };
    }

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
    if (datos.nombre && datos.nombre !== actual.nombre) {
      await actualizarNombreCliente(clienteId, datos.nombre, usuarioId);
      nombreActualizado = true;
    }
  }

  return { ok: true, clienteId, nombreActualizado, clienteReasignado };
}

export function solicitaCambioClienteEnBody(
  ticket: { tipo: string },
  cambios: CambiosClienteTicket
): boolean {
  if (
    cambios.clienteId !== undefined &&
    ticketPermiteReasignarCliente(ticket.tipo)
  ) {
    return true;
  }
  if (
    cambios.clienteNombre !== undefined &&
    ticketPermiteEditarNombreCliente(ticket.tipo)
  ) {
    return true;
  }
  return false;
}
