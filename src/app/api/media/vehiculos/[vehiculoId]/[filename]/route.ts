import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFullSession } from "@/lib/auth";
import { puedeGestionarParque } from "@/lib/parque-automotor/reglas";
import { leerImagenParque } from "@/lib/parque-automotor/media";

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

  const found = await leerImagenParque(vehiculoId, filename);
  if (!found) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }
  if ("redirect" in found) {
    return NextResponse.redirect(found.redirect);
  }
  const match = found.dataUrl.match(/^data:([^;]+);base64,(.+)$/);
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
