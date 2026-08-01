import { NextResponse } from "next/server";
import type { SrTipoAdjunto } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSrSession } from "@/lib/soporte-remoto/auth";
import { SR_TIPOS_ADJUNTO } from "@/lib/soporte-remoto/labels";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSrSession();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const ticket = await prisma.srTicket.findUnique({ where: { id } });
  if (!ticket) {
    return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const dataUrl = typeof body.data === "string" ? body.data : "";
    if (!dataUrl.startsWith("data:")) {
      return NextResponse.json({ error: "Archivo inválido" }, { status: 400 });
    }

    const mimeMatch = dataUrl.match(/^data:([^;]+);base64,/);
    const mimeType = mimeMatch?.[1] || "application/octet-stream";
    let tipo = body.tipo as SrTipoAdjunto;
    if (!tipo || !SR_TIPOS_ADJUNTO.includes(tipo)) {
      if (mimeType === "application/pdf") tipo = "PDF";
      else if (mimeType.startsWith("image/")) tipo = "CAPTURA";
      else tipo = "OTRO";
    }

    const nombreArchivo =
      String(body.nombreArchivo || "").trim() ||
      `adjunto_${Date.now()}.${mimeType.includes("pdf") ? "pdf" : "bin"}`;

    // Límite ~4 MB en base64
    if (dataUrl.length > 5_500_000) {
      return NextResponse.json({ error: "Archivo demasiado grande (máx. ~4 MB)" }, { status: 400 });
    }

    const filename = `sr_${tipo.toLowerCase()}_${Date.now()}_${nombreArchivo.replace(/[^\w.-]/g, "_")}`;
    const url = `/api/soporte-remoto/media/${id}/${filename}`;

    const adjunto = await prisma.srAdjunto.create({
      data: {
        ticketId: id,
        tipo,
        nombreArchivo,
        mimeType,
        url,
        dataBase64: dataUrl,
      },
    });

    await prisma.srHistorial.create({
      data: {
        ticketId: id,
        usuarioId: auth.session.id,
        usuarioNombre: auth.session.nombre,
        tiempoMinutos: ticket.tiempoMinutos,
        estado: ticket.estado,
        nota: `Adjunto: ${nombreArchivo}`,
      },
    });

    return NextResponse.json({ adjunto }, { status: 201 });
  } catch (err) {
    console.error("[soporte-remoto adjuntos]", err);
    return NextResponse.json({ error: "Error al guardar adjunto" }, { status: 500 });
  }
}
