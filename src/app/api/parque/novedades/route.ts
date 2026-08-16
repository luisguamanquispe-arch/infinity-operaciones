import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOpsVehiculo } from "@/lib/parque-automotor/auth";

export async function GET(request: Request) {
  const auth = await requireOpsVehiculo();
  if (!auth.ok) return auth.response;
  const { searchParams } = new URL(request.url);
  const estado = searchParams.get("estado");
  const items = await prisma.novedadVehiculo.findMany({
    where: estado ? { estado: estado as never } : undefined,
    include: {
      vehiculo: { select: { id: true, placa: true, marca: true, modelo: true } },
      tecnico: { include: { usuario: { select: { nombre: true } } } },
    },
    orderBy: { fecha: "desc" },
    take: 100,
  });
  return NextResponse.json({
    items: items.map((n) => ({
      ...n,
      tecnicoNombre: n.tecnico.usuario.nombre,
    })),
  });
}
