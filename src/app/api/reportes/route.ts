import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFullSession } from "@/lib/auth";
import { firmaImagenSrcRapida } from "@/lib/firma-image";
import { nombresTecnicosTicket } from "@/lib/ticket-tecnicos";
import { mensajeErrorPrisma } from "@/lib/prisma-errors";

export async function GET(request: Request) {
  try {
  const session = await getFullSession();
  if (!session || !["SUPERVISOR", "ADMIN"].includes(session.rol)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");
  const tecnicoId = searchParams.get("tecnicoId");
  const tipo = searchParams.get("tipo");
  const sector = searchParams.get("sector");
  const q = searchParams.get("q")?.trim();

  const and: Record<string, unknown>[] = [{ estado: { in: ["CERRADO", "FINALIZADO"] } }];

  if (desde || hasta) {
    const updatedAt: Record<string, Date> = {};
    if (desde) updatedAt.gte = new Date(desde);
    if (hasta) {
      const h = new Date(hasta);
      h.setHours(23, 59, 59, 999);
      updatedAt.lte = h;
    }
    and.push({ updatedAt });
  }

  if (tecnicoId) {
    and.push({
      OR: [{ tecnicoId }, { tecnicos: { some: { tecnicoId } } }],
    });
  }
  if (tipo) and.push({ tipo });
  if (sector) and.push({ cliente: { sector: { contains: sector, mode: "insensitive" } } });
  if (q) {
    and.push({
      OR: [
        { codigo: { contains: q, mode: "insensitive" } },
        { cliente: { nombre: { contains: q, mode: "insensitive" } } },
        { cliente: { cedula: { contains: q } } },
      ],
    });
  }

  const where = { AND: and };

  const tickets = await prisma.ticket.findMany({
    where,
    include: {
      cliente: {
        select: { nombre: true, cedula: true, sector: true },
      },
      tecnico: { include: { usuario: { select: { nombre: true } } } },
      tecnicos: {
        include: { tecnico: { include: { usuario: { select: { nombre: true } } } } },
      },
      orden: {
        select: {
          finalizadoEn: true,
          cronometro: { select: { duracionSegundos: true } },
          medicion: { select: { id: true } },
          firma: { select: { imagenUrl: true } },
          _count: { select: { fotografias: true } },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  const resumen = {
    total: tickets.length,
    conFotos: tickets.filter((t) => (t.orden?._count.fotografias ?? 0) > 0).length,
    conFirma: tickets.filter((t) => t.orden?.firma).length,
    conMedicion: tickets.filter((t) => t.orden?.medicion).length,
    tiempoPromedioMin:
      tickets.length > 0
        ? Math.round(
            tickets
              .filter((t) => t.orden?.cronometro?.duracionSegundos)
              .reduce((acc, t) => acc + (t.orden!.cronometro!.duracionSegundos || 0), 0) /
              Math.max(
                1,
                tickets.filter((t) => t.orden?.cronometro?.duracionSegundos).length
              ) /
              60
          )
        : 0,
  };

  const items = tickets.map((t) => ({
    id: t.id,
    codigo: t.codigo,
    tipo: t.tipo,
    prioridad: t.prioridad,
    estado: t.estado,
    motivo: t.motivo,
    createdAt: t.createdAt,
    cerradoEn: t.orden?.finalizadoEn || t.updatedAt,
    cliente: {
      nombre: t.cliente.nombre,
      cedula: t.cliente.cedula,
      sector: t.cliente.sector,
    },
    tecnico: nombresTecnicosTicket(t),
    duracionMin: t.orden?.cronometro?.duracionSegundos
      ? Math.round(t.orden.cronometro.duracionSegundos / 60)
      : null,
    totalFotos: t.orden?._count.fotografias ?? 0,
    tieneFirma: !!t.orden?.firma,
    firmaSrc: firmaImagenSrcRapida(t.orden?.firma ?? null),
    tieneMedicion: !!t.orden?.medicion,
  }));

  const tecnicos = await prisma.tecnico.findMany({
    include: { usuario: true },
    orderBy: { usuario: { nombre: "asc" } },
  });

  const sectores = await prisma.cliente.findMany({
    select: { sector: true },
    distinct: ["sector"],
    orderBy: { sector: "asc" },
  });

  return NextResponse.json({
    resumen,
    items,
    filtros: {
      tecnicos: tecnicos.map((t) => ({ id: t.id, nombre: t.usuario.nombre })),
      sectores: sectores.map((s) => s.sector),
    },
  });
  } catch (err) {
    console.error("[GET reportes]", err);
    return NextResponse.json(
      {
        error: mensajeErrorPrisma(err),
        resumen: { total: 0, conFotos: 0, conFirma: 0, conMedicion: 0, tiempoPromedioMin: 0 },
        items: [],
        filtros: { tecnicos: [], sectores: [] },
      },
      { status: 500 }
    );
  }
}
