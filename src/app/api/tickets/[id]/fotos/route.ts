import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFullSession } from "@/lib/auth";
import { getOrCreateOrden } from "@/lib/tickets";
import { saveUpload } from "@/lib/storage";
import type { TipoFoto } from "@prisma/client";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getFullSession();
  if (!session?.tecnicoId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const formData = await request.formData();
  const tipo = formData.get("tipo") as TipoFoto;
  const imageData = formData.get("image") as string;
  const lat = parseFloat(formData.get("lat") as string) || null;
  const lng = parseFloat(formData.get("lng") as string) || null;

  if (!tipo || !imageData) {
    return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
  }

  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket || ticket.tecnicoId !== session.tecnicoId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const orden = await getOrCreateOrden(id);

  const base64 = imageData.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(base64, "base64");
  const filename = `${tipo.toLowerCase()}_${Date.now()}.jpg`;
  const url = await saveUpload(buffer, id, filename);

  const foto = await prisma.fotografia.create({
    data: { ordenId: orden.id, tipo, url, lat, lng },
  });

  return NextResponse.json({ foto });
}
