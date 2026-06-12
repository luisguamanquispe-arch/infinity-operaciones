import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFullSession } from "@/lib/auth";

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
    include: {
      orden: {
        include: {
          fotografias: true,
          firma: true,
        },
      },
    },
  });

  if (!ticket) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const allowed =
    session.rol === "ADMIN" ||
    session.rol === "SUPERVISOR" ||
    (session.rol === "TECNICO" && ticket.tecnicoId === session.tecnicoId);

  if (!allowed) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const uploadPath = `/uploads/${ticketId}/${filename}`;
  const apiPath = `/api/media/${ticketId}/${filename}`;
  const foto = ticket.orden?.fotografias.find(
    (f) =>
      f.url === uploadPath ||
      f.url === apiPath ||
      f.url.endsWith(`/${filename}`)
  );

  const firmaMatch =
    ticket.orden?.firma &&
    (ticket.orden.firma.imagenUrl === uploadPath ||
      ticket.orden.firma.imagenUrl === apiPath ||
      ticket.orden.firma.imagenUrl.endsWith(`/${filename}`));

  const imagenData = foto?.imagenData || (firmaMatch ? ticket.orden!.firma!.imagenData : null);

  if (imagenData) {
    const match = imagenData.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      const buffer = Buffer.from(match[2], "base64");
      return new NextResponse(buffer, {
        headers: {
          "Content-Type": match[1],
          "Cache-Control": "private, max-age=3600",
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
