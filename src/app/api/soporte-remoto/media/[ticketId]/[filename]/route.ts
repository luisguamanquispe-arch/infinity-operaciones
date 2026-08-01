import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSrSession } from "@/lib/soporte-remoto/auth";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ ticketId: string; filename: string }> }
) {
  const auth = await requireSrSession();
  if (!auth.ok) return auth.response;

  const { ticketId, filename } = await params;
  if (!filename || filename.includes("..") || filename.includes("/")) {
    return NextResponse.json({ error: "Archivo inválido" }, { status: 400 });
  }

  const apiPath = `/api/soporte-remoto/media/${ticketId}/${filename}`;
  const adjunto = await prisma.srAdjunto.findFirst({
    where: {
      ticketId,
      OR: [{ url: apiPath }, { url: { endsWith: `/${filename}` } }],
    },
    select: { dataBase64: true, mimeType: true },
  });

  if (!adjunto?.dataBase64?.startsWith("data:")) {
    return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });
  }

  const match = adjunto.dataBase64.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    return NextResponse.json({ error: "Archivo corrupto" }, { status: 500 });
  }

  return new NextResponse(Buffer.from(match[2], "base64"), {
    headers: {
      "Content-Type": match[1] || adjunto.mimeType,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
