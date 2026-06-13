import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFullSession } from "@/lib/auth";
import { getOrCreateOrden, calcularDuracionCronometro, slaHorasPorPrioridad } from "@/lib/tickets";
import { parseProgramadoEn } from "@/lib/calendario";
import {
  asignarTecnicosTicket,
  notificarTecnicosNuevos,
  tecnicoAsignadoAlTicket,
  tecnicoIdsFromTicket,
  ticketIncludeTecnicos,
  validarTecnicoIds,
} from "@/lib/ticket-tecnicos";
import { fotoImagenSrcRapida } from "@/lib/foto-image";
import { firmaImagenSrcRapida } from "@/lib/firma-image";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getFullSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      ...ticketIncludeTecnicos,
      orden: {
        include: {
          cronometro: true,
          medicion: true,
          fotografias: {
            select: { id: true, tipo: true, url: true, lat: true, lng: true },
          },
          firma: {
            select: {
              nombreCliente: true,
              cedula: true,
              imagenUrl: true,
            },
          },
          materiales: { include: { inventario: true } },
        },
      },
    },
  });

  if (!ticket) return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });

  if (session.rol === "TECNICO" && !tecnicoAsignadoAlTicket(ticket, session.tecnicoId)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const orden = ticket.orden || (await getOrCreateOrden(ticket.id));

  const duracionSegundos = orden.cronometro
    ? calcularDuracionCronometro(
        orden.cronometro.inicio,
        orden.cronometro.fin,
        orden.cronometro.pausasJson
      )
    : 0;

  const inventario = await prisma.inventario.findMany({ orderBy: { nombre: "asc" } });

  const ordenConFotos = {
    ...orden,
    fotografias: orden.fotografias.map((f) => ({
      ...f,
      imagenSrc: fotoImagenSrcRapida(f),
    })),
    firma: orden.firma
      ? {
          ...orden.firma,
          imagenSrc: firmaImagenSrcRapida(orden.firma) ?? orden.firma.imagenUrl,
        }
      : null,
  };

  return NextResponse.json({
    ticket: {
      ...ticket,
      tecnicoIds: tecnicoIdsFromTicket(ticket),
    },
    orden: ordenConFotos,
    duracionSegundos,
    inventario,
  });
}

const TIPOS_VALIDOS = ["INSTALACION", "SOPORTE", "MIGRACION", "RECONEXION", "RETIRO", "CORTE"];
const PRIORIDADES_VALIDAS = ["ALTA", "MEDIA", "BAJA"];
const ESTADOS_VALIDOS = ["PENDIENTE", "EN_PROCESO", "FINALIZADO", "CERRADO", "CANCELADO"];

function parseTecnicoIds(body: {
  tecnicoIds?: string[];
  tecnicoId?: string | null;
}): string[] | undefined {
  if (body.tecnicoIds !== undefined) {
    return Array.isArray(body.tecnicoIds) ? body.tecnicoIds.filter(Boolean) : [];
  }
  if (body.tecnicoId !== undefined) {
    return body.tecnicoId ? [body.tecnicoId] : [];
  }
  return undefined;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getFullSession();
  if (!session || !["SUPERVISOR", "ADMIN"].includes(session.rol)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: { tecnicos: true },
  });
  if (!ticket) {
    return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });
  }

  const idsAnteriores = tecnicoIdsFromTicket(ticket);
  const tecnicoIdsInput = parseTecnicoIds(body);

  const updateData: Record<string, unknown> = {};

  if (body.tipo && TIPOS_VALIDOS.includes(body.tipo)) updateData.tipo = body.tipo;
  if (body.prioridad && PRIORIDADES_VALIDAS.includes(body.prioridad)) {
    updateData.prioridad = body.prioridad;
    const slaHoras = slaHorasPorPrioridad(body.prioridad);
    updateData.slaHoras = slaHoras;
    updateData.slaVenceEn = new Date(ticket.createdAt.getTime() + slaHoras * 60 * 60 * 1000);
  }
  if (body.estado && ESTADOS_VALIDOS.includes(body.estado)) updateData.estado = body.estado;
  if (body.motivo !== undefined) updateData.motivo = body.motivo || null;
  if (body.descripcion !== undefined) updateData.descripcion = body.descripcion || null;
  if (body.programadoEn !== undefined) {
    updateData.programadoEn = body.programadoEn ? parseProgramadoEn(body.programadoEn) : null;
  }

  if (tecnicoIdsInput !== undefined) {
    const errTecnicos = await validarTecnicoIds(tecnicoIdsInput);
    if (errTecnicos) {
      return NextResponse.json({ error: errTecnicos }, { status: 404 });
    }
  }

  if (Object.keys(updateData).length === 0 && tecnicoIdsInput === undefined) {
    return NextResponse.json({ error: "Sin cambios" }, { status: 400 });
  }

  if (Object.keys(updateData).length > 0) {
    await prisma.ticket.update({ where: { id }, data: updateData });
  }

  let idsNuevos = idsAnteriores;
  if (tecnicoIdsInput !== undefined) {
    idsNuevos = await asignarTecnicosTicket(id, tecnicoIdsInput);
  }

  const updated = await prisma.ticket.findUnique({
    where: { id },
    include: ticketIncludeTecnicos,
  });

  if (!updated) {
    return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });
  }

  await prisma.eventoTicket.create({
    data: {
      ticketId: id,
      usuarioId: session.id,
      accion: "TICKET_MODIFICADO",
      metadata: JSON.stringify({ ...updateData, tecnicoIds: idsNuevos }),
    },
  });

  const huboProgramacion =
    updateData.programadoEn !== undefined || tecnicoIdsInput !== undefined;
  if (huboProgramacion && idsNuevos.length) {
    await notificarTecnicosNuevos(updated, idsAnteriores, idsNuevos);
  }

  return NextResponse.json({
    ticket: { ...updated, tecnicoIds: idsNuevos },
  });
}
