import type { Cliente } from "@prisma/client";
import { prisma } from "./prisma";
import { mensajeCedulaInvalida, normalizarCedula, validarCedulaEcuatoriana } from "./cedula-ec";
import { esClienteInfraestructura } from "./cliente-infraestructura";
import { enMayusculasGuardar, normalizarClienteNuevo, normalizarTextoCliente } from "./mayusculas";

export const CAMPOS_CLIENTE_LABELS: Record<string, string> = {
  cedula: "Cédula",
  nombre: "Nombre",
  telefono: "Teléfono",
  plan: "Plan",
  direccion: "Dirección",
  sector: "Sector",
  referencia: "Referencia",
  nodo: "Nodo",
  lat: "Latitud",
  lng: "Longitud",
  cajaNap: "Caja NAP",
  puerto: "Puerto",
  onuSerial: "Serial ONU",
  potencia: "Potencia óptica",
  activo: "Estado activo",
};

export type ClienteInput = {
  cedula: string;
  nombre: string;
  telefono: string;
  plan?: string;
  direccion: string;
  sector: string;
  referencia?: string | null;
  nodo?: string | null;
  lat?: number | null;
  lng?: number | null;
  cajaNap?: string | null;
  puerto?: string | null;
  onuSerial?: string | null;
  potencia?: number | null;
  activo?: boolean;
};

export type CambioCliente = {
  campo: string;
  anterior: string | null;
  nuevo: string | null;
};

function fmt(val: unknown): string | null {
  if (val === null || val === undefined) return null;
  if (typeof val === "boolean") return val ? "Activo" : "Inactivo";
  if (typeof val === "number") return String(val);
  const s = String(val).trim();
  return s || null;
}

function normalizarInput(input: ClienteInput) {
  const base = normalizarClienteNuevo({
    nombre: input.nombre,
    direccion: input.direccion,
    sector: input.sector,
    plan: input.plan || "Sin plan",
    nodo: input.nodo ?? null,
    referencia: input.referencia ?? null,
  });

  return {
    cedula: normalizarCedula(input.cedula),
    telefono: input.telefono.trim(),
    ...base,
    lat: input.lat ?? null,
    lng: input.lng ?? null,
    cajaNap: input.cajaNap ? enMayusculasGuardar(input.cajaNap) : null,
    puerto: input.puerto ? enMayusculasGuardar(input.puerto) : null,
    onuSerial: input.onuSerial ? enMayusculasGuardar(input.onuSerial) : null,
    potencia: input.potencia ?? null,
    activo: input.activo !== false,
  };
}

function validarInput(input: ClienteInput) {
  if (!input.cedula || !input.nombre || !input.telefono || !input.direccion || !input.sector) {
    return "Cédula, nombre, teléfono, dirección y sector son obligatorios";
  }
  const cedulaNorm = normalizarCedula(input.cedula);
  if (!validarCedulaEcuatoriana(cedulaNorm)) {
    return mensajeCedulaInvalida();
  }
  if (esClienteInfraestructura(cedulaNorm)) {
    return "La cédula del cliente interno de infraestructura no se puede usar";
  }
  return null;
}

function diffCliente(anterior: Cliente, nuevo: ReturnType<typeof normalizarInput>): CambioCliente[] {
  const campos: (keyof ReturnType<typeof normalizarInput>)[] = [
    "cedula",
    "nombre",
    "telefono",
    "plan",
    "direccion",
    "sector",
    "referencia",
    "nodo",
    "lat",
    "lng",
    "cajaNap",
    "puerto",
    "onuSerial",
    "potencia",
    "activo",
  ];

  const cambios: CambioCliente[] = [];
  for (const campo of campos) {
    const a = fmt(anterior[campo as keyof Cliente]);
    const n = fmt(nuevo[campo]);
    if (a !== n) {
      cambios.push({ campo, anterior: a, nuevo: n });
    }
  }
  return cambios;
}

async function registrarHistorial(
  clienteId: string,
  usuarioId: string | null | undefined,
  accion: "CREADO" | "ACTUALIZADO",
  cambios: CambioCliente[]
) {
  if (cambios.length === 0) return;
  await prisma.historialCliente.create({
    data: {
      clienteId,
      usuarioId: usuarioId ?? null,
      accion,
      cambiosJson: JSON.stringify(cambios),
    },
  });
}

export async function crearCliente(input: ClienteInput, usuarioId?: string) {
  const error = validarInput(input);
  if (error) throw new Error(error);

  const datos = normalizarInput(input);

  const existe = await prisma.cliente.findUnique({ where: { cedula: datos.cedula } });
  if (existe) {
    throw new Error("Ya existe un cliente con esa cédula");
  }

  const cliente = await prisma.cliente.create({ data: datos });

  const cambios = Object.keys(CAMPOS_CLIENTE_LABELS)
    .filter((k) => k in datos)
    .map((campo) => ({
      campo,
      anterior: null,
      nuevo: fmt(datos[campo as keyof typeof datos]),
    }));

  await registrarHistorial(cliente.id, usuarioId, "CREADO", cambios);
  return cliente;
}

export async function actualizarCliente(
  clienteId: string,
  input: Partial<ClienteInput>,
  usuarioId?: string
) {
  const actual = await prisma.cliente.findUnique({ where: { id: clienteId } });
  if (!actual) throw new Error("Cliente no encontrado");
  if (esClienteInfraestructura(actual.cedula)) {
    throw new Error("El cliente interno de infraestructura no se puede modificar");
  }

  const merged: ClienteInput = {
    cedula: input.cedula ?? actual.cedula,
    nombre: input.nombre ?? actual.nombre,
    telefono: input.telefono ?? actual.telefono,
    plan: input.plan ?? actual.plan,
    direccion: input.direccion ?? actual.direccion,
    sector: input.sector ?? actual.sector,
    referencia: input.referencia !== undefined ? input.referencia : actual.referencia,
    nodo: input.nodo !== undefined ? input.nodo : actual.nodo,
    lat: input.lat !== undefined ? input.lat : actual.lat,
    lng: input.lng !== undefined ? input.lng : actual.lng,
    cajaNap: input.cajaNap !== undefined ? input.cajaNap : actual.cajaNap,
    puerto: input.puerto !== undefined ? input.puerto : actual.puerto,
    onuSerial: input.onuSerial !== undefined ? input.onuSerial : actual.onuSerial,
    potencia: input.potencia !== undefined ? input.potencia : actual.potencia,
    activo: input.activo !== undefined ? input.activo : actual.activo,
  };

  const error = validarInput(merged);
  if (error) throw new Error(error);

  const datos = normalizarInput(merged);

  if (datos.cedula !== actual.cedula) {
    const otra = await prisma.cliente.findUnique({ where: { cedula: datos.cedula } });
    if (otra && otra.id !== clienteId) {
      throw new Error("Ya existe otro cliente con esa cédula");
    }
  }

  const cambios = diffCliente(actual, datos);
  if (cambios.length === 0) return actual;

  const cliente = await prisma.cliente.update({
    where: { id: clienteId },
    data: datos,
  });

  await registrarHistorial(clienteId, usuarioId, "ACTUALIZADO", cambios);
  return cliente;
}

/** Actualización puntual de nombre desde ticket (con historial). */
export async function actualizarNombreCliente(
  clienteId: string,
  nombre: string,
  usuarioId?: string
) {
  const actual = await prisma.cliente.findUnique({ where: { id: clienteId } });
  if (!actual) throw new Error("Cliente no encontrado");
  const datos = normalizarTextoCliente({ nombre });
  if (datos.nombre === actual.nombre) return actual;
  return actualizarCliente(clienteId, { nombre: datos.nombre }, usuarioId);
}

export async function obtenerHistorialCliente(clienteId: string, take = 50) {
  return prisma.historialCliente.findMany({
    where: { clienteId },
    orderBy: { createdAt: "desc" },
    take,
    include: { usuario: { select: { nombre: true, email: true } } },
  });
}

export type EliminarClienteResult = {
  ok: true;
  nombre: string;
  cedula: string;
  ticketsEliminados: number;
};

/**
 * Elimina un cliente de forma permanente (solo ADMIN vía API).
 * Bloquea si hay tickets operativos abiertos; elimina tickets cerrados/históricos primero.
 */
export async function eliminarClientePorId(clienteId: string): Promise<EliminarClienteResult> {
  const cliente = await prisma.cliente.findUnique({
    where: { id: clienteId },
    include: {
      tickets: {
        select: {
          id: true,
          codigo: true,
          estado: true,
          orden: { select: { finalizadoEn: true } },
        },
      },
      cuentaApp: { select: { usuarioId: true } },
    },
  });

  if (!cliente) throw new Error("Cliente no encontrado");
  if (esClienteInfraestructura(cliente.cedula)) {
    throw new Error("El cliente interno de infraestructura no se puede eliminar");
  }

  const { ticketEstaCerrado } = await import("./ticket-cerrado");
  const abiertos = cliente.tickets.filter((t) => !ticketEstaCerrado(t, t.orden));
  if (abiertos.length > 0) {
    const codigos = abiertos
      .slice(0, 5)
      .map((t) => t.codigo)
      .join(", ");
    throw new Error(
      `No se puede eliminar: tiene ${abiertos.length} ticket(s) activo(s) (${codigos}${
        abiertos.length > 5 ? "…" : ""
      }). Ciérrelos o elimínelos primero desde Gerencia → Soportes.`
    );
  }

  const ticketIds = cliente.tickets.map((t) => t.id);

  if (ticketIds.length > 0) {
    await prisma.srTicket.updateMany({
      where: { OR: [{ clienteId }, { ticketPresencialId: { in: ticketIds } }] },
      data: { clienteId: null, ticketPresencialId: null },
    });
    await prisma.hdConversacion.updateMany({
      where: {
        OR: [{ clienteId }, { ticketId: { in: ticketIds } }],
      },
      data: { clienteId: null, ticketId: null },
    });
    await prisma.hdEscalamiento.updateMany({
      where: { ticketEscaladoId: { in: ticketIds } },
      data: { ticketEscaladoId: null },
    });

    const { eliminarTicketPorId } = await import("./eliminar-ticket");
    for (const t of cliente.tickets) {
      await eliminarTicketPorId(t.id);
    }
  } else {
    await prisma.srTicket.updateMany({
      where: { clienteId },
      data: { clienteId: null },
    });
    await prisma.hdConversacion.updateMany({
      where: { clienteId },
      data: { clienteId: null },
    });
  }

  const usuarioAppId = cliente.cuentaApp?.usuarioId;
  await prisma.cliente.delete({ where: { id: clienteId } });

  if (usuarioAppId) {
    await prisma.usuario.delete({ where: { id: usuarioAppId } }).catch(() => {
      /* cuenta/usuario ya cascaded o inexistente */
    });
  }

  return {
    ok: true,
    nombre: cliente.nombre,
    cedula: cliente.cedula,
    ticketsEliminados: ticketIds.length,
  };
}
