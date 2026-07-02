import { prisma } from "@/lib/prisma";
import type { Cliente, Ticket } from "@prisma/client";

export type ClienteContexto = {
  cliente: Cliente | null;
  tipoCliente: "EXISTENTE" | "NUEVO" | "PROSPECTO";
  ticketsRecientes: Pick<Ticket, "id" | "codigo" | "estado" | "motivo" | "createdAt" | "tipo">[];
  estadoServicio: "ACTIVO" | "INACTIVO" | "DESCONOCIDO";
  observaciones: string | null;
};

/** Busca cliente por teléfono (últimos dígitos) o cédula. */
export async function buscarClientePorTelefono(telefono: string) {
  const limpio = telefono.replace(/\D/g, "");
  if (limpio.length < 8) return null;

  const clientes = await prisma.cliente.findMany({
    where: {
      OR: [
        { telefono: { contains: limpio.slice(-9) } },
        { cedula: { contains: limpio } },
      ],
    },
    take: 1,
  });
  return clientes[0] ?? null;
}

/** Arma el panel lateral del técnico con datos del CRM. */
export async function contextoClienteHelpDesk(
  clienteId: string | null,
  prospectoTelefono?: string | null
): Promise<ClienteContexto> {
  let cliente: Cliente | null = null;

  if (clienteId) {
    cliente = await prisma.cliente.findUnique({ where: { id: clienteId } });
  } else if (prospectoTelefono) {
    cliente = await buscarClientePorTelefono(prospectoTelefono);
  }

  if (!cliente) {
    return {
      cliente: null,
      tipoCliente: prospectoTelefono ? "PROSPECTO" : "NUEVO",
      ticketsRecientes: [],
      estadoServicio: "DESCONOCIDO",
      observaciones: null,
    };
  }

  const ticketsRecientes = await prisma.ticket.findMany({
    where: { clienteId: cliente.id },
    orderBy: { createdAt: "desc" },
    take: 8,
    select: {
      id: true,
      codigo: true,
      estado: true,
      motivo: true,
      createdAt: true,
      tipo: true,
    },
  });

  return {
    cliente,
    tipoCliente: "EXISTENTE",
    ticketsRecientes,
    estadoServicio: cliente.activo ? "ACTIVO" : "INACTIVO",
    observaciones: cliente.referencia,
  };
}
