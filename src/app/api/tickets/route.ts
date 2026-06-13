import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFullSession } from "@/lib/auth";
import { generarCodigoTicket, slaHorasPorPrioridad } from "@/lib/tickets";
import { parseProgramadoEn } from "@/lib/calendario";
import {
  asignarTecnicosTicket,
  notificarTecnicosNuevos,
  ticketIncludeTecnicos,
  validarTecnicoIds,
} from "@/lib/ticket-tecnicos";
import { mensajeCedulaInvalida, normalizarCedula, validarCedulaEcuatoriana } from "@/lib/cedula-ec";
import type { Prioridad, TipoTrabajo } from "@prisma/client";

const TIPOS_VALIDOS: TipoTrabajo[] = [
  "INSTALACION",
  "SOPORTE",
  "MIGRACION",
  "RECONEXION",
  "RETIRO",
  "CORTE",
];

const PRIORIDADES_VALIDAS: Prioridad[] = ["ALTA", "MEDIA", "BAJA"];

function parseTecnicoIds(body: {
  tecnicoIds?: string[];
  tecnicoId?: string | null;
}): string[] {
  if (Array.isArray(body.tecnicoIds)) {
    return body.tecnicoIds.filter(Boolean);
  }
  if (body.tecnicoId) return [body.tecnicoId];
  return [];
}

export async function POST(request: Request) {
  const session = await getFullSession();
  if (!session || !["SUPERVISOR", "ADMIN"].includes(session.rol)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json();
  const {
    clienteId,
    cedula,
    nombre,
    telefono,
    plan,
    direccion,
    sector,
    nodo,
    referencia,
    tipo,
    prioridad,
    motivo,
    descripcion,
    programadoEn,
  } = body;

  const tecnicoIds = parseTecnicoIds(body);

  if (!tipo || !TIPOS_VALIDOS.includes(tipo)) {
    return NextResponse.json({ error: "Tipo de trabajo inválido" }, { status: 400 });
  }

  const prio: Prioridad = PRIORIDADES_VALIDAS.includes(prioridad) ? prioridad : "MEDIA";

  let cliente;
  if (clienteId) {
    cliente = await prisma.cliente.findUnique({ where: { id: clienteId } });
    if (!cliente) {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
    }
    if (cedula) {
      const cedulaNorm = normalizarCedula(cedula);
      if (!validarCedulaEcuatoriana(cedulaNorm)) {
        return NextResponse.json({ error: mensajeCedulaInvalida() }, { status: 400 });
      }
    }
    cliente = await prisma.cliente.update({
      where: { id: clienteId },
      data: {
        nombre: nombre || cliente.nombre,
        telefono: telefono || cliente.telefono,
        plan: plan || cliente.plan,
        direccion: direccion || cliente.direccion,
        sector: sector || cliente.sector,
        nodo: nodo ?? cliente.nodo,
        referencia: referencia ?? cliente.referencia,
        ...(cedula ? { cedula: normalizarCedula(cedula) } : {}),
      },
    });
  } else {
    if (!cedula || !nombre || !telefono || !direccion || !sector || !referencia) {
      return NextResponse.json(
        { error: "Cédula, nombre, teléfono, dirección, sector y referencia son obligatorios" },
        { status: 400 }
      );
    }
    const cedulaNorm = normalizarCedula(cedula);
    if (!validarCedulaEcuatoriana(cedulaNorm)) {
      return NextResponse.json({ error: mensajeCedulaInvalida() }, { status: 400 });
    }
    cliente = await prisma.cliente.upsert({
      where: { cedula: cedulaNorm },
      create: {
        cedula: cedulaNorm,
        nombre,
        telefono,
        plan: plan || "Sin plan",
        direccion,
        sector,
        nodo: nodo || null,
        referencia: referencia || null,
      },
      update: {
        nombre,
        telefono,
        plan: plan || "Sin plan",
        direccion,
        sector,
        nodo: nodo || null,
        referencia: referencia || null,
      },
    });
  }

  const errTecnicos = await validarTecnicoIds(tecnicoIds);
  if (errTecnicos) {
    return NextResponse.json({ error: errTecnicos }, { status: 404 });
  }

  const slaHoras = slaHorasPorPrioridad(prio);
  const slaVenceEn = new Date(Date.now() + slaHoras * 60 * 60 * 1000);
  const codigo = await generarCodigoTicket();

  const ticket = await prisma.ticket.create({
    data: {
      codigo,
      clienteId: cliente.id,
      tecnicoId: tecnicoIds[0] ?? null,
      tipo,
      prioridad: prio,
      estado: "PENDIENTE",
      motivo: motivo || null,
      descripcion: descripcion || null,
      slaHoras,
      slaVenceEn,
      programadoEn: parseProgramadoEn(programadoEn),
      ...(tecnicoIds.length
        ? {
            tecnicos: {
              create: tecnicoIds.map((tecnicoId) => ({ tecnicoId })),
            },
          }
        : {}),
    },
    include: ticketIncludeTecnicos,
  });

  await prisma.eventoTicket.create({
    data: {
      ticketId: ticket.id,
      usuarioId: session.id,
      accion: "TICKET_CREADO",
      metadata: JSON.stringify({ codigo, tipo, prioridad, tecnicoIds }),
    },
  });

  if (tecnicoIds.length) {
    await notificarTecnicosNuevos(ticket, [], tecnicoIds);
  }

  return NextResponse.json({ ticket }, { status: 201 });
}
