import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFullSession } from "@/lib/auth";

export async function GET(request: Request) {
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

  const where: Record<string, unknown> = {
    estado: { in: ["CERRADO", "FINALIZADO"] },
  };

  if (desde || hasta) {
    where.updatedAt = {};
    if (desde) (where.updatedAt as Record<string, Date>).gte = new Date(desde);
    if (hasta) {
      const h = new Date(hasta);
      h.setHours(23, 59, 59, 999);
      (where.updatedAt as Record<string, Date>).lte = h;
    }
  }

  if (tecnicoId) where.tecnicoId = tecnicoId;
  if (tipo) where.tipo = tipo;
  if (sector) where.cliente = { sector: { contains: sector } };
  if (q) {
    where.OR = [
      { codigo: { contains: q } },
      { cliente: { nombre: { contains: q } } },
      { cliente: { cedula: { contains: q } } },
    ];
  }

  const tickets = await prisma.ticket.findMany({
    where,
    include: {
      cliente: true,
      tecnico: { include: { usuario: true } },
      orden: {
        include: {
          cronometro: true,
          fotografias: true,
          medicion: true,
          firma: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  const resumen = {
    total: tickets.length,
    conFotos: tickets.filter((t) => (t.orden?.fotografias.length ?? 0) > 0).length,
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
    tecnico: t.tecnico?.usuario.nombre || "Sin asignar",
    duracionMin: t.orden?.cronometro?.duracionSegundos
      ? Math.round(t.orden.cronometro.duracionSegundos / 60)
      : null,
    totalFotos: t.orden?.fotografias.length ?? 0,
    tieneFirma: !!t.orden?.firma,
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
}
