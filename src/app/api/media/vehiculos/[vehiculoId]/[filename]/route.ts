import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFullSession } from "@/lib/auth";
import { puedeGestionarParque } from "@/lib/parque-automotor/reglas";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ vehiculoId: string; filename: string }> }
) {
  const session = await getFullSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { vehiculoId, filename } = await params;
  if (!filename || filename.includes("..") || filename.includes("/")) {
    return NextResponse.json({ error: "Archivo inválido" }, { status: 400 });
  }

  if (session.rol === "TECNICO") {
    const asig = await prisma.asignacionVehiculo.findFirst({
      where: { vehiculoId, tecnicoId: session.tecnicoId ?? "", fechaFin: null },
      select: { id: true },
    });
    if (!asig) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
  } else if (!puedeGestionarParque(session.rol)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const foto = await prisma.fotoVehiculo.findFirst({
    where: { vehiculoId, url: { endsWith: `/${filename}` } },
    select: { imagenData: true },
  });
  const data =
    foto?.imagenData ||
    (
      await prisma.cargaCombustible.findFirst({
        where: { vehiculoId, comprobanteData: { not: null } },
        select: { comprobanteData: true },
        orderBy: { fecha: "desc" },
      })
    )?.comprobanteData;

  if (!data) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }
  const match = data.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }
  return new NextResponse(Buffer.from(match[2], "base64"), {
    headers: {
      "Content-Type": match[1],
      "Cache-Control": "private, max-age=86400",
    },
  });
}
