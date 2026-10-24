import { NextResponse } from "next/server";
import { getFullSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { obtenerConfigRecordatorio } from "@/lib/recordatorios/config";
import {
  clasificarTarea,
  fechaLimiteTicket,
  minutosDesdeVencimiento,
} from "@/lib/recordatorios/reglas";
import { whereTicketOperativamenteAbierto } from "@/lib/ticket-cerrado";
import { nombresTecnicosTicket } from "@/lib/ticket-tecnicos";

export async function GET(request: Request) {
  const session = await getFullSession();
  if (!session || !["SUPERVISOR", "ADMIN"].includes(session.rol)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const url = new URL(request.url);
  const tecnicoId = url.searchParams.get("tecnicoId") || "";
  const prioridad = url.searchParams.get("prioridad") || "";
  const fase = url.searchParams.get("fase") || "";
  const estado = url.searchParams.get("estado") || "";
  const periodo = url.searchParams.get("periodo") || "";
  const config = await obtenerConfigRecordatorio();
  const now = new Date();
  const estadosOk = ["PENDIENTE", "LEIDO", "EN_PROCESO", "FINALIZADO", "CERRADO", "CANCELADO"];

  const tickets = await prisma.ticket.findMany({
    where: {
      AND: [
        whereTicketOperativamenteAbierto(),
        tecnicoId ? { tecnicos: { some: { tecnicoId } } } : {},
        prioridad && ["ALTA", "MEDIA", "BAJA"].includes(prioridad)
          ? { prioridad: prioridad as "ALTA" | "MEDIA" | "BAJA" }
          : {},
        estado && estadosOk.includes(estado)
          ? { estado: estado as "PENDIENTE" | "LEIDO" | "EN_PROCESO" | "FINALIZADO" | "CERRADO" | "CANCELADO" }
          : {},
      ],
    },
    include: {
      tecnicos: {
        include: { tecnico: { include: { usuario: { select: { nombre: true } } } } },
      },
      tecnico: { include: { usuario: { select: { nombre: true } } } },
      orden: { select: { finalizadoEn: true, iniciadoEn: true, reportadoEn: true } },
    },
    orderBy: [{ prioridad: "asc" }, { updatedAt: "desc" }],
    take: 400,
  });

  const items = tickets
    .map((t) => {
      const due = fechaLimiteTicket(t);
      const clas = clasificarTarea(t, now, config.minutosAnticipacion);
      return {
        id: t.id,
        codigo: t.codigo,
        estado: t.estado,
        prioridad: t.prioridad,
        tecnicos: nombresTecnicosTicket(t),
        tecnicoIds: t.tecnicos.map((x) => x.tecnicoId),
        venceEn: due?.toISOString() ?? null,
        fase: clas,
        minutosVencida: minutosDesdeVencimiento(due, now),
        ultimaActividad: (t.orden?.reportadoEn || t.orden?.iniciadoEn || t.updatedAt).toISOString(),
        necesitaIntervencion: clas === "vencida" || clas === "proxima",
      };
    })
    .filter((t) => {
      if (fase && t.fase !== fase) return false;
      if (!periodo) return true;
      const horas = periodo === "24h" ? 24 : periodo === "7d" ? 24 * 7 : periodo === "30d" ? 24 * 30 : 0;
      if (!horas) return true;
      const since = now.getTime() - horas * 3600_000;
      const due = t.venceEn ? Date.parse(t.venceEn) : NaN;
      const act = Date.parse(t.ultimaActividad);
      return (Number.isFinite(due) && due >= since) || (Number.isFinite(act) && act >= since);
    });

  const historial = await prisma.notificacionTecnico.findMany({
    where: tecnicoId ? { tecnicoId } : undefined,
    orderBy: { createdAt: "desc" },
    take: 80,
    select: {
      id: true,
      tipo: true,
      titulo: true,
      codigoTicket: true,
      createdAt: true,
      tecnico: { select: { usuario: { select: { nombre: true } } } },
      entregas: {
        select: { canal: true, estado: true, enviadoEn: true, ultimoError: true },
        orderBy: { createdAt: "desc" },
        take: 4,
      },
    },
  });

  const tecnicos = await prisma.tecnico.findMany({
    where: { usuario: { activo: true, rol: "TECNICO" } },
    select: { id: true, usuario: { select: { nombre: true } } },
    orderBy: { usuario: { nombre: "asc" } },
  });

  return NextResponse.json({
    config: {
      minutosAnticipacion: config.minutosAnticipacion,
      minutosRepeticion: config.minutosRepeticion,
      maxRepeticiones: config.maxRepeticiones,
    },
    resumen: {
      pendientes: items.filter((i) => i.fase === "pendiente" || i.fase === "sin_limite").length,
      proximas: items.filter((i) => i.fase === "proxima").length,
      vencidas: items.filter((i) => i.fase === "vencida").length,
    },
    items,
    historial: historial.map((h) => ({
      id: h.id,
      tipo: h.tipo,
      titulo: h.titulo,
      codigoTicket: h.codigoTicket,
      tecnico: h.tecnico.usuario.nombre,
      createdAt: h.createdAt.toISOString(),
      entregas: h.entregas,
    })),
    tecnicos: tecnicos.map((t) => ({ id: t.id, nombre: t.usuario.nombre })),
  });
}
