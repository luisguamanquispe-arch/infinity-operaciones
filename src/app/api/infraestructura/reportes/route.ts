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
import { generarCodigoIrReporte } from "@/lib/infraestructura-red/codigo";
import { registrarIrHistorial } from "@/lib/infraestructura-red/historial";
import { irReporteInclude } from "@/lib/infraestructura-red/include";
import {
  IR_EQUIPOS,
  IR_ESTADOS,
  IR_RESULTADOS,
  IR_TIPOS_TRABAJO,
} from "@/lib/infraestructura-red/labels";
import { calcularTiempoMinutos } from "@/lib/infraestructura-red/tiempo";

function parseDate(v: unknown): Date | null {
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

export async function GET(request: Request) {
  const auth = await requireInfraSession();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const estado = searchParams.get("estado") as IrEstadoReporte | null;
  const tipoTrabajo = searchParams.get("tipoTrabajo") as IrTipoTrabajo | null;
  const tecnicoId = searchParams.get("tecnicoId")?.trim();
  const sector = searchParams.get("sector")?.trim();
  const desde = parseDate(searchParams.get("desde"));
  const hasta = parseDate(searchParams.get("hasta"));
  const take = Math.min(100, Math.max(1, parseInt(searchParams.get("take") || "50", 10)));

  const where: Prisma.IrReporteWhereInput = {
    ...(estado && IR_ESTADOS.includes(estado) ? { estado } : {}),
    ...(tipoTrabajo && IR_TIPOS_TRABAJO.includes(tipoTrabajo) ? { tipoTrabajo } : {}),
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

  if (auth.session.rol === "TECNICO" && auth.session.tecnicoId) {
    const accesoTecnico: Prisma.IrReporteWhereInput = {
      OR: [
        { tecnicoId: auth.session.tecnicoId },
        { participantes: { some: { tecnicoId: auth.session.tecnicoId } } },
      ],
    };
    where.AND = [...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []), accesoTecnico];
  }

  const reportes = await prisma.irReporte.findMany({
    where,
    orderBy: { fecha: "desc" },
    take,
    include: {
      tecnico: { include: { usuario: { select: { nombre: true } } } },
      supervisor: { select: { nombre: true } },
      _count: {
        select: { materiales: true, fotografias: true, firmas: true, clientesAfectados: true },
      },
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
            "Complete provincia, cantón, parroquia, sector, dirección y descripción del problema (mín. 10 caracteres)",
        },
        { status: 400 }
      );
    }

    const prioridad = (["ALTA", "MEDIA", "BAJA"].includes(body.prioridad)
      ? body.prioridad
      : "MEDIA") as Prioridad;

    const estado = (IR_ESTADOS.includes(body.estado) ? body.estado : "PENDIENTE") as IrEstadoReporte;
    const resultado =
      body.resultado && IR_RESULTADOS.includes(body.resultado)
        ? (body.resultado as IrResultado)
        : null;

    const horaInicio = parseDate(body.horaInicio);
    const horaFin = parseDate(body.horaFin);
    const tiempoMinutos = calcularTiempoMinutos(horaInicio, horaFin);

    const materiales = Array.isArray(body.materiales) ? body.materiales : [];
    const equipos = Array.isArray(body.equipos) ? body.equipos : [];
    const participantesIds = Array.isArray(body.participantesIds)
      ? (body.participantesIds as string[]).filter((id) => id && id !== tecnicoId)
      : [];
    const clientesIds = Array.isArray(body.clientesAfectadosIds)
      ? (body.clientesAfectadosIds as string[]).filter(Boolean)
      : [];

    const codigo = await generarCodigoIrReporte();
    const optStr = (v: unknown) => {
      const s = enMayusculasGuardar(String(v || "").trim());
      return s || null;
    };

    const reporte = await prisma.$transaction(async (tx) => {
      const created = await tx.irReporte.create({
        data: {
          codigo,
          fecha: parseDate(body.fecha) || new Date(),
          horaInicio,
          horaFin,
          tiempoMinutos,
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
          lat: parseOptFloat(body.lat),
          lng: parseOptFloat(body.lng),
          nodo: optStr(body.nodo),
          nap: optStr(body.nap),
          cto: optStr(body.cto),
          odf: optStr(body.odf),
          splitter: optStr(body.splitter),
          manga: optStr(body.manga),
          cajaPaso: optStr(body.cajaPaso),
          tramoFibra: optStr(body.tramoFibra),
          cantidadHilos: parseOptInt(body.cantidadHilos),
          longitudAfectadaM: parseOptFloat(body.longitudAfectadaM),
          kmRedIntervenida: parseOptFloat(body.kmRedIntervenida),
          clientesAfectadosN: clientesIds.length || parseOptInt(body.clientesAfectadosN) || 0,
          descripcion,
          trabajosRealizados: body.trabajosRealizados
            ? String(body.trabajosRealizados).trim() || null
            : null,
          resultado,
          observaciones: body.observaciones
            ? String(body.observaciones).trim() || null
            : null,
          creadoPorId: auth.session.id,
          materiales: {
            create: materiales
              .filter((m: { material?: string; cantidad?: number }) => m?.material && m?.cantidad)
              .map(
                (m: {
                  material: string;
                  cantidad: number;
                  unidad?: string;
                  inventarioId?: string;
                }) => ({
                  material: enMayusculasGuardar(String(m.material).trim()),
                  cantidad: Number(m.cantidad),
                  unidad: String(m.unidad || "unidad").trim() || "unidad",
                  inventarioId: m.inventarioId || null,
                })
              ),
          },
          equipos: {
            create: equipos
              .filter((e: { tipo?: string }) => e?.tipo && IR_EQUIPOS.includes(e.tipo as IrEquipoTipo))
              .map((e: { tipo: IrEquipoTipo; detalle?: string }) => ({
                tipo: e.tipo,
                detalle: e.detalle ? String(e.detalle).trim() || null : null,
              })),
          },
          participantes: {
            create: participantesIds.map((id) => ({ tecnicoId: id })),
          },
          clientesAfectados: {
            create: clientesIds.map((clienteId) => ({ clienteId })),
          },
        },
        include: irReporteInclude,
      });

      await registrarIrHistorial(tx, {
        reporteId: created.id,
        usuarioId: auth.session.id,
        usuarioNombre: auth.session.nombre,
        estado: created.estado,
        nota: "Reporte creado",
      });

      if (clientesIds.length) {
        await tx.historialCliente.createMany({
          data: clientesIds.map((clienteId) => ({
            clienteId,
            usuarioId: auth.session.id,
            accion: "INFRAESTRUCTURA_RED",
            cambiosJson: JSON.stringify({
              reporteId: created.id,
              codigo: created.codigo,
              tipoTrabajo: created.tipoTrabajo,
              sector: created.sector,
              estado: created.estado,
            }),
          })),
        });
      }

      return created;
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
