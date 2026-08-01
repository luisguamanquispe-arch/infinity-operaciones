import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireInfraSession } from "@/lib/infraestructura-red/auth";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ reporteId: string; filename: string }> }
) {
  const auth = await requireInfraSession();
  if (!auth.ok) return auth.response;

  const { reporteId, filename } = await params;
  if (!filename || filename.includes("..") || filename.includes("/")) {
    return NextResponse.json({ error: "Archivo inválido" }, { status: 400 });
  }

  const reporte = await prisma.irReporte.findUnique({
    where: { id: reporteId },
    select: { tecnicoId: true },
  });
  if (!reporte) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }
  if (auth.session.rol === "TECNICO" && auth.session.tecnicoId !== reporte.tecnicoId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const apiPath = `/api/infraestructura/media/${reporteId}/${filename}`;

  const foto = await prisma.irFoto.findFirst({
    where: { reporteId, OR: [{ url: apiPath }, { url: { endsWith: `/${filename}` } }] },
    select: { imagenData: true },
  });
  if (foto?.imagenData?.startsWith("data:")) {
    const match = foto.imagenData.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      return new NextResponse(Buffer.from(match[2], "base64"), {
        headers: { "Content-Type": match[1], "Cache-Control": "private, max-age=3600" },
      });
    }
  }

  const firma = await prisma.irFirma.findFirst({
    where: { reporteId, OR: [{ imagenUrl: apiPath }, { imagenUrl: { endsWith: `/${filename}` } }] },
    select: { imagenData: true },
  });
  if (firma?.imagenData?.startsWith("data:")) {
    const match = firma.imagenData.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      return new NextResponse(Buffer.from(match[2], "base64"), {
        headers: { "Content-Type": match[1], "Cache-Control": "private, max-age=3600" },
      });
    }
  }

  return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });
}
