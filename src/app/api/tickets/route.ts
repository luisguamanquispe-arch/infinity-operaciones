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
  SI_TIPOS_TRABAJO,
  mapMotivoToSiTipo,
  siTipoTrabajoTexto,
} from "@/lib/ticket-infraestructura";
import { registrarSiHistorial } from "@/lib/soporte-infraestructura/historial";
import type {
  ModalidadSoporte,
  MotivoInfraestructura,
  Prioridad,
  SiTipoTrabajo,
  TipoTrabajo,
  TrabajoExpress,
} from "@prisma/client";
import { TRABAJOS_EXPRESS } from "@/lib/soporte-express";

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
  const { clienteId, tipo, prioridad, motivo, descripcion, programadoEn } = body;

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
      siTipoTrabajo,
      siTipoTrabajoOtro,
      provincia,
      canton,
      parroquia,
      sectorInfra,
      direccionInfra,
      referenciaInfra,
      latInfra,
      lngInfra,
      tecnicoResponsableId,
    } = body as {
      motivoInfraestructura?: MotivoInfraestructura;
      nodoAfectado?: string;
      zonaInfra?: string;
      siTipoTrabajo?: string;
      siTipoTrabajoOtro?: string;
      provincia?: string;
      canton?: string;
      parroquia?: string;
      sectorInfra?: string;
      direccionInfra?: string;
      referenciaInfra?: string;
      latInfra?: number | null;
      lngInfra?: number | null;
      tecnicoResponsableId?: string;
    };

    let tipoSi = siTipoTrabajo as SiTipoTrabajo | undefined;
    if (!tipoSi || !SI_TIPOS_TRABAJO.includes(tipoSi)) {
      if (motivoInfraestructura && MOTIVOS_INFRA.includes(motivoInfraestructura)) {
        tipoSi = mapMotivoToSiTipo(motivoInfraestructura);
      } else {
        return NextResponse.json(
          { error: "Seleccione el tipo de trabajo de infraestructura" },
          { status: 400 }
        );
      }
    }

    const provinciaN = enMayusculasGuardar(String(provincia || "").trim());
    const cantonN = enMayusculasGuardar(String(canton || "").trim());
    const parroquiaN = enMayusculasGuardar(String(parroquia || "").trim());
    const sectorN = enMayusculasGuardar(String(sectorInfra || zonaInfra || "").trim());
    const direccionN = enMayusculasGuardar(
      String(direccionInfra || nodoAfectado || "").trim()
    );

    if (!provinciaN || !cantonN || !parroquiaN || !sectorN || !direccionN) {
      return NextResponse.json(
        {
          error:
            "Complete provincia, cantón, parroquia, sector y dirección del soporte de infraestructura",
        },
        { status: 400 }
      );
    }
    if (!descripcion?.trim()) {
      return NextResponse.json(
        { error: "La descripción del trabajo es obligatoria" },
        { status: 400 }
      );
    }
    if (tecnicoIds.length < minTecnicosInfraestructura()) {
      return NextResponse.json(
        { error: `Asigne al menos ${minTecnicosInfraestructura()} técnico(s)` },
        { status: 400 }
      );
    }

    const responsableId =
      typeof tecnicoResponsableId === "string" && tecnicoResponsableId
        ? tecnicoResponsableId
        : tecnicoIds[0];
    if (!tecnicoIds.includes(responsableId)) {
      return NextResponse.json(
        { error: "El técnico responsable debe estar entre los asignados" },
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
    const motivoTexto = siTipoTrabajoTexto(tipoSi, siTipoTrabajoOtro);
    const datosTicket = normalizarTextoTicket({
      motivo: motivoTexto,
      descripcion: descripcion || null,
    });

    const ticket = await prisma.ticket.create({
      data: {
        codigo,
        clienteId: cliente.id,
        tecnicoId: responsableId,
        tipo: "INFRAESTRUCTURA",
        prioridad: prio,
        estado: "LEIDO",
        ...datosTicket,
        motivoInfraestructura:
          motivoInfraestructura && MOTIVOS_INFRA.includes(motivoInfraestructura)
            ? motivoInfraestructura
            : tipoSi === "CORTE_FIBRA"
              ? "CORTE_FIBRA"
              : null,
        siTipoTrabajo: tipoSi,
        siTipoTrabajoOtro:
          tipoSi === "OTRO"
            ? enMayusculasGuardar(String(siTipoTrabajoOtro || "").trim()) || null
            : null,
        nodoAfectado: nodoAfectado?.trim()
          ? enMayusculasGuardar(nodoAfectado)
          : direccionN,
        zonaInfra: zonaInfra?.trim() ? enMayusculasGuardar(zonaInfra) : sectorN,
        provincia: provinciaN,
        canton: cantonN,
        parroquia: parroquiaN,
        sectorInfra: sectorN,
        direccionInfra: direccionN,
        referenciaInfra: referenciaInfra?.trim()
          ? enMayusculasGuardar(referenciaInfra)
          : null,
        latInfra: typeof latInfra === "number" ? latInfra : null,
        lngInfra: typeof lngInfra === "number" ? lngInfra : null,
        slaHoras,
        slaVenceEn,
        programadoEn: parseProgramadoEn(programadoEn),
        tecnicos: {
          create: tecnicoIds.map((id) => ({ tecnicoId: id })),
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
          siTipoTrabajo: tipoSi,
          tecnicoIds,
          tecnicoResponsableId: responsableId,
        }),
      },
    });

    await registrarSiHistorial(prisma, {
      ticketId: ticket.id,
      usuarioId: session.id,
      usuarioNombre: session.nombre,
      accion: "ORDEN_CREADA",
      detalle: `Orden ${codigo} creada · Responsable asignado · ${tecnicoIds.length} técnico(s)`,
    });

    await notificarTecnicosNuevos(ticket, [], tecnicoIds);

    return NextResponse.json({ ticket }, { status: 201 });
  }

  if (!clienteId) {
    return NextResponse.json(
      {
        error:
          "Seleccione un cliente existente o créelo en Clientes antes de abrir el ticket",
      },
      { status: 400 }
    );
  }

  const cliente = await prisma.cliente.findUnique({ where: { id: clienteId } });
  if (!cliente) {
    return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
  }
  if (!cliente.activo) {
    return NextResponse.json({ error: "El cliente seleccionado está inactivo" }, { status: 400 });
  }
  if (cliente.cedula === "1790016919001") {
    return NextResponse.json(
      { error: "Use el formulario de Soporte de Infraestructura (Nuevo Soporte)" },
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

  const modalidadRaw = (body as { modalidadSoporte?: string }).modalidadSoporte;
  const modalidadSoporte: ModalidadSoporte =
    tipo === "SOPORTE" && modalidadRaw === "EXPRESS" ? "EXPRESS" : "COMPLETO";

  let trabajoExpress: TrabajoExpress | null = null;
  let trabajoExpressOtro: string | null = null;
  if (modalidadSoporte === "EXPRESS") {
    const te = (body as { trabajoExpress?: string }).trabajoExpress;
    if (!te || !(TRABAJOS_EXPRESS as string[]).includes(te)) {
      return NextResponse.json(
        { error: "Seleccione el trabajo Express a realizar" },
        { status: 400 }
      );
    }
    trabajoExpress = te as TrabajoExpress;
    const otro = String((body as { trabajoExpressOtro?: string }).trabajoExpressOtro ?? "").trim();
    if (trabajoExpress === "OTRO" && otro.length < 3) {
      return NextResponse.json(
        { error: "Indique el detalle del trabajo (Otro)" },
        { status: 400 }
      );
    }
    trabajoExpressOtro =
      trabajoExpress === "OTRO" ? enMayusculasGuardar(otro) : null;
  }

  const slaHoras = slaHorasPorPrioridad(prio);
  const slaVenceEn = new Date(Date.now() + slaHoras * 60 * 60 * 1000);
  const codigo = await generarCodigoTicket(tipo);
  const datosTicket = normalizarTextoTicket({
    motivo: motivo || null,
    descripcion: descripcion || null,
  });

  const ticket = await prisma.ticket.create({
    data: {
      codigo,
      clienteId: cliente.id,
      tecnicoId: tecnicoIds[0] ?? null,
      tipo,
      modalidadSoporte,
      trabajoExpress,
      trabajoExpressOtro,
      prioridad: prio,
      estado: "PENDIENTE",
      ...datosTicket,
      slaHoras,
      slaVenceEn,
      programadoEn: parseProgramadoEn(programadoEn),
      ...(tecnicoIds.length
        ? {
            tecnicos: {
              create: tecnicoIds.map((id) => ({ tecnicoId: id })),
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
      metadata: JSON.stringify({
        codigo,
        tipo,
        prioridad,
        tecnicoIds,
        modalidadSoporte,
        trabajoExpress,
      }),
    },
  });

  if (tecnicoIds.length) {
    await notificarTecnicosNuevos(ticket, [], tecnicoIds);
  }

  return NextResponse.json({ ticket }, { status: 201 });
}
