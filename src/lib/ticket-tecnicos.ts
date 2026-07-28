import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { notificarTecnicoAsignacion } from "@/lib/notificaciones-tecnico";

export const ticketIncludeTecnicos = {
  tecnicos: {
    include: {
      tecnico: { include: { usuario: { select: { nombre: true } } } },
    },
    orderBy: { asignadoEn: "asc" as const },
  },
  tecnico: { include: { usuario: { select: { nombre: true } } } },
  cliente: true,
} as const;

export type TicketConTecnicos = Prisma.TicketGetPayload<{ include: typeof ticketIncludeTecnicos }>;

export function tecnicoIdsFromTicket(ticket: {
  tecnicoId: string | null;
  tecnicos?: { tecnicoId: string }[];
}): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  const add = (id: string | null | undefined) => {
    if (!id || seen.has(id)) return;
    seen.add(id);
    ids.push(id);
  };
  add(ticket.tecnicoId);
  for (const row of ticket.tecnicos ?? []) add(row.tecnicoId);
  return ids;
}

export function tecnicoAsignadoAlTicket(
  ticket: { tecnicoId: string | null; tecnicos?: { tecnicoId: string }[] },
  tecnicoId: string | undefined | null
): boolean {
  if (!tecnicoId) return false;
  return tecnicoIdsFromTicket(ticket).includes(tecnicoId);
}

export function nombresTecnicosTicket(ticket: {
  tecnicoId: string | null;
  tecnico?: { usuario: { nombre: string } } | null;
  tecnicos?: { tecnico: { usuario: { nombre: string } } }[];
}): string {
  if (ticket.tecnicos?.length) {
    return ticket.tecnicos.map((t) => t.tecnico.usuario.nombre).join(", ");
  }
  return ticket.tecnico?.usuario.nombre ?? "Sin asignar";
}

export async function validarTecnicoIds(ids: string[]): Promise<string | null> {
  const unicos = [...new Set(ids.filter(Boolean))];
  if (unicos.length === 0) return null;

  const count = await prisma.tecnico.count({ where: { id: { in: unicos } } });
  if (count !== unicos.length) {
    return "Uno o más técnicos no existen";
  }
  return null;
}

/** Reemplaza asignaciones del ticket y sincroniza tecnicoId (primer técnico).
 * F3/E6: diff (add/remove) en lugar de deleteMany de todas las filas — evita carreras
 * y conserva asignadoEn de técnicos que no cambian.
 */
export async function asignarTecnicosTicket(
  ticketId: string,
  tecnicoIds: string[]
): Promise<string[]> {
  const unicos = [...new Set(tecnicoIds.filter(Boolean))];

  await prisma.$transaction(async (tx) => {
    const actuales = await tx.ticketTecnico.findMany({
      where: { ticketId },
      select: { tecnicoId: true },
    });
    const actualSet = new Set(actuales.map((a) => a.tecnicoId));
    const nuevoSet = new Set(unicos);

    const toRemove = actuales
      .map((a) => a.tecnicoId)
      .filter((id) => !nuevoSet.has(id));
    const toAdd = unicos.filter((id) => !actualSet.has(id));

    if (toRemove.length > 0) {
      await tx.ticketTecnico.deleteMany({
        where: { ticketId, tecnicoId: { in: toRemove } },
      });
    }
    if (toAdd.length > 0) {
      await tx.ticketTecnico.createMany({
        data: toAdd.map((tecnicoId) => ({ ticketId, tecnicoId })),
      });
    }

    await tx.ticket.update({
      where: { id: ticketId },
      data: { tecnicoId: unicos[0] ?? null },
    });
  });

  return unicos;
}

/** Notifica solo a técnicos recién agregados. */
export async function notificarTecnicosNuevos(
  ticket: TicketConTecnicos,
  idsAnteriores: string[],
  idsNuevos: string[]
) {
  const agregados = idsNuevos.filter((id) => !idsAnteriores.includes(id));
  if (agregados.length === 0) return;

  const tecnicos = await prisma.tecnico.findMany({
    where: { id: { in: agregados } },
    include: { usuario: true },
  });

  for (const tecnico of tecnicos) {
    await notificarTecnicoAsignacion({
      ...ticket,
      tecnico: { telefono: tecnico.telefono, usuario: tecnico.usuario },
    });
  }
}

export function whereTecnicoAsignado(tecnicoId: string): Prisma.TicketWhereInput {
  return {
    OR: [{ tecnicoId }, { tecnicos: { some: { tecnicoId } } }],
  };
}

function normalizarNombreTecnico(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

/**
 * Fuerza que cada ticket activo tenga filas TicketTecnico coherentes
 * y reasigna por nombre si algún id quedó huérfano (perfil recreado).
 * Devuelve qué códigos verá cada técnico en "Mis órdenes".
 */
export async function publicarOrdenesActivasATecnicos(): Promise<{
  sync: { revisados: number; reparados: number; sinAsignar: number };
  republicados: number;
  rematchNombre: number;
  porTecnico: {
    tecnicoId: string;
    nombre: string;
    email: string;
    codigos: string[];
  }[];
  tickets: {
    codigo: string;
    cliente: string;
    estado: string;
    tecnicoIds: string[];
    tecnicosLabel: string;
  }[];
}> {
  const sync = await sincronizarAsignacionesActivas();

  const tecnicos = await prisma.tecnico.findMany({
    where: { usuario: { activo: true, rol: "TECNICO" } },
    include: { usuario: { select: { nombre: true, email: true } } },
    orderBy: { usuario: { nombre: "asc" } },
  });

  const idsValidos = new Set(tecnicos.map((t) => t.id));
  const porNombre = new Map<string, string>();
  for (const t of tecnicos) {
    porNombre.set(normalizarNombreTecnico(t.usuario.nombre), t.id);
  }

  const activos = await prisma.ticket.findMany({
    where: { estado: { in: ["PENDIENTE", "LEIDO", "EN_PROCESO"] } },
    include: {
      cliente: { select: { nombre: true } },
      tecnicos: {
        include: {
          tecnico: { include: { usuario: { select: { nombre: true } } } },
        },
        orderBy: { asignadoEn: "asc" as const },
      },
      tecnico: { include: { usuario: { select: { nombre: true } } } },
    },
    orderBy: [{ prioridad: "asc" }, { createdAt: "asc" }],
  });

  let republicados = 0;
  let rematchNombre = 0;

  for (const ticket of activos) {
    const idsActuales = tecnicoIdsFromTicket(ticket).filter((id) => idsValidos.has(id));
    const label = nombresTecnicosTicket(ticket);
    const desdeNombre =
      label && label !== "Sin asignar"
        ? label
            .split(",")
            .map((n) => porNombre.get(normalizarNombreTecnico(n)))
            .filter((id): id is string => !!id)
        : [];

    const ids = [...new Set([...idsActuales, ...desdeNombre])];
    if (desdeNombre.some((id) => !idsActuales.includes(id))) {
      rematchNombre++;
    }
    if (ids.length === 0) continue;

    await asignarTecnicosTicket(ticket.id, ids);
    republicados++;
  }

  const actualizados = await prisma.ticket.findMany({
    where: { estado: { in: ["PENDIENTE", "LEIDO", "EN_PROCESO"] } },
    include: {
      cliente: { select: { nombre: true } },
      tecnicos: {
        include: {
          tecnico: { include: { usuario: { select: { nombre: true } } } },
        },
        orderBy: { asignadoEn: "asc" as const },
      },
      tecnico: { include: { usuario: { select: { nombre: true } } } },
    },
    orderBy: [{ prioridad: "asc" }, { createdAt: "asc" }],
  });

  const porTecnico = tecnicos.map((t) => {
    const codigos = actualizados
      .filter((ticket) => tecnicoAsignadoAlTicket(ticket, t.id))
      .map((ticket) => ticket.codigo);
    return {
      tecnicoId: t.id,
      nombre: t.usuario.nombre,
      email: t.usuario.email,
      codigos,
    };
  });

  return {
    sync,
    republicados,
    rematchNombre,
    porTecnico,
    tickets: actualizados.map((t) => ({
      codigo: t.codigo,
      cliente: t.cliente.nombre,
      estado: t.estado,
      tecnicoIds: tecnicoIdsFromTicket(t),
      tecnicosLabel: nombresTecnicosTicket(t),
    })),
  };
}

/** Alinea Ticket.tecnicoId y filas TicketTecnico (repara datos inconsistentes). */
export async function sincronizarAsignacionesTicket(ticketId: string): Promise<string[]> {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: {
      tecnicoId: true,
      tecnicos: { select: { tecnicoId: true }, orderBy: { asignadoEn: "asc" } },
    },
  });
  if (!ticket) return [];

  const ids = tecnicoIdsFromTicket(ticket);
  if (ids.length === 0) return [];

  const actuales = new Set(ticket.tecnicos.map((t) => t.tecnicoId));
  const desincronizado =
    ids.length !== actuales.size || ids.some((id) => !actuales.has(id));

  if (desincronizado || ticket.tecnicoId !== ids[0]) {
    return asignarTecnicosTicket(ticketId, ids);
  }
  return ids;
}

/**
 * Repara tickets activos (PENDIENTE / LEIDO / EN_PROCESO) de forma aditiva:
 * - Si tienen tecnicoId pero falta fila en TicketTecnico, la crea.
 * - Si solo hay filas en TicketTecnico, alinea tecnicoId al primero.
 * F3/E6: no debe llamarse en GET de lectura del técnico (solo Ops/publicar).
 */
export async function sincronizarAsignacionesActivas(): Promise<{
  revisados: number;
  reparados: number;
  sinAsignar: number;
}> {
  const activos = await prisma.ticket.findMany({
    where: { estado: { in: ["PENDIENTE", "LEIDO", "EN_PROCESO"] } },
    select: {
      id: true,
      tecnicoId: true,
      tecnicos: { select: { tecnicoId: true }, orderBy: { asignadoEn: "asc" } },
    },
  });

  let reparados = 0;
  let sinAsignar = 0;

  for (const t of activos) {
    const ids = tecnicoIdsFromTicket(t);
    if (ids.length === 0) {
      sinAsignar++;
      continue;
    }
    const actuales = new Set(t.tecnicos.map((x) => x.tecnicoId));
    const desincronizado =
      ids.length !== actuales.size ||
      ids.some((id) => !actuales.has(id)) ||
      t.tecnicoId !== ids[0];
    if (desincronizado) {
      await asignarTecnicosTicket(t.id, ids);
      reparados++;
    }
  }

  return { revisados: activos.length, reparados, sinAsignar };
}
