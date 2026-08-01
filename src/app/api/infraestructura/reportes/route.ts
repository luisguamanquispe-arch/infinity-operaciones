import { NextResponse } from "next/server";
import type { IrEstadoReporte, IrTipoTrabajo, Prioridad, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { enMayusculasGuardar } from "@/lib/mayusculas";
import { requireInfraSession } from "@/lib/infraestructura-red/auth";
import { generarCodigoIrReporte } from "@/lib/infraestructura-red/codigo";
import { IR_ESTADOS, IR_TIPOS_TRABAJO } from "@/lib/infraestructura-red/labels";

const reporteInclude = {
  tecnico: { include: { usuario: { select: { id: true, nombre: true, email: true } } } },
  supervisor: { select: { id: true, nombre: true, email: true } },
  materiales: true,
  fotografias: { orderBy: { tomadaEn: "asc" as const } },
  firmas: true,
} satisfies Prisma.IrReporteInclude;

function parseDate(v: unknown): Date | null {
  if (!v || typeof v !== "string") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function GET(request: Request) {
  const auth = await requireInfraSession();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const estado = searchParams.get("estado") as IrEstadoReporte | null;
  const tecnicoId = searchParams.get("tecnicoId")?.trim();
  const sector = searchParams.get("sector")?.trim();
  const desde = parseDate(searchParams.get("desde"));
  const hasta = parseDate(searchParams.get("hasta"));
  const take = Math.min(100, Math.max(1, parseInt(searchParams.get("take") || "50", 10)));

  const where: Prisma.IrReporteWhereInput = {
    ...(estado && IR_ESTADOS.includes(estado) ? { estado } : {}),
    ...(tecnicoId ? { tecnicoId } : {}),
    ...(sector ? { sector: { contains: sector, mode: "insensitive" } } : {}),
    ...(desde || hasta
      ? {
          fecha: {
            ...(desde ? { gte: desde } : {}),
            ...(hasta ? { lte: hasta } : {}),
          },
        }
      : {}),
    ...(q
      ? {
          OR: [
            { codigo: { contains: q, mode: "insensitive" } },
            { sector: { contains: q, mode: "insensitive" } },
            { direccion: { contains: q, mode: "insensitive" } },
            { tecnico: { usuario: { nombre: { contains: q, mode: "insensitive" } } } },
          ],
        }
      : {}),
  };

  // Técnico solo ve sus reportes
  if (auth.session.rol === "TECNICO" && auth.session.tecnicoId) {
    where.tecnicoId = auth.session.tecnicoId;
  }

  const reportes = await prisma.irReporte.findMany({
    where,
    orderBy: { fecha: "desc" },
    take,
    include: {
      tecnico: { include: { usuario: { select: { nombre: true } } } },
      supervisor: { select: { nombre: true } },
      _count: { select: { materiales: true, fotografias: true, firmas: true } },
    },
  });

  return NextResponse.json({ reportes });
}

export async function POST(request: Request) {
  const auth = await requireInfraSession();
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const tipoTrabajo = body.tipoTrabajo as IrTipoTrabajo;
    if (!tipoTrabajo || !IR_TIPOS_TRABAJO.includes(tipoTrabajo)) {
      return NextResponse.json({ error: "Tipo de trabajo inválido" }, { status: 400 });
    }

    let tecnicoId = typeof body.tecnicoId === "string" ? body.tecnicoId : "";
    if (auth.session.rol === "TECNICO") {
      if (!auth.session.tecnicoId) {
        return NextResponse.json({ error: "Perfil técnico no vinculado" }, { status: 400 });
      }
      tecnicoId = auth.session.tecnicoId;
    }
    if (!tecnicoId) {
      return NextResponse.json({ error: "Seleccione el técnico responsable" }, { status: 400 });
    }

    const tecnico = await prisma.tecnico.findUnique({ where: { id: tecnicoId } });
    if (!tecnico) {
      return NextResponse.json({ error: "Técnico no encontrado" }, { status: 404 });
    }

    const provincia = enMayusculasGuardar(String(body.provincia || "").trim());
    const canton = enMayusculasGuardar(String(body.canton || "").trim());
    const parroquia = enMayusculasGuardar(String(body.parroquia || "").trim());
    const sector = enMayusculasGuardar(String(body.sector || "").trim());
    const direccion = enMayusculasGuardar(String(body.direccion || "").trim());
    const descripcion = String(body.descripcion || "").trim();

    if (!provincia || !canton || !parroquia || !sector || !direccion || descripcion.length < 10) {
      return NextResponse.json(
        {
          error:
            "Complete provincia, cantón, parroquia, sector, dirección y descripción (mín. 10 caracteres)",
        },
        { status: 400 }
      );
    }

    const prioridad = (["ALTA", "MEDIA", "BAJA"].includes(body.prioridad)
      ? body.prioridad
      : "MEDIA") as Prioridad;

    const estado = (IR_ESTADOS.includes(body.estado) ? body.estado : "PENDIENTE") as IrEstadoReporte;

    const codigo = await generarCodigoIrReporte();
    const materiales = Array.isArray(body.materiales) ? body.materiales : [];

    const reporte = await prisma.irReporte.create({
      data: {
        codigo,
        fecha: parseDate(body.fecha) || new Date(),
        horaInicio: parseDate(body.horaInicio),
        horaFin: parseDate(body.horaFin),
        tecnicoId,
        supervisorUsuarioId:
          typeof body.supervisorUsuarioId === "string" && body.supervisorUsuarioId
            ? body.supervisorUsuarioId
            : null,
        estado,
        prioridad,
        tipoTrabajo,
        tipoTrabajoOtro:
          tipoTrabajo === "OTRO"
            ? enMayusculasGuardar(String(body.tipoTrabajoOtro || "").trim()) || null
            : null,
        provincia,
        canton,
        parroquia,
        sector,
        direccion,
        lat: typeof body.lat === "number" ? body.lat : null,
        lng: typeof body.lng === "number" ? body.lng : null,
        descripcion,
        observaciones: body.observaciones
          ? String(body.observaciones).trim() || null
          : null,
        creadoPorId: auth.session.id,
        materiales: {
          create: materiales
            .filter((m: { material?: string; cantidad?: number }) => m?.material && m?.cantidad)
            .map((m: { material: string; cantidad: number; unidad?: string }) => ({
              material: enMayusculasGuardar(String(m.material).trim()),
              cantidad: Number(m.cantidad),
              unidad: String(m.unidad || "unidad").trim() || "unidad",
            })),
        },
      },
      include: reporteInclude,
    });

    return NextResponse.json({ reporte }, { status: 201 });
  } catch (err) {
    console.error("[infraestructura/reportes POST]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al crear reporte" },
      { status: 500 }
    );
  }
}
