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

/** Reemplaza asignaciones del ticket y sincroniza tecnicoId (primer técnico). */
export async function asignarTecnicosTicket(
  ticketId: string,
  tecnicoIds: string[]
): Promise<string[]> {
  const unicos = [...new Set(tecnicoIds.filter(Boolean))];

  await prisma.$transaction([
    prisma.ticketTecnico.deleteMany({ where: { ticketId } }),
    ...(unicos.length
      ? [
          prisma.ticketTecnico.createMany({
            data: unicos.map((tecnicoId) => ({ ticketId, tecnicoId })),
          }),
        ]
      : []),
    prisma.ticket.update({
      where: { id: ticketId },
      data: { tecnicoId: unicos[0] ?? null },
    }),
  ]);

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
    OR: [
      { tecnicoId },
      { tecnicos: { some: { tecnicoId } } },
    ],
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
 * Repara todos los tickets activos (PENDIENTE / EN_PROCESO):
 * - Si tienen tecnicoId pero falta fila en TicketTecnico, la crea.
 * - Si solo hay filas en TicketTecnico, alinea tecnicoId al primero.
 * Así aparecen en la app de cada técnico designado.
 */
export async function sincronizarAsignacionesActivas(): Promise<{
  revisados: number;
  reparados: number;
  sinAsignar: number;
}> {
  const activos = await prisma.ticket.findMany({
    where: { estado: { in: ["PENDIENTE", "EN_PROCESO"] } },
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
