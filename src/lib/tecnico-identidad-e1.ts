import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";

export type RemapPlanItem = {
  oldTecnicoId: string;
  newTecnicoId: string;
  usuarioId: string;
  email: string;
  fuente: "evento_ticket" | "manual";
  ticketTecnicos: number;
  ticketsPrimary: number;
  ordenesReportadas: number;
  ubicacionesGps: number;
  novedades: number;
};

export type AsegurarIdentidadResult =
  | {
      ok: true;
      tecnicoId: string;
      created: boolean;
      remapped: RemapPlanItem[];
      dryRunRemaps?: RemapPlanItem[];
    }
  | {
      ok: false;
      error: "CONFLICT_MULTI_TECNICO" | "NOT_TECNICO_ROLE";
      detalle: string;
      tecnicoIds?: string[];
    };

export type AuditoriaE1 = {
  generadoEn: string;
  conteos: Record<string, number>;
  usuariosTecnicoSinPerfil: { id: string; email: string; nombre: string }[];
  tecnicosSinUsuario: { id: string; usuarioId: string }[];
  ticketsPrimaryHuerfanos: { id: string; codigo: string; tecnicoId: string }[];
  ticketTecnicoHuerfanos: { ticketId: string; tecnicoId: string }[];
  multiTecnicoPorUsuario: { usuarioId: string; n: number; tecnicoIds: string[] }[];
  homonimosPorNombre: {
    nombreNorm: string;
    n: number;
    emails: string[];
    tecnicoIds: string[];
  }[];
  mismatchSesionVsAsignacion: {
    email: string;
    usuarioId: string;
    tecnicoIdSesion: string;
    ticketsActivosEnSesion: number;
    ticketsActivosMismoNombreOtrasIds: {
      codigo: string;
      tecnicoIds: string[];
    }[];
  }[];
  planRemap: RemapPlanItem[];
};

function parseMetadataIds(metadata: string | null | undefined): string[] {
  if (!metadata) return [];
  try {
    const raw = JSON.parse(metadata) as Record<string, unknown>;
    const out: string[] = [];
    const push = (v: unknown) => {
      if (typeof v === "string" && v.trim()) out.push(v.trim());
      if (Array.isArray(v)) {
        for (const x of v) {
          if (typeof x === "string" && x.trim()) out.push(x.trim());
        }
      }
    };
    push(raw.tecnicoId);
    push(raw.tecnicoIds);
    push(raw.anteriores);
    push(raw.nuevos);
    return [...new Set(out)];
  } catch {
    return [];
  }
}

/** Cuenta filas que se moverían en un remap old→new (sin escribir). */
export async function medirRemap(
  db: PrismaClient,
  oldTecnicoId: string,
  newTecnicoId: string
): Promise<Omit<RemapPlanItem, "usuarioId" | "email" | "fuente" | "oldTecnicoId" | "newTecnicoId">> {
  const [ticketTecnicos, ticketsPrimary, ordenesReportadas, ubicacionesGps, novedades] =
    await Promise.all([
      db.ticketTecnico.count({ where: { tecnicoId: oldTecnicoId } }),
      db.ticket.count({ where: { tecnicoId: oldTecnicoId } }),
      db.ordenServicio.count({ where: { reportadoPorTecnicoId: oldTecnicoId } }),
      db.ubicacionGps.count({ where: { tecnicoId: oldTecnicoId } }),
      db.novedadTicket.count({ where: { tecnicoId: oldTecnicoId } }),
    ]);

  // Si ya existe (ticketId, newId), las filas TT de old se eliminarían tras merge
  void newTecnicoId;
  return { ticketTecnicos, ticketsPrimary, ordenesReportadas, ubicacionesGps, novedades };
}

/**
 * Extrae candidatos oldTecnicoId desde EventoTicket del mismo usuario,
 * excluyendo el id canónico actual.
 */
export async function encontrarCandidatosRemapDesdeEventos(
  db: PrismaClient,
  usuarioId: string,
  canonicalTecnicoId: string
): Promise<string[]> {
  const eventos = await db.eventoTicket.findMany({
    where: { usuarioId, metadata: { not: null } },
    select: { metadata: true },
    take: 2000,
    orderBy: { createdAt: "desc" },
  });

  const ids = new Set<string>();
  for (const e of eventos) {
    for (const id of parseMetadataIds(e.metadata)) {
      if (id !== canonicalTecnicoId) ids.add(id);
    }
  }
  return [...ids];
}

/**
 * Garantiza 1 Tecnico por Usuario TECNICO.
 * Si crea perfil nuevo, propone/aplica remaps solo con evidencia en EventoTicket.
 */
export async function asegurarIdentidadTecnico(
  usuarioId: string,
  opts: { dryRunRemap?: boolean; aplicarRemap?: boolean; db?: PrismaClient } = {}
): Promise<AsegurarIdentidadResult> {
  const db = opts.db ?? defaultPrisma;
  const dryRunRemap = opts.dryRunRemap ?? true;
  const aplicarRemap = opts.aplicarRemap ?? false;

  const usuario = await db.usuario.findUnique({
    where: { id: usuarioId },
    select: {
      id: true,
      email: true,
      rol: true,
      tecnico: { select: { id: true } },
    },
  });

  if (!usuario || usuario.rol !== "TECNICO") {
    return {
      ok: false,
      error: "NOT_TECNICO_ROLE",
      detalle: "El usuario no existe o no es TECNICO",
    };
  }

  // Defensa ante datos corruptos pese a @unique
  const todos = await db.tecnico.findMany({
    where: { usuarioId },
    select: { id: true },
  });
  if (todos.length > 1) {
    return {
      ok: false,
      error: "CONFLICT_MULTI_TECNICO",
      detalle: `Usuario ${usuario.email} tiene ${todos.length} perfiles Tecnico`,
      tecnicoIds: todos.map((t) => t.id),
    };
  }

  let tecnicoId = usuario.tecnico?.id ?? todos[0]?.id;
  let created = false;

  if (!tecnicoId) {
    const tecnico = await db.tecnico.create({
      data: {
        usuarioId,
        estadoActual: "DISPONIBLE",
      },
      select: { id: true },
    });
    tecnicoId = tecnico.id;
    created = true;
    console.warn(
      `[E1] Perfil Tecnico creado para ${usuario.email} id=${tecnicoId}. Remaps no se aplican en login; usar setup/reconciliar-e1.`
    );
  }

  const oldIds = await encontrarCandidatosRemapDesdeEventos(db, usuarioId, tecnicoId);
  const plan: RemapPlanItem[] = [];

  for (const oldId of oldIds) {
    const old = await db.tecnico.findUnique({
      where: { id: oldId },
      select: { id: true, usuarioId: true },
    });
    // No robar asignaciones de otro usuario activo con perfil distinto
    if (old && old.usuarioId !== usuarioId) {
      continue;
    }
    const medidas = await medirRemap(db, oldId, tecnicoId);
    const total =
      medidas.ticketTecnicos +
      medidas.ticketsPrimary +
      medidas.ordenesReportadas +
      medidas.ubicacionesGps +
      medidas.novedades;
    if (total === 0) continue;
    plan.push({
      oldTecnicoId: oldId,
      newTecnicoId: tecnicoId,
      usuarioId,
      email: usuario.email,
      fuente: "evento_ticket",
      ...medidas,
    });
  }

  const remapped: RemapPlanItem[] = [];
  // Login NUNCA aplica remap automáticamente (dryRunRemap=true por defecto).
  // Solo setup APPLY con confirmación explícita.
  if (aplicarRemap && !dryRunRemap && plan.length) {
    for (const item of plan) {
      await remapTecnicoId(item.oldTecnicoId, item.newTecnicoId, {
        db,
        dryRun: false,
      });
      remapped.push(item);
    }
  } else if (plan.length) {
    console.warn(
      `[E1] Remaps pendientes (dry-run) para ${usuario.email}:`,
      plan.map((p) => `${p.oldTecnicoId}→${p.newTecnicoId}`)
    );
  }

  return {
    ok: true,
    tecnicoId,
    created,
    remapped,
    dryRunRemaps: remapped.length === 0 && plan.length ? plan : undefined,
  };
}

/**
 * Mueve FKs de oldTecnicoId → newTecnicoId.
 * dryRun=true: no escribe.
 */
export async function remapTecnicoId(
  oldTecnicoId: string,
  newTecnicoId: string,
  opts: { dryRun?: boolean; db?: PrismaClient } = {}
): Promise<{ dryRun: boolean; plan: Awaited<ReturnType<typeof medirRemap>>; applied: boolean }> {
  const db = opts.db ?? defaultPrisma;
  const dryRun = opts.dryRun ?? true;
  const plan = await medirRemap(db, oldTecnicoId, newTecnicoId);

  if (dryRun || oldTecnicoId === newTecnicoId) {
    return { dryRun: true, plan, applied: false };
  }

  await db.$transaction(async (tx) => {
    const ttOld = await tx.ticketTecnico.findMany({
      where: { tecnicoId: oldTecnicoId },
      select: { ticketId: true },
    });

    for (const row of ttOld) {
      const already = await tx.ticketTecnico.findUnique({
        where: {
          ticketId_tecnicoId: { ticketId: row.ticketId, tecnicoId: newTecnicoId },
        },
      });
      if (already) {
        await tx.ticketTecnico.delete({
          where: {
            ticketId_tecnicoId: { ticketId: row.ticketId, tecnicoId: oldTecnicoId },
          },
        });
      } else {
        await tx.ticketTecnico.update({
          where: {
            ticketId_tecnicoId: { ticketId: row.ticketId, tecnicoId: oldTecnicoId },
          },
          data: { tecnicoId: newTecnicoId },
        });
      }
    }

    await tx.ticket.updateMany({
      where: { tecnicoId: oldTecnicoId },
      data: { tecnicoId: newTecnicoId },
    });

    await tx.ordenServicio.updateMany({
      where: { reportadoPorTecnicoId: oldTecnicoId },
      data: { reportadoPorTecnicoId: newTecnicoId },
    });

    await tx.ubicacionGps.updateMany({
      where: { tecnicoId: oldTecnicoId },
      data: { tecnicoId: newTecnicoId },
    });

    await tx.novedadTicket.updateMany({
      where: { tecnicoId: oldTecnicoId },
      data: { tecnicoId: newTecnicoId },
    });

    // Si el Tecnico viejo quedó sin usuario propio (o es el mismo y ya no se usa),
    // no lo borramos aquí: queda para rollback / auditoría.
  });

  console.info(`[E1] Remap aplicado ${oldTecnicoId} → ${newTecnicoId}`, plan);
  return { dryRun: false, plan, applied: true };
}

/** Auditoría solo-lectura + plan de remap propuesto (sin APPLY). */
export async function auditarIntegridadE1(
  db: PrismaClient = defaultPrisma
): Promise<AuditoriaE1> {
  const [
    usuarioN,
    tecnicoN,
    ticketN,
    ticketTecnicoN,
    ordenN,
    cronometroN,
    eventoN,
  ] = await Promise.all([
    db.usuario.count(),
    db.tecnico.count(),
    db.ticket.count(),
    db.ticketTecnico.count(),
    db.ordenServicio.count(),
    db.cronometro.count(),
    db.eventoTicket.count(),
  ]);

  const usuariosTecnicoSinPerfil = await db.usuario.findMany({
    where: { rol: "TECNICO", tecnico: null },
    select: { id: true, email: true, nombre: true },
    orderBy: { email: "asc" },
  });

  // Con FK no debería haber; se intenta por si integridad rota
  const tecnicos = await db.tecnico.findMany({
    select: {
      id: true,
      usuarioId: true,
      usuario: { select: { id: true, email: true, nombre: true } },
    },
  });
  const tecnicosSinUsuario = tecnicos
    .filter((t) => !t.usuario)
    .map((t) => ({ id: t.id, usuarioId: t.usuarioId }));

  const tecnicoIdSet = new Set(tecnicos.map((t) => t.id));

  const ticketsConPrimary = await db.ticket.findMany({
    where: { tecnicoId: { not: null } },
    select: { id: true, codigo: true, tecnicoId: true },
  });
  const ticketsPrimaryHuerfanos = ticketsConPrimary
    .filter((t) => t.tecnicoId && !tecnicoIdSet.has(t.tecnicoId))
    .map((t) => ({
      id: t.id,
      codigo: t.codigo,
      tecnicoId: t.tecnicoId as string,
    }));

  const allTt = await db.ticketTecnico.findMany({
    select: { ticketId: true, tecnicoId: true },
  });
  const ticketTecnicoHuerfanos = allTt.filter((tt) => !tecnicoIdSet.has(tt.tecnicoId));

  const byUsuario = new Map<string, string[]>();
  for (const t of tecnicos) {
    const arr = byUsuario.get(t.usuarioId) ?? [];
    arr.push(t.id);
    byUsuario.set(t.usuarioId, arr);
  }
  const multiTecnicoPorUsuario = [...byUsuario.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([usuarioId, tecnicoIds]) => ({
      usuarioId,
      n: tecnicoIds.length,
      tecnicoIds,
    }));

  const byNombre = new Map<
    string,
    { emails: string[]; tecnicoIds: string[] }
  >();
  for (const t of tecnicos) {
    if (!t.usuario) continue;
    const key = t.usuario.nombre.trim().toUpperCase();
    const cur = byNombre.get(key) ?? { emails: [], tecnicoIds: [] };
    cur.emails.push(t.usuario.email);
    cur.tecnicoIds.push(t.id);
    byNombre.set(key, cur);
  }
  const homonimosPorNombre = [...byNombre.entries()]
    .filter(([, v]) => new Set(v.emails).size > 1)
    .map(([nombreNorm, v]) => ({
      nombreNorm,
      n: new Set(v.emails).size,
      emails: [...new Set(v.emails)],
      tecnicoIds: v.tecnicoIds,
    }));

  const estadosActivos = ["PENDIENTE", "LEIDO", "EN_PROCESO"] as const;
  const mismatchSesionVsAsignacion: AuditoriaE1["mismatchSesionVsAsignacion"] = [];

  for (const t of tecnicos) {
    if (!t.usuario) continue;
    const enSesion = await db.ticket.count({
      where: {
        estado: { in: [...estadosActivos] },
        OR: [
          { tecnicoId: t.id },
          { tecnicos: { some: { tecnicoId: t.id } } },
        ],
      },
    });

    const nombreNorm = t.usuario.nombre.trim().toUpperCase();
    const otrosIds = (byNombre.get(nombreNorm)?.tecnicoIds ?? []).filter(
      (id) => id !== t.id
    );
    if (!otrosIds.length) {
      if (enSesion === 0) {
        // sin homónimos; no hay mismatch detectable por nombre
      }
      continue;
    }

    const ticketsOtros = await db.ticket.findMany({
      where: {
        estado: { in: [...estadosActivos] },
        OR: [
          { tecnicoId: { in: otrosIds } },
          { tecnicos: { some: { tecnicoId: { in: otrosIds } } } },
        ],
      },
      select: {
        codigo: true,
        tecnicoId: true,
        tecnicos: { select: { tecnicoId: true } },
      },
      take: 50,
    });

    if (ticketsOtros.length && enSesion === 0) {
      mismatchSesionVsAsignacion.push({
        email: t.usuario.email,
        usuarioId: t.usuarioId,
        tecnicoIdSesion: t.id,
        ticketsActivosEnSesion: enSesion,
        ticketsActivosMismoNombreOtrasIds: ticketsOtros.map((tk) => ({
          codigo: tk.codigo,
          tecnicoIds: [
            ...(tk.tecnicoId ? [tk.tecnicoId] : []),
            ...tk.tecnicos.map((x) => x.tecnicoId),
          ],
        })),
      });
    }
  }

  const planRemap: RemapPlanItem[] = [];
  const usuariosTecnico = await db.usuario.findMany({
    where: { rol: "TECNICO" },
    select: {
      id: true,
      email: true,
      tecnico: { select: { id: true } },
    },
  });

  for (const u of usuariosTecnico) {
    if (!u.tecnico) continue;
    const oldIds = await encontrarCandidatosRemapDesdeEventos(
      db,
      u.id,
      u.tecnico.id
    );
    for (const oldId of oldIds) {
      const old = await db.tecnico.findUnique({
        where: { id: oldId },
        select: { usuarioId: true },
      });
      if (old && old.usuarioId !== u.id) continue;
      const medidas = await medirRemap(db, oldId, u.tecnico.id);
      const total =
        medidas.ticketTecnicos +
        medidas.ticketsPrimary +
        medidas.ordenesReportadas +
        medidas.ubicacionesGps +
        medidas.novedades;
      if (total === 0) continue;
      planRemap.push({
        oldTecnicoId: oldId,
        newTecnicoId: u.tecnico.id,
        usuarioId: u.id,
        email: u.email,
        fuente: "evento_ticket",
        ...medidas,
      });
    }
  }

  return {
    generadoEn: new Date().toISOString(),
    conteos: {
      Usuario: usuarioN,
      Tecnico: tecnicoN,
      Ticket: ticketN,
      TicketTecnico: ticketTecnicoN,
      OrdenServicio: ordenN,
      Cronometro: cronometroN,
      EventoTicket: eventoN,
    },
    usuariosTecnicoSinPerfil,
    tecnicosSinUsuario,
    ticketsPrimaryHuerfanos,
    ticketTecnicoHuerfanos,
    multiTecnicoPorUsuario,
    homonimosPorNombre,
    mismatchSesionVsAsignacion,
    planRemap,
  };
}

/**
 * Orquesta auditoría + creación de perfiles faltantes + remaps.
 * dryRun=true (default): no escribe remaps; sí puede reportar.
 * createMissing=true: crea Tecnico faltantes (necesario en login; en setup dry-run se omite).
 */
export async function aplicarReconciliacionE1(
  opts: {
    dryRun?: boolean;
    createMissing?: boolean;
    db?: PrismaClient;
  } = {}
): Promise<{
  dryRun: boolean;
  auditoria: AuditoriaE1;
  creados: { email: string; tecnicoId: string }[];
  remapsAplicados: RemapPlanItem[];
  conflictos: { email: string; detalle: string }[];
}> {
  const db = opts.db ?? defaultPrisma;
  const dryRun = opts.dryRun ?? true;
  const createMissing = opts.createMissing ?? false;

  const auditoria = await auditarIntegridadE1(db);
  const creados: { email: string; tecnicoId: string }[] = [];
  const remapsAplicados: RemapPlanItem[] = [];
  const conflictos: { email: string; detalle: string }[] = [];

  if (createMissing && !dryRun) {
    for (const u of auditoria.usuariosTecnicoSinPerfil) {
      const r = await asegurarIdentidadTecnico(u.id, {
        db,
        dryRunRemap: false,
        aplicarRemap: false,
      });
      if (r.ok && r.created) {
        creados.push({ email: u.email, tecnicoId: r.tecnicoId });
      } else if (!r.ok) {
        conflictos.push({ email: u.email, detalle: r.detalle });
      }
    }
  }

  const plan = dryRun
    ? auditoria.planRemap
    : (await auditarIntegridadE1(db)).planRemap;

  if (!dryRun) {
    for (const item of plan) {
      await remapTecnicoId(item.oldTecnicoId, item.newTecnicoId, {
        db,
        dryRun: false,
      });
      remapsAplicados.push(item);

      const ticketRef =
        (
          await db.ticketTecnico.findFirst({
            where: { tecnicoId: item.newTecnicoId },
            select: { ticketId: true },
          })
        )?.ticketId ??
        (
          await db.ticket.findFirst({
            where: { tecnicoId: item.newTecnicoId },
            select: { id: true },
          })
        )?.id;

      if (ticketRef) {
        await db.eventoTicket.create({
          data: {
            ticketId: ticketRef,
            usuarioId: item.usuarioId,
            accion: "RECONCILIACION_E1",
            metadata: JSON.stringify({
              oldTecnicoId: item.oldTecnicoId,
              newTecnicoId: item.newTecnicoId,
              medidas: {
                ticketTecnicos: item.ticketTecnicos,
                ticketsPrimary: item.ticketsPrimary,
                ordenesReportadas: item.ordenesReportadas,
                ubicacionesGps: item.ubicacionesGps,
                novedades: item.novedades,
              },
            }),
          },
        });
      }
    }
  }

  return {
    dryRun,
    auditoria: dryRun ? auditoria : await auditarIntegridadE1(db),
    creados,
    remapsAplicados,
    conflictos,
  };
}
