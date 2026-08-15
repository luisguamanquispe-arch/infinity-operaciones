import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFullSession } from "@/lib/auth";
import { parseProgramadoEn } from "@/lib/calendario";
import {
  asignarTecnicosTicket,
  nombresTecnicosTicket,
  notificarTecnicosNuevos,
  tecnicoIdsFromTicket,
  ticketIncludeTecnicos,
  validarTecnicoIds,
} from "@/lib/ticket-tecnicos";
import { AsignacionIncompletaError } from "@/lib/ticket-asignacion";
import {
  diasDesdeReferencia,
  esTicketNoAtendido,
  faseSemaforoTiempo,
  whereTicketNoAtendido,
} from "@/lib/ticket-antiguedad";
import { verificarTicketEditable } from "@/lib/ticket-cerrado";
import { SI_ESTADO_LABELS, SI_TIPO_TRABAJO_LABELS } from "@/lib/ticket-infraestructura";

export const runtime = "nodejs";

/** Lista soportes/infra abiertos con ≥4 días sin atención. */
export async function GET(request: Request) {
  const session = await getFullSession();
  if (!session || !["SUPERVISOR", "ADMIN"].includes(session.rol)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const ambito = searchParams.get("ambito")?.trim() || "todos";
  // clientes | infra | todos
  const extra =
    ambito === "infra"
      ? { tipo: "INFRAESTRUCTURA" as const }
      : ambito === "clientes"
        ? { tipo: { not: "INFRAESTRUCTURA" as const } }
        : undefined;

  const now = new Date();
  const tickets = await prisma.ticket.findMany({
    where: whereTicketNoAtendido(extra, now),
    include: {
      ...ticketIncludeTecnicos,
      tecnico: { include: { usuario: { select: { nombre: true } } } },
    },
    orderBy: [{ createdAt: "asc" }, { prioridad: "asc" }],
    take: 200,
  });

  return NextResponse.json({
    total: tickets.length,
    tickets: tickets.map((t) => {
      const dias = diasDesdeReferencia(t, now);
      return {
        id: t.id,
        codigo: t.codigo,
        tipo: t.tipo,
        esInfra: t.tipo === "INFRAESTRUCTURA",
        prioridad: t.prioridad,
        estado: t.estado,
        estadoLabel:
          t.tipo === "INFRAESTRUCTURA"
            ? SI_ESTADO_LABELS[t.estado] || t.estado
            : t.estado,
        motivo: t.motivo,
        tipoLabel:
          t.tipo === "INFRAESTRUCTURA" && t.siTipoTrabajo
            ? SI_TIPO_TRABAJO_LABELS[t.siTipoTrabajo]
            : t.motivo || t.tipo,
        createdAt: t.createdAt.toISOString(),
        programadoEn: t.programadoEn?.toISOString() ?? null,
        diasSinAtencion: Math.floor(dias),
        diasSinAtencionExacto: Number(dias.toFixed(1)),
        faseTiempo: faseSemaforoTiempo(t, now),
        cliente: {
          nombre: t.cliente.nombre,
          sector: t.cliente.sector,
          direccion: t.cliente.direccion,
        },
        sector:
          t.tipo === "INFRAESTRUCTURA"
            ? t.sectorInfra || t.zonaInfra || t.cliente.sector
            : t.cliente.sector,
        direccion:
          t.tipo === "INFRAESTRUCTURA"
            ? t.direccionInfra || t.nodoAfectado || t.cliente.direccion
            : t.cliente.direccion,
        tecnicoIds: tecnicoIdsFromTicket(t),
        tecnicosLabel: nombresTecnicosTicket(t),
      };
    }),
  });
}

/**
 * Re-agenda un soporte no atendido: nueva fecha → vuelve a listas activas
 * (el reloj de 4 días se reinicia con programadoEn).
 */
export async function PATCH(request: Request) {
  const session = await getFullSession();
  if (!session || !["SUPERVISOR", "ADMIN"].includes(session.rol)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await request.json();
  const ticketId = typeof body.ticketId === "string" ? body.ticketId : "";
  if (!ticketId) {
    return NextResponse.json({ error: "ticketId requerido" }, { status: 400 });
  }
  if (!body.programadoEn) {
    return NextResponse.json(
      { error: "Indique la nueva fecha y hora de visita" },
      { status: 400 }
    );
  }

  const editable = await verificarTicketEditable(ticketId);
  if (!editable.ok) {
    return NextResponse.json({ error: editable.error }, { status: editable.status });
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { tecnicos: true, orden: { select: { finalizadoEn: true } } },
  });
  if (!ticket) {
    return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });
  }

  if (!esTicketNoAtendido(ticket)) {
    return NextResponse.json(
      {
        error:
          "Este ticket aún está dentro del plazo de 4 días; edítelo desde Destinar tickets o Calendario",
      },
      { status: 400 }
    );
  }

  const programadoEn = parseProgramadoEn(body.programadoEn);
  if (!programadoEn) {
    return NextResponse.json({ error: "Fecha de programación inválida" }, { status: 400 });
  }

  let tecnicoIdsInput: string[] | undefined;
  if (Array.isArray(body.tecnicoIds)) {
    const ids = body.tecnicoIds.filter(Boolean) as string[];
    const err = await validarTecnicoIds(ids);
    if (err) return NextResponse.json({ error: err }, { status: 404 });
    tecnicoIdsInput = ids;
  }

  const idsAnteriores = tecnicoIdsFromTicket(ticket);

  await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      programadoEn,
      // Reinicia atención operativa para que el técnico lo vea como pendiente.
      estado: ticket.estado === "EN_PROCESO" ? "EN_PROCESO" : "PENDIENTE",
    },
  });

  let idsNuevos = idsAnteriores;
  if (tecnicoIdsInput !== undefined) {
    try {
      idsNuevos = await asignarTecnicosTicket(ticketId, tecnicoIdsInput);
    } catch (e) {
      if (e instanceof AsignacionIncompletaError) {
        return NextResponse.json({ error: e.message }, { status: 409 });
      }
      throw e;
    }
  }

  const updated = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: ticketIncludeTecnicos,
  });

  await prisma.eventoTicket.create({
    data: {
      ticketId,
      usuarioId: session.id,
      accion: "TICKET_REAGENDADO",
      metadata: JSON.stringify({
        programadoEn: programadoEn.toISOString(),
        tecnicoIds: idsNuevos,
        origen: "no_atendidos",
      }),
    },
  });

  if (updated && idsNuevos.length) {
    await notificarTecnicosNuevos(updated, idsAnteriores, idsNuevos);
  }

  return NextResponse.json({
    ok: true,
    ticket: updated
      ? {
          id: updated.id,
          codigo: updated.codigo,
          programadoEn: updated.programadoEn?.toISOString() ?? null,
          estado: updated.estado,
          tecnicosLabel: nombresTecnicosTicket(updated),
        }
      : null,
  });
}
