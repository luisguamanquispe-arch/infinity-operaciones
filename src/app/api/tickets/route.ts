import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFullSession } from "@/lib/auth";
import { generarCodigoTicket, slaHorasPorPrioridad } from "@/lib/tickets";
import { parseProgramadoEn } from "@/lib/calendario";
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
    tecnicoId,
    programadoEn,
  } = body;

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
      },
    });
  } else {
    if (!cedula || !nombre || !telefono || !direccion || !sector || !referencia) {
      return NextResponse.json(
        { error: "Cédula, nombre, teléfono, dirección, sector y referencia son obligatorios" },
        { status: 400 }
      );
    }
    cliente = await prisma.cliente.upsert({
      where: { cedula },
      create: {
        cedula,
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

  if (tecnicoId) {
    const tecnico = await prisma.tecnico.findUnique({ where: { id: tecnicoId } });
    if (!tecnico) {
      return NextResponse.json({ error: "Técnico no encontrado" }, { status: 404 });
    }
  }

  const slaHoras = slaHorasPorPrioridad(prio);
  const slaVenceEn = new Date(Date.now() + slaHoras * 60 * 60 * 1000);
  const codigo = await generarCodigoTicket();

  const ticket = await prisma.ticket.create({
    data: {
      codigo,
      clienteId: cliente.id,
      tecnicoId: tecnicoId || null,
      tipo,
      prioridad: prio,
      estado: "PENDIENTE",
      motivo: motivo || null,
      descripcion: descripcion || null,
      slaHoras,
      slaVenceEn,
      programadoEn: parseProgramadoEn(programadoEn),
    },
    include: {
      cliente: true,
      tecnico: { include: { usuario: true } },
    },
  });

  await prisma.eventoTicket.create({
    data: {
      ticketId: ticket.id,
      usuarioId: session.id,
      accion: "TICKET_CREADO",
      metadata: JSON.stringify({ codigo, tipo, prioridad, tecnicoId }),
    },
  });

  return NextResponse.json({ ticket }, { status: 201 });
}
