import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { getFullSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ ticketId: string; filename: string }> }
) {
  const session = await getFullSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { ticketId, filename } = await params;

  if (!filename || filename.includes("..") || filename.includes("/")) {
    return NextResponse.json({ error: "Archivo inválido" }, { status: 400 });
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: {
      id: true,
      tecnicoId: true,
      tecnicos: { select: { tecnicoId: true } },
    },
  });

  if (!ticket) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const allowed =
    session.rol === "ADMIN" ||
    session.rol === "SUPERVISOR" ||
    (session.rol === "TECNICO" &&
      (ticket.tecnicoId === session.tecnicoId ||
        ticket.tecnicos.some((t) => t.tecnicoId === session.tecnicoId)));

  if (!allowed) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const apiPath = `/api/media/${ticketId}/${filename}`;
  const uploadPath = `/uploads/${ticketId}/${filename}`;

  const foto = await prisma.fotografia.findFirst({
    where: {
      orden: { ticketId },
      OR: [{ url: apiPath }, { url: uploadPath }, { url: { endsWith: `/${filename}` } }],
    },
    select: { imagenData: true },
  });

  if (foto?.imagenData) {
    const match = foto.imagenData.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      const buffer = Buffer.from(match[2], "base64");
      return new NextResponse(buffer, {
        headers: {
          "Content-Type": match[1],
          "Cache-Control": "private, max-age=86400",
        },
      });
    }
  }

  const firma = await prisma.firma.findFirst({
    where: {
      orden: { ticketId },
      OR: [{ imagenUrl: apiPath }, { imagenUrl: uploadPath }, { imagenUrl: { endsWith: `/${filename}` } }],
    },
    select: { imagenData: true },
  });

  if (firma?.imagenData) {
    const match = firma.imagenData.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      const buffer = Buffer.from(match[2], "base64");
      return new NextResponse(buffer, {
        headers: {
          "Content-Type": match[1],
          "Cache-Control": "private, max-age=86400",
        },
      });
    }
  }

  try {
    const filePath = path.join(process.cwd(), "public", "uploads", ticketId, filename);
    const buffer = await readFile(filePath);
    const ext = path.extname(filename).toLowerCase();
    const contentType = ext === ".png" ? "image/png" : "image/jpeg";
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Imagen no encontrada" }, { status: 404 });
  }
}
