import { NextResponse } from "next/server";
import type {
  IrEquipoTipo,
  IrEstadoReporte,
  IrResultado,
  IrTipoTrabajo,
  Prioridad,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { enMayusculasGuardar } from "@/lib/mayusculas";
import { requireInfraSession } from "@/lib/infraestructura-red/auth";
import { registrarIrHistorial } from "@/lib/infraestructura-red/historial";
import { irReporteInclude } from "@/lib/infraestructura-red/include";
import { descontarInventarioIrReporte } from "@/lib/infraestructura-red/inventario";
import {
  IR_EQUIPOS,
  IR_ESTADOS,
  IR_RESULTADOS,
  IR_TIPOS_TRABAJO,
  puedeGestionarInfraestructura,
} from "@/lib/infraestructura-red/labels";
import { calcularTiempoMinutos } from "@/lib/infraestructura-red/tiempo";

function parseDate(v: unknown): Date | null {
  if (v === null) return null;
  if (!v || typeof v !== "string") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseOptFloat(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseOptInt(v: unknown): number | null {
  const n = parseOptFloat(v);
  return n == null ? null : Math.round(n);
}

function optStr(v: unknown): string | null {
  const s = enMayusculasGuardar(String(v || "").trim());
  return s || null;
}

async function assertAccesoReporte(
  session: { rol: string; tecnicoId?: string },
  reporteId: string,
  tecnicoId: string
) {
  if (session.rol !== "TECNICO") return true;
  if (session.tecnicoId === tecnicoId) return true;
  if (!session.tecnicoId) return false;
  const part = await prisma.irParticipante.findFirst({
    where: { reporteId, tecnicoId: session.tecnicoId },
  });
  return !!part;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireInfraSession();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const reporte = await prisma.irReporte.findUnique({
    where: { id },
    include: irReporteInclude,
  });
  if (!reporte) {
    return NextResponse.json({ error: "Reporte no encontrado" }, { status: 404 });
  }
  if (!(await assertAccesoReporte(auth.session, reporte.id, reporte.tecnicoId))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  return NextResponse.json({ reporte });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireInfraSession();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const existente = await prisma.irReporte.findUnique({
    where: { id },
    include: { clientesAfectados: true },
  });
  if (!existente) {
    return NextResponse.json({ error: "Reporte no encontrado" }, { status: 404 });
  }
  if (!(await assertAccesoReporte(auth.session, existente.id, existente.tecnicoId))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  if (
    (existente.estado === "FINALIZADO" || existente.estado === "CANCELADO") &&
    !puedeGestionarInfraestructura(auth.session.rol)
  ) {
    return NextResponse.json(
      { error: "El reporte cerrado solo lo edita supervisor/admin" },
      { status: 400 }
    );
  }

  try {
    const body = await request.json();
    const data: Prisma.IrReporteUpdateInput = {};
    const cambios: string[] = [];

    if (body.fecha !== undefined) data.fecha = parseDate(body.fecha) || existente.fecha;
    if (body.horaInicio !== undefined) data.horaInicio = parseDate(body.horaInicio);
    if (body.horaFin !== undefined) data.horaFin = parseDate(body.horaFin);

    const nextInicio =
      body.horaInicio !== undefined ? parseDate(body.horaInicio) : existente.horaInicio;
    const nextFin = body.horaFin !== undefined ? parseDate(body.horaFin) : existente.horaFin;
    if (body.horaInicio !== undefined || body.horaFin !== undefined) {
      data.tiempoMinutos = calcularTiempoMinutos(nextInicio, nextFin);
    }

    let nuevoEstado: IrEstadoReporte | undefined;
    if (body.estado && IR_ESTADOS.includes(body.estado)) {
      nuevoEstado = body.estado as IrEstadoReporte;
      data.estado = nuevoEstado;
      if (nuevoEstado !== existente.estado) cambios.push(`Estado → ${nuevoEstado}`);
    }
    if (body.prioridad && ["ALTA", "MEDIA", "BAJA"].includes(body.prioridad)) {
      data.prioridad = body.prioridad as Prioridad;
    }
    if (body.tipoTrabajo && IR_TIPOS_TRABAJO.includes(body.tipoTrabajo)) {
      data.tipoTrabajo = body.tipoTrabajo as IrTipoTrabajo;
      data.tipoTrabajoOtro =
        body.tipoTrabajo === "OTRO"
          ? enMayusculasGuardar(String(body.tipoTrabajoOtro || "").trim()) || null
          : null;
    }
    if (body.resultado !== undefined) {
      data.resultado =
        body.resultado && IR_RESULTADOS.includes(body.resultado)
          ? (body.resultado as IrResultado)
          : null;
    }

    if (typeof body.provincia === "string") data.provincia = enMayusculasGuardar(body.provincia.trim());
    if (typeof body.canton === "string") data.canton = enMayusculasGuardar(body.canton.trim());
    if (typeof body.parroquia === "string") data.parroquia = enMayusculasGuardar(body.parroquia.trim());
    if (typeof body.sector === "string") data.sector = enMayusculasGuardar(body.sector.trim());
    if (typeof body.direccion === "string") data.direccion = enMayusculasGuardar(body.direccion.trim());
    if (typeof body.descripcion === "string") data.descripcion = body.descripcion.trim();
    if (body.trabajosRealizados !== undefined) {
      data.trabajosRealizados = body.trabajosRealizados
        ? String(body.trabajosRealizados).trim()
        : null;
    }
    if (body.observaciones !== undefined) {
      data.observaciones = body.observaciones ? String(body.observaciones).trim() : null;
    }
    if (body.lat !== undefined) data.lat = parseOptFloat(body.lat);
    if (body.lng !== undefined) data.lng = parseOptFloat(body.lng);

    for (const key of [
      "nodo",
      "nap",
      "cto",
      "odf",
      "splitter",
      "manga",
      "cajaPaso",
      "tramoFibra",
    ] as const) {
      if (body[key] !== undefined) (data as Record<string, unknown>)[key] = optStr(body[key]);
    }
    if (body.cantidadHilos !== undefined) data.cantidadHilos = parseOptInt(body.cantidadHilos);
    if (body.longitudAfectadaM !== undefined) {
      data.longitudAfectadaM = parseOptFloat(body.longitudAfectadaM);
    }
    if (body.kmRedIntervenida !== undefined) {
      data.kmRedIntervenida = parseOptFloat(body.kmRedIntervenida);
    }
    if (body.clientesAfectadosN !== undefined && !Array.isArray(body.clientesAfectadosIds)) {
      data.clientesAfectadosN = parseOptInt(body.clientesAfectadosN) || 0;
    }

    if (puedeGestionarInfraestructura(auth.session.rol)) {
      if (typeof body.tecnicoId === "string" && body.tecnicoId) {
        data.tecnico = { connect: { id: body.tecnicoId } };
      }
      if (body.supervisorUsuarioId !== undefined) {
        data.supervisor = body.supervisorUsuarioId
          ? { connect: { id: body.supervisorUsuarioId } }
          : { disconnect: true };
      }
    }

    const reporte = await prisma.$transaction(async (tx) => {
      if (Array.isArray(body.materiales)) {
        await tx.irMaterial.deleteMany({ where: { reporteId: id } });
        await tx.irMaterial.createMany({
          data: body.materiales
            .filter((m: { material?: string; cantidad?: number }) => m?.material && m?.cantidad)
            .map(
              (m: {
                material: string;
                cantidad: number;
                unidad?: string;
                inventarioId?: string;
              }) => ({
                reporteId: id,
                material: enMayusculasGuardar(String(m.material).trim()),
                cantidad: Number(m.cantidad),
                unidad: String(m.unidad || "unidad").trim() || "unidad",
                inventarioId: m.inventarioId || null,
              })
            ),
        });
        cambios.push("Materiales actualizados");
      }

      if (Array.isArray(body.equipos)) {
        await tx.irEquipo.deleteMany({ where: { reporteId: id } });
        await tx.irEquipo.createMany({
          data: body.equipos
            .filter(
              (e: { tipo?: string }) => e?.tipo && IR_EQUIPOS.includes(e.tipo as IrEquipoTipo)
            )
            .map((e: { tipo: IrEquipoTipo; detalle?: string }) => ({
              reporteId: id,
              tipo: e.tipo,
              detalle: e.detalle ? String(e.detalle).trim() || null : null,
            })),
        });
        cambios.push("Equipos actualizados");
      }

      if (Array.isArray(body.participantesIds) && puedeGestionarInfraestructura(auth.session.rol)) {
        const tecnicoResp =
          typeof body.tecnicoId === "string" && body.tecnicoId
            ? body.tecnicoId
            : existente.tecnicoId;
        await tx.irParticipante.deleteMany({ where: { reporteId: id } });
        const ids = (body.participantesIds as string[]).filter(
          (pid) => pid && pid !== tecnicoResp
        );
        if (ids.length) {
          await tx.irParticipante.createMany({
            data: ids.map((tecnicoId) => ({ reporteId: id, tecnicoId })),
          });
        }
        cambios.push("Participantes actualizados");
      }

      if (Array.isArray(body.clientesAfectadosIds)) {
        const nuevos = (body.clientesAfectadosIds as string[]).filter(Boolean);
        const previos = new Set(existente.clientesAfectados.map((c) => c.clienteId));
        await tx.irClienteAfectado.deleteMany({ where: { reporteId: id } });
        if (nuevos.length) {
          await tx.irClienteAfectado.createMany({
            data: nuevos.map((clienteId) => ({ reporteId: id, clienteId })),
          });
        }
        data.clientesAfectadosN = nuevos.length;
        const agregados = nuevos.filter((cid) => !previos.has(cid));
        if (agregados.length) {
          await tx.historialCliente.createMany({
            data: agregados.map((clienteId) => ({
              clienteId,
              usuarioId: auth.session.id,
              accion: "INFRAESTRUCTURA_RED",
              cambiosJson: JSON.stringify({
                reporteId: id,
                codigo: existente.codigo,
                tipoTrabajo: existente.tipoTrabajo,
                sector: existente.sector,
                estado: nuevoEstado || existente.estado,
              }),
            })),
          });
        }
        cambios.push("Clientes afectados actualizados");
      }

      if (nuevoEstado === "FINALIZADO") {
        const inv = await descontarInventarioIrReporte(tx, id);
        if (!inv.ok) throw new Error(inv.error);
        if (!cambios.some((c) => c.includes("Estado"))) cambios.push("Finalizado");
      }

      const updated = await tx.irReporte.update({
        where: { id },
        data,
        include: irReporteInclude,
      });

      await registrarIrHistorial(tx, {
        reporteId: id,
        usuarioId: auth.session.id,
        usuarioNombre: auth.session.nombre,
        estado: updated.estado,
        nota: body.historialNota
          ? String(body.historialNota).trim()
          : cambios.length
            ? cambios.join("; ")
            : "Actualización de reporte",
      });

      return updated;
    });

    return NextResponse.json({ reporte });
  } catch (err) {
    console.error("[infraestructura/reportes PATCH]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al actualizar" },
      { status: 500 }
    );
  }
}
