import { NextResponse } from "next/server";
import { requireTecnicoFlota } from "@/lib/parque-automotor/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await requireTecnicoFlota();
  if (!auth.ok) return auth.response;
  const asig = await prisma.asignacionVehiculo.findFirst({
    where: { tecnicoId: auth.tecnicoId, fechaFin: null },
  });
  if (!asig) {
    return NextResponse.json({ items: [] });
  }
  const items = await prisma.mantenimientoVehiculo.findMany({
    where: { vehiculoId: asig.vehiculoId, estadoRegistro: "ACTIVO" },
    orderBy: { fecha: "desc" },
    take: 30,
  });
  return NextResponse.json({ items });
}

export async function POST() {
  return NextResponse.json(
    { error: "El técnico no puede crear ni modificar mantenimiento." },
    { status: 403 }
  );
}
