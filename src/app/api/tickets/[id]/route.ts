import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFullSession } from "@/lib/auth";
import { getOrCreateOrden, calcularDuracionCronometro, slaHorasPorPrioridad } from "@/lib/tickets";
import { parseProgramadoEn } from "@/lib/calendario";
import {
  asignarTecnicosTicket,
  notificarTecnicosNuevos,
  sincronizarAsignacionesTicket,
  tecnicoAsignadoAlTicket,
  tecnicoIdsFromTicket,
  ticketIncludeTecnicos,
  validarTecnicoIds,
} from "@/lib/ticket-tecnicos";
import { AsignacionIncompletaError } from "@/lib/ticket-asignacion";
import { fotoImagenSrcRapida } from "@/lib/foto-image";
import { firmaImagenSrcRapida } from "@/lib/firma-image";
import { enMayusculasGuardar } from "@/lib/mayusculas";
import { infoReporteOrden } from "@/lib/ticket-reporte";
import {
  estadoTicketEfectivo,
  ticketPermiteEdicion,
  verificarTicketEditable,
} from "@/lib/ticket-cerrado";
import { TIPOS_ELIMINABLES_GERENCIA } from "@/lib/ticket-gerencia";
import {
  aplicarCambiosClienteTicket,
  solicitaCambioClienteEnBody,
} from "@/lib/ticket-cliente-edit";
import { novedadPendienteTicket, TIPO_NOVEDAD_LABELS } from "@/lib/novedad-ticket";
import { TRABAJOS_EXPRESS } from "@/lib/soporte-express";
import type { ModalidadSoporte, TrabajoExpress } from "@prisma/client";
import {
  bodyIntentaMutarRiesgo,
  resolverMotivoEnPatch,
  validarPrioridadConRiesgoActivo,
} from "@/lib/motivo-tecnico/reglas-patch";
import { ACCION_PRIORIDAD_CAMBIADA } from "@/lib/motivo-tecnico/riesgo-baja";
import {
  derivarEstadoCronometroAtencion,
  ticketAdmiteCronometroAtencion,
} from "@/lib/cronometro-atencion/estado";
import { derivarVistaConfirmacionVisita } from "@/lib/confirmacion-visita/reglas";
import {
  sincronizarConfirmacionPorCambioTicket,
  type ConfirmacionVisitaDbLike,
} from "@/lib/confirmacion-visita/servicio";
import { validarNumeroContratoInstalar } from "@/lib/nueva-instalacion";

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
      cronometroAtencion: {
        include: {
          iniciadoPor: { select: { nombre: true } },
          tecnico: { include: { usuario: { select: { nombre: true } } } },
        },
      },
      confirmacionVisita: true,
      materialesInstalacion: { orderBy: [{ orden: "asc" }, { createdAt: "asc" }] },
      orden: {
        include: {
          cronometro: true,
          medicion: true,
          fotografias: {
            select: { id: true, tipo: true, url: true, lat: true, lng: true },
            orderBy: { tomadaEn: "asc" },
          },
          firma: {
            select: {
              nombreCliente: true,
              cedula: true,
              imagenUrl: true,
              aceptacionCondiciones: true,
              textoAceptacion: true,
              aceptadoEn: true,
            },
          },
          materiales: { include: { inventario: true } },
        },
      },
    },
  });

  if (!ticket) return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });

  let ticketData = ticket;

  if (session.rol === "TECNICO") {
    if (!session.tecnicoId) {
      return NextResponse.json(
        { error: "Su usuario no tiene perfil de técnico. Contacte a gerencia." },
        { status: 403 }
      );
    }
    await sincronizarAsignacionesTicket(ticket.id);
    const ticketActualizado = await prisma.ticket.findUnique({
      where: { id },
      include: {
        ...ticketIncludeTecnicos,
        cronometroAtencion: {
          include: {
            iniciadoPor: { select: { nombre: true } },
            tecnico: { include: { usuario: { select: { nombre: true } } } },
          },
        },
        confirmacionVisita: true,
        materialesInstalacion: { orderBy: [{ orden: "asc" }, { createdAt: "asc" }] },
        orden: {
          include: {
            cronometro: true,
            medicion: true,
            fotografias: {
              select: { id: true, tipo: true, url: true, lat: true, lng: true },
              orderBy: { tomadaEn: "asc" },
            },
            firma: {
              select: {
                nombreCliente: true,
                cedula: true,
                imagenUrl: true,
                aceptacionCondiciones: true,
                textoAceptacion: true,
                aceptadoEn: true,
              },
            },
            materiales: { include: { inventario: true } },
          },
        },
      },
    });
    if (!ticketActualizado) {
      return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });
    }
    if (!tecnicoAsignadoAlTicket(ticketActualizado, session.tecnicoId)) {
      return NextResponse.json(
        { error: "Este ticket no está asignado a usted" },
        { status: 403 }
      );
    }
    ticketData = ticketActualizado;
  }

  const orden = ticketData.orden || (await getOrCreateOrden(ticketData.id));

  // Orden completa (GET idempotente; el cronómetro se inicia vía POST /abrir).
  const ordenActual = await prisma.ordenServicio.findUnique({
    where: { ticketId: ticketData.id },
    include: {
      cronometro: true,
      medicion: true,
      fotografias: {
        select: { id: true, tipo: true, url: true, lat: true, lng: true },
        orderBy: { tomadaEn: "asc" },
      },
      firma: {
        select: {
          nombreCliente: true,
          cedula: true,
          imagenUrl: true,
          aceptacionCondiciones: true,
          textoAceptacion: true,
          aceptadoEn: true,
        },
      },
      materiales: { include: { inventario: true } },
    },
  });

  const ordenFinal = ordenActual ?? orden;

  // F4/E5: no mutar estado en GET; el cliente ve estado efectivo si la orden ya cerró.
  const estadoEfectivo = estadoTicketEfectivo(
    { estado: ticketData.estado, estadoRevision: ticketData.estadoRevision },
    ordenFinal
  );

  const duracionSegundos = ordenFinal.cronometro
    ? calcularDuracionCronometro(
        ordenFinal.cronometro.inicio,
        ordenFinal.cronometro.fin,
        ordenFinal.cronometro.pausasJson
      )
    : 0;

  const inventario = await prisma.inventario.findMany({ orderBy: { nombre: "asc" } });

  const ordenConFotos = {
    ...ordenFinal,
    fotografias: ordenFinal.fotografias.map((f) => ({
      ...f,
      imagenSrc: fotoImagenSrcRapida(f),
    })),
    firma: ordenFinal.firma
      ? {
          ...ordenFinal.firma,
          imagenSrc: firmaImagenSrcRapida(ordenFinal.firma) ?? ordenFinal.firma.imagenUrl,
        }
      : null,
  };

  let ticketRespuesta = {
    ...ticketData,
    estado: estadoEfectivo as typeof ticketData.estado,
  };

  // F6/E8: no forzar EN_PROCESO en JSON. El estado real lo persiste
  // iniciarCronometroTicket / abrir (LEIDO). GET solo refleja BD + estado efectivo.

  const reporte =
    session.rol === "TECNICO" && session.tecnicoId
      ? await infoReporteOrden(ticketData.id, session.tecnicoId)
      : null;

  const novedadPendiente = await novedadPendienteTicket(ticketData.id);
  const nowTicket = new Date();
  const cronometroAtencion = ticketAdmiteCronometroAtencion(ticketData.tipo)
    ? derivarEstadoCronometroAtencion(
        ticketData.cronometroAtencion
          ? {
              iniciadoEn: ticketData.cronometroAtencion.iniciadoEn,
              finalizadoEn: ticketData.cronometroAtencion.finalizadoEn,
              duracionSegundos: ticketData.cronometroAtencion.duracionSegundos,
              iniciadoPorNombre: ticketData.cronometroAtencion.iniciadoPor?.nombre ?? null,
              tecnicoNombre: ticketData.cronometroAtencion.tecnico?.usuario?.nombre ?? null,
            }
          : null,
        nowTicket.getTime(),
        ticketData.estado
      )
    : null;

  const confirmacionVisita = derivarVistaConfirmacionVisita(
    {
      tipo: ticketData.tipo,
      estado: ticketData.estado,
      programadoEn: ticketData.programadoEn,
      createdAt: ticketData.createdAt,
    },
    ticketData.confirmacionVisita,
    nowTicket
  );

  return NextResponse.json({
    serverNow: nowTicket.toISOString(),
    ticket: {
      ...ticketRespuesta,
      tecnicoIds: tecnicoIdsFromTicket(ticketData),
      ordenCerrada: !!ordenFinal.finalizadoEn,
      estadoRevision: ticketData.estadoRevision,
      editable: ticketPermiteEdicion(
        {
          estado: ticketData.estado,
          estadoRevision: ticketData.estadoRevision,
        },
        ordenFinal
      ),
    },
    orden: ordenConFotos,
    duracionSegundos,
    cronometroAtencion,
    confirmacionVisita,
    inventario,
    reporte,
    esResponsableInfra:
      ticketData.tipo === "INFRAESTRUCTURA" &&
      !!session.tecnicoId &&
      session.tecnicoId === ticketData.tecnicoId,
    esResponsable:
      !!session.tecnicoId && session.tecnicoId === ticketData.tecnicoId,
    novedadPendiente: novedadPendiente
      ? {
          id: novedadPendiente.id,
          tipo: novedadPendiente.tipo,
          tipoLabel: TIPO_NOVEDAD_LABELS[novedadPendiente.tipo],
          comentario: novedadPendiente.comentario,
          fechaSolicitada: novedadPendiente.fechaSolicitada?.toISOString() ?? null,
          createdAt: novedadPendiente.createdAt.toISOString(),
        }
      : null,
  });
}

const TIPOS_VALIDOS = [
  "INSTALACION",
  "SOPORTE",
  "INFRAESTRUCTURA",
  "MIGRACION",
  "RECONEXION",
  "RETIRO",
  "CORTE",
  "CAMBIO_DOMICILIO",
  "MIGRACION_SERVICIO_FIBRA",
  "NUEVA_INSTALACION",
];
const PRIORIDADES_VALIDAS = ["ALTA", "MEDIA", "BAJA"];
const ESTADOS_VALIDOS = [
  "PENDIENTE",
  "LEIDO",
  "EN_PROCESO",
  "FINALIZADO",
  "CERRADO",
  "CANCELADO",
];

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
  const body = (await request.json()) as Record<string, unknown>;

  if (bodyIntentaMutarRiesgo(body)) {
    return NextResponse.json(
      {
        error:
          "Los campos de riesgo de baja no se pueden modificar por esta vía. Use creación o gestión documentada.",
      },
      { status: 400 }
    );
  }

  const editable = await verificarTicketEditable(id);
  if (!editable.ok) {
    return NextResponse.json({ error: editable.error }, { status: editable.status });
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: { tecnicos: true, cliente: { select: { id: true, cedula: true, nombre: true } } },
  });
  if (!ticket) {
    return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });
  }

  const idsAnteriores = tecnicoIdsFromTicket(ticket);
  const tecnicoIdsInput = parseTecnicoIds(body);
  const cambiosCliente = {
    clienteId: typeof body.clienteId === "string" ? body.clienteId : undefined,
    clienteNombre: typeof body.clienteNombre === "string" ? body.clienteNombre : undefined,
  };
  const solicitaCambioCliente = solicitaCambioClienteEnBody(ticket, cambiosCliente);

  const updateData: Record<string, unknown> = {};

  // Restaurar códigos tras migración entre entornos (SUPERVISOR/ADMIN).
  if (typeof body.codigo === "string" && body.codigo.trim()) {
    const codigoNuevo = body.codigo.trim().toUpperCase();
    if (codigoNuevo !== ticket.codigo) {
      const ocupado = await prisma.ticket.findFirst({
        where: { codigo: codigoNuevo, NOT: { id } },
        select: { id: true },
      });
      if (ocupado) {
        return NextResponse.json(
          { error: `El código ${codigoNuevo} ya está en uso` },
          { status: 409 }
        );
      }
      updateData.codigo = codigoNuevo;
    }
  }

  if (typeof body.tipo === "string" && TIPOS_VALIDOS.includes(body.tipo)) {
    updateData.tipo = body.tipo;
  }

  const tipoEfectivo =
    typeof updateData.tipo === "string" ? updateData.tipo : ticket.tipo;
  if (tipoEfectivo === "NUEVA_INSTALACION") {
    const contratoInput =
      body.numeroContratoInstalar !== undefined
        ? body.numeroContratoInstalar
        : ticket.numeroContratoInstalar;
    const contratoVal = validarNumeroContratoInstalar(tipoEfectivo, contratoInput);
    if (!contratoVal.ok) {
      return NextResponse.json({ error: contratoVal.error }, { status: 400 });
    }
    if (body.numeroContratoInstalar !== undefined || updateData.tipo !== undefined) {
      updateData.numeroContratoInstalar = contratoVal.numeroContratoInstalar;
    }
  } else if (typeof updateData.tipo === "string") {
    updateData.numeroContratoInstalar = null;
  }
  const prioridadAnterior = ticket.prioridad;
  if (typeof body.prioridad === "string" && PRIORIDADES_VALIDAS.includes(body.prioridad)) {
    const prioCheck = validarPrioridadConRiesgoActivo({
      ticket: {
        clienteRiesgoBaja: ticket.clienteRiesgoBaja,
        clienteRiesgoBajaResueltoEn: ticket.clienteRiesgoBajaResueltoEn,
        prioridad: ticket.prioridad,
      },
      prioridadNueva: body.prioridad,
    });
    if (!prioCheck.ok) {
      return NextResponse.json({ error: prioCheck.error }, { status: 400 });
    }
    if (prioCheck.prioridad && prioCheck.prioridad !== ticket.prioridad) {
      updateData.prioridad = prioCheck.prioridad;
      const slaHoras = slaHorasPorPrioridad(prioCheck.prioridad);
      updateData.slaHoras = slaHoras;
      updateData.slaVenceEn = new Date(
        ticket.createdAt.getTime() + slaHoras * 60 * 60 * 1000
      );
    }
  }
  if (typeof body.estado === "string" && ESTADOS_VALIDOS.includes(body.estado)) {
    updateData.estado = body.estado;
  }

  const motivoPatch = resolverMotivoEnPatch(
    {
      motivo: ticket.motivo,
      descripcion: ticket.descripcion,
      motivoCategoria: ticket.motivoCategoria,
      motivoCategoriaOtro: ticket.motivoCategoriaOtro,
      motivoProblema: ticket.motivoProblema,
      motivoProblemaOtro: ticket.motivoProblemaOtro,
      motivoDetalle: ticket.motivoDetalle,
      motivoImpacto: ticket.motivoImpacto,
      motivoObservaciones: ticket.motivoObservaciones,
      clienteRiesgoBaja: ticket.clienteRiesgoBaja,
      clienteRiesgoBajaResueltoEn: ticket.clienteRiesgoBajaResueltoEn,
      prioridad: ticket.prioridad,
    },
    body
  );
  if (!motivoPatch.ok) {
    return NextResponse.json(
      { error: motivoPatch.error, faltantes: motivoPatch.faltantes },
      { status: 400 }
    );
  }
  Object.assign(updateData, motivoPatch.update);

  if (body.programadoEn !== undefined) {
    updateData.programadoEn = body.programadoEn
      ? parseProgramadoEn(String(body.programadoEn))
      : null;
  }

  // Modalidad Soporte Completo / Express (solo aplica a tipo SOPORTE).
  const tipoFinal =
    typeof updateData.tipo === "string" ? (updateData.tipo as string) : ticket.tipo;
  if (body.modalidadSoporte !== undefined || body.trabajoExpress !== undefined || body.trabajoExpressOtro !== undefined) {
    if (tipoFinal !== "SOPORTE") {
      updateData.modalidadSoporte = "COMPLETO";
      updateData.trabajoExpress = null;
      updateData.trabajoExpressOtro = null;
    } else {
      const modalidadRaw = body.modalidadSoporte ?? ticket.modalidadSoporte;
      const modalidad: ModalidadSoporte =
        modalidadRaw === "EXPRESS" ? "EXPRESS" : "COMPLETO";
      updateData.modalidadSoporte = modalidad;

      if (modalidad === "COMPLETO") {
        updateData.trabajoExpress = null;
        updateData.trabajoExpressOtro = null;
      } else {
        const te =
          body.trabajoExpress !== undefined
            ? body.trabajoExpress
            : ticket.trabajoExpress;
        if (!te || !(TRABAJOS_EXPRESS as string[]).includes(String(te))) {
          return NextResponse.json(
            { error: "Seleccione el trabajo Express a realizar" },
            { status: 400 }
          );
        }
        updateData.trabajoExpress = te as TrabajoExpress;
        const otroRaw =
          body.trabajoExpressOtro !== undefined
            ? String(body.trabajoExpressOtro ?? "").trim()
            : ticket.trabajoExpressOtro?.trim() ?? "";
        if (te === "OTRO" && otroRaw.length < 3) {
          return NextResponse.json(
            { error: "Indique el detalle del trabajo (Otro)" },
            { status: 400 }
          );
        }
        updateData.trabajoExpressOtro =
          te === "OTRO" ? enMayusculasGuardar(otroRaw) : null;
      }
    }
  } else if (updateData.tipo && updateData.tipo !== "SOPORTE") {
    updateData.modalidadSoporte = "COMPLETO";
    updateData.trabajoExpress = null;
    updateData.trabajoExpressOtro = null;
  }

  if (tecnicoIdsInput !== undefined) {
    const errTecnicos = await validarTecnicoIds(tecnicoIdsInput);
    if (errTecnicos) {
      return NextResponse.json({ error: errTecnicos }, { status: 404 });
    }
  }

  class ErrorValidacionCliente extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  }

  type ResultadoClienteEdit = {
    clienteId: string;
    nombreActualizado: boolean;
    clienteReasignado: boolean;
  };
  let resultadoCliente: ResultadoClienteEdit | null = null;

  try {
    resultadoCliente = await prisma.$transaction(async (tx): Promise<ResultadoClienteEdit | null> => {
      // D-3a: leer estado real del ticket dentro de la transacción inmediatamente antes de actualizar
      const prevTx = await tx.ticket.findUnique({
        where: { id },
        select: { id: true, tipo: true, programadoEn: true, clienteId: true },
      });
      if (!prevTx) {
        throw new ErrorValidacionCliente(404, "Ticket no encontrado");
      }

      let resClienteTx: ResultadoClienteEdit | null = null;
      if (solicitaCambioCliente) {
        const resCliente = await aplicarCambiosClienteTicket(
          prevTx,
          cambiosCliente,
          session.id,
          tx
        );
        if (!resCliente.ok) {
          throw new ErrorValidacionCliente(resCliente.status, resCliente.error);
        }
        if (resCliente.clienteReasignado || resCliente.nombreActualizado) {
          resClienteTx = {
            clienteId: resCliente.clienteId,
            nombreActualizado: resCliente.nombreActualizado,
            clienteReasignado: resCliente.clienteReasignado,
          };
        }
      }

      if (
        Object.keys(updateData).length === 0 &&
        tecnicoIdsInput === undefined &&
        !resClienteTx
      ) {
        throw new ErrorValidacionCliente(400, "Sin cambios");
      }

      if (Object.keys(updateData).length > 0) {
        await tx.ticket.update({ where: { id }, data: updateData });
      }

      const tipoNuevoTx =
        typeof updateData.tipo === "string" ? (updateData.tipo as string) : prevTx.tipo;
      const programadoEnNuevo =
        updateData.programadoEn !== undefined
          ? (updateData.programadoEn as Date | null)
          : prevTx.programadoEn;
      const clienteIdNuevo = resClienteTx?.clienteId ?? prevTx.clienteId;

      if (
        updateData.programadoEn !== undefined ||
        tipoNuevoTx !== prevTx.tipo ||
        clienteIdNuevo !== prevTx.clienteId
      ) {
        await sincronizarConfirmacionPorCambioTicket({
          ticketId: id,
          tipoAnterior: prevTx.tipo,
          tipoNuevo: tipoNuevoTx,
          programadoEnAnterior: prevTx.programadoEn,
          programadoEnNuevo,
          clienteIdAnterior: prevTx.clienteId,
          clienteIdNuevo,
          usuarioId: session.id,
          db: tx as unknown as ConfirmacionVisitaDbLike,
        });
      }

      return resClienteTx;
    });
  } catch (e) {
    if (e instanceof ErrorValidacionCliente) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }

  let idsNuevos = idsAnteriores;
  if (tecnicoIdsInput !== undefined) {
    try {
      idsNuevos = await asignarTecnicosTicket(id, tecnicoIdsInput);
    } catch (e) {
      if (e instanceof AsignacionIncompletaError) {
        return NextResponse.json({ error: e.message }, { status: 409 });
      }
      throw e;
    }
  }

  const updated = await prisma.ticket.findUnique({
    where: { id },
    include: ticketIncludeTecnicos,
  });

  if (!updated) {
    return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });
  }

  if (
    typeof updateData.prioridad === "string" &&
    updateData.prioridad !== prioridadAnterior
  ) {
    await prisma.eventoTicket.create({
      data: {
        ticketId: id,
        usuarioId: session.id,
        accion: ACCION_PRIORIDAD_CAMBIADA,
        metadata: JSON.stringify({
          de: prioridadAnterior,
          a: updateData.prioridad,
          motivo: "edicion_manual",
        }),
      },
    });
  }

  await prisma.eventoTicket.create({
    data: {
      ticketId: id,
      usuarioId: session.id,
      accion: "TICKET_MODIFICADO",
      metadata: JSON.stringify({
        ...updateData,
        tecnicoIds: idsNuevos,
        ...(resultadoCliente
          ? {
              clienteId: resultadoCliente.clienteId,
              clienteReasignado: resultadoCliente.clienteReasignado,
              clienteNombreActualizado: resultadoCliente.nombreActualizado,
            }
          : {}),
      }),
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

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getFullSession();
  if (!session || session.rol !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const { eliminarTicketPorId } = await import("@/lib/eliminar-ticket");
    const result = await eliminarTicketPorId(id, {
      tiposPermitidos: TIPOS_ELIMINABLES_GERENCIA,
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo eliminar el ticket";
    const status = message.includes("no encontrado") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
