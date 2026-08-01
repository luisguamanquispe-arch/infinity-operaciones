import { NextResponse } from "next/server";
import type { IrEstadoReporte, IrTipoTrabajo, Prioridad, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { enMayusculasGuardar } from "@/lib/mayusculas";
import { requireInfraSession } from "@/lib/infraestructura-red/auth";
import { IR_ESTADOS, IR_TIPOS_TRABAJO, puedeGestionarInfraestructura } from "@/lib/infraestructura-red/labels";

const reporteInclude = {
  tecnico: { include: { usuario: { select: { id: true, nombre: true, email: true } } } },
  supervisor: { select: { id: true, nombre: true, email: true } },
  materiales: true,
  fotografias: { orderBy: { tomadaEn: "asc" as const } },
  firmas: true,
} satisfies Prisma.IrReporteInclude;

function parseDate(v: unknown): Date | null {
  if (v === null) return null;
  if (!v || typeof v !== "string") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function assertAccesoReporte(
  session: { rol: string; tecnicoId?: string },
  reporte: { tecnicoId: string }
) {
  if (session.rol === "TECNICO" && session.tecnicoId !== reporte.tecnicoId) {
    return false;
  }
  return true;
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
    include: reporteInclude,
  });
  if (!reporte) {
    return NextResponse.json({ error: "Reporte no encontrado" }, { status: 404 });
  }
  if (!(await assertAccesoReporte(auth.session, reporte))) {
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
  const existente = await prisma.irReporte.findUnique({ where: { id } });
  if (!existente) {
    return NextResponse.json({ error: "Reporte no encontrado" }, { status: 404 });
  }
  if (!(await assertAccesoReporte(auth.session, existente))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  if (existente.estado === "FINALIZADO" && !puedeGestionarInfraestructura(auth.session.rol)) {
    return NextResponse.json(
      { error: "El reporte finalizado solo lo edita supervisor/admin" },
      { status: 400 }
    );
  }

  try {
    const body = await request.json();
    const data: Prisma.IrReporteUpdateInput = {};

    if (body.fecha !== undefined) data.fecha = parseDate(body.fecha) || existente.fecha;
    if (body.horaInicio !== undefined) data.horaInicio = parseDate(body.horaInicio);
    if (body.horaFin !== undefined) data.horaFin = parseDate(body.horaFin);
    if (body.estado && IR_ESTADOS.includes(body.estado)) {
      data.estado = body.estado as IrEstadoReporte;
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
    if (typeof body.provincia === "string") data.provincia = enMayusculasGuardar(body.provincia.trim());
    if (typeof body.canton === "string") data.canton = enMayusculasGuardar(body.canton.trim());
    if (typeof body.parroquia === "string") data.parroquia = enMayusculasGuardar(body.parroquia.trim());
    if (typeof body.sector === "string") data.sector = enMayusculasGuardar(body.sector.trim());
    if (typeof body.direccion === "string") data.direccion = enMayusculasGuardar(body.direccion.trim());
    if (typeof body.descripcion === "string") data.descripcion = body.descripcion.trim();
    if (body.observaciones !== undefined) {
      data.observaciones = body.observaciones ? String(body.observaciones).trim() : null;
    }
    if (body.lat !== undefined) data.lat = typeof body.lat === "number" ? body.lat : null;
    if (body.lng !== undefined) data.lng = typeof body.lng === "number" ? body.lng : null;

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

    if (Array.isArray(body.materiales)) {
      await prisma.irMaterial.deleteMany({ where: { reporteId: id } });
      await prisma.irMaterial.createMany({
        data: body.materiales
          .filter((m: { material?: string; cantidad?: number }) => m?.material && m?.cantidad)
          .map((m: { material: string; cantidad: number; unidad?: string }) => ({
            reporteId: id,
            material: enMayusculasGuardar(String(m.material).trim()),
            cantidad: Number(m.cantidad),
            unidad: String(m.unidad || "unidad").trim() || "unidad",
          })),
      });
    }

    const reporte = await prisma.irReporte.update({
      where: { id },
      data,
      include: reporteInclude,
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
