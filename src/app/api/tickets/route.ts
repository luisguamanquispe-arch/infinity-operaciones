import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFullSession } from "@/lib/auth";
import { generarCodigoTicket, slaHorasPorPrioridad } from "@/lib/tickets";
import { parseProgramadoEn } from "@/lib/calendario";
import {
  notificarTecnicosNuevos,
  ticketIncludeTecnicos,
  validarTecnicoIds,
} from "@/lib/ticket-tecnicos";
import { normalizarTextoTicket, enMayusculasGuardar } from "@/lib/mayusculas";
import { getOrCreateClienteInfraestructura } from "@/lib/cliente-infraestructura";
import {
  minTecnicosInfraestructura,
  MOTIVOS_INFRA,
  motivoInfraTexto,
} from "@/lib/ticket-infraestructura";
import type { MotivoInfraestructura, Prioridad, TipoTrabajo } from "@prisma/client";

const TIPOS_VALIDOS: TipoTrabajo[] = [
  "INSTALACION",
  "SOPORTE",
  "INFRAESTRUCTURA",
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

  if (tipo === "INFRAESTRUCTURA") {
    const {
      motivoInfraestructura,
      nodoAfectado,
      zonaInfra,
    } = body as {
      motivoInfraestructura?: MotivoInfraestructura;
      nodoAfectado?: string;
      zonaInfra?: string;
    };

    if (!motivoInfraestructura || !MOTIVOS_INFRA.includes(motivoInfraestructura)) {
      return NextResponse.json({ error: "Seleccione el tipo de incidente de infraestructura" }, { status: 400 });
    }
    if (!nodoAfectado?.trim()) {
      return NextResponse.json({ error: "Indique el nodo afectado" }, { status: 400 });
    }
    if (!descripcion?.trim()) {
      return NextResponse.json({ error: "La descripción del trabajo es obligatoria" }, { status: 400 });
    }
    if (tecnicoIds.length < minTecnicosInfraestructura()) {
      return NextResponse.json(
        { error: `Asigne al menos ${minTecnicosInfraestructura()} técnicos para infraestructura` },
        { status: 400 }
      );
    }

    const errTecnicos = await validarTecnicoIds(tecnicoIds);
    if (errTecnicos) {
      return NextResponse.json({ error: errTecnicos }, { status: 404 });
    }

    const cliente = await getOrCreateClienteInfraestructura();
    const slaHoras = slaHorasPorPrioridad(prio);
    const slaVenceEn = new Date(Date.now() + slaHoras * 60 * 60 * 1000);
    const codigo = await generarCodigoTicket("INFRAESTRUCTURA");
    const motivoTexto = motivoInfraTexto(motivoInfraestructura);
    const datosTicket = normalizarTextoTicket({
      motivo: motivoTexto,
      descripcion: descripcion || null,
    });

    const ticket = await prisma.ticket.create({
      data: {
        codigo,
        clienteId: cliente.id,
        tecnicoId: tecnicoIds[0],
        tipo: "INFRAESTRUCTURA",
        prioridad: prio,
        estado: "PENDIENTE",
        ...datosTicket,
        motivoInfraestructura,
        nodoAfectado: enMayusculasGuardar(nodoAfectado),
        zonaInfra: zonaInfra?.trim() ? enMayusculasGuardar(zonaInfra) : null,
        slaHoras,
        slaVenceEn,
        programadoEn: parseProgramadoEn(programadoEn),
        tecnicos: {
          create: tecnicoIds.map((tecnicoId) => ({ tecnicoId })),
        },
      },
      include: ticketIncludeTecnicos,
    });

    await prisma.eventoTicket.create({
      data: {
        ticketId: ticket.id,
        usuarioId: session.id,
        accion: "TICKET_CREADO",
        metadata: JSON.stringify({
          codigo,
          tipo: "INFRAESTRUCTURA",
          motivoInfraestructura,
          nodoAfectado,
          tecnicoIds,
        }),
      },
    });

    await notificarTecnicosNuevos(ticket, [], tecnicoIds);

    return NextResponse.json({ ticket }, { status: 201 });
  }

  let cliente;
  if (!clienteId) {
    return NextResponse.json(
      { error: "Seleccione un cliente existente o créelo en Clientes antes de abrir el ticket" },
      { status: 400 }
    );
  }

  cliente = await prisma.cliente.findUnique({ where: { id: clienteId } });
  if (!cliente) {
    return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
  }
  if (!cliente.activo) {
    return NextResponse.json({ error: "El cliente seleccionado está inactivo" }, { status: 400 });
  }
  if (cliente.cedula === "1790016919001") {
    return NextResponse.json(
      { error: "Use el formulario de infraestructura para el cliente interno" },
      { status: 400 }
    );
  }

  const errTecnicos = await validarTecnicoIds(tecnicoIds);
  if (errTecnicos) {
    return NextResponse.json({ error: errTecnicos }, { status: 404 });
  }

  if (tecnicoIds.length === 0) {
    return NextResponse.json(
      { error: "Asigne al menos un técnico al ticket" },
      { status: 400 }
    );
  }

  const slaHoras = slaHorasPorPrioridad(prio);
  const slaVenceEn = new Date(Date.now() + slaHoras * 60 * 60 * 1000);
  const codigo = await generarCodigoTicket(tipo);
  const datosTicket = normalizarTextoTicket({ motivo: motivo || null, descripcion: descripcion || null });

  const ticket = await prisma.ticket.create({
    data: {
      codigo,
      clienteId: cliente.id,
      tecnicoId: tecnicoIds[0] ?? null,
      tipo,
      prioridad: prio,
      estado: "PENDIENTE",
      ...datosTicket,
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
