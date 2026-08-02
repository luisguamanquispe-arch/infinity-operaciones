import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFullSession } from "@/lib/auth";
import { ESTADO_REVISION_LABELS } from "@/lib/revision-reporte";

/** Técnico: listado de reportes devueltos para corregir. */
export async function GET() {
  const session = await getFullSession();
  if (!session?.tecnicoId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const tickets = await prisma.ticket.findMany({
    where: {
      estadoRevision: "DEVUELTO_CORRECCION",
      OR: [
        { tecnicoId: session.tecnicoId },
        { tecnicos: { some: { tecnicoId: session.tecnicoId } } },
      ],
    },
    include: {
      cliente: { select: { nombre: true, sector: true } },
      revisionesHistorial: {
        where: { accion: "DEVUELTO_CORRECCION" },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  return NextResponse.json({
    items: tickets.map((t) => {
      const ult = t.revisionesHistorial[0];
      return {
        id: t.id,
        codigo: t.codigo,
        tipo: t.tipo,
        fecha: t.updatedAt.toISOString(),
        clienteOSector:
          t.tipo === "INFRAESTRUCTURA"
            ? t.sectorInfra || t.nodoAfectado || t.zonaInfra || "—"
            : t.cliente.nombre,
        sector: t.cliente.sector,
        motivo: ult?.motivo || "Sin motivo registrado",
        observaciones: ult?.observaciones || null,
        supervisor: ult?.usuarioNombre || "—",
        fechaDevolucion: ult?.createdAt.toISOString() || t.updatedAt.toISOString(),
        estadoRevision: t.estadoRevision,
        estadoRevisionLabel: t.estadoRevision
          ? ESTADO_REVISION_LABELS[t.estadoRevision]
          : null,
      };
    }),
  });
}
