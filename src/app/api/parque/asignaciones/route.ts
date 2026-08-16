import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOpsVehiculo } from "@/lib/parque-automotor/auth";

export async function GET() {
  const auth = await requireOpsVehiculo();
  if (!auth.ok) return auth.response;
  const items = await prisma.asignacionVehiculo.findMany({
    include: {
      vehiculo: { select: { id: true, placa: true, marca: true, modelo: true, estado: true } },
      tecnico: { include: { usuario: { select: { nombre: true } } } },
      usuario: { select: { nombre: true } },
    },
    orderBy: { fechaInicio: "desc" },
    take: 120,
  });
  return NextResponse.json({
    items: items.map((a) => ({
      ...a,
      tecnicoNombre: a.tecnico.usuario.nombre,
      asignadoPor: a.usuario.nombre,
    })),
  });
}
