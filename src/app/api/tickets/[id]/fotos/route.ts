import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFullSession } from "@/lib/auth";
import { getOrCreateOrden } from "@/lib/tickets";
import { persistTicketImage } from "@/lib/media-storage";
import { tecnicoAsignadoAlTicket } from "@/lib/ticket-tecnicos";
import { asegurarColaboracionOrden } from "@/lib/ticket-reporte";
import { verificarTicketEditable } from "@/lib/ticket-cerrado";
import type { TipoFoto } from "@prisma/client";

export const maxDuration = 60;
export const runtime = "nodejs";

const MAX_IMAGE_CHARS = 900_000;

type Body = {
  tipo?: string;
  image?: string;
  lat?: number | null;
  lng?: number | null;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getFullSession();
    if (!session?.tecnicoId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;
    let tipo: string | undefined;
    let imageData: string | undefined;
    let lat: number | null = null;
    let lng: number | null = null;

    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const body = (await request.json()) as Body;
      tipo = body.tipo;
      imageData = body.image;
      lat = body.lat ?? null;
      lng = body.lng ?? null;
    } else {
      const formData = await request.formData();
      tipo = formData.get("tipo") as string;
      imageData = formData.get("image") as string;
      lat = parseFloat(formData.get("lat") as string) || null;
      lng = parseFloat(formData.get("lng") as string) || null;
    }

    if (!tipo || !imageData) {
      return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
    }

    if (imageData.length > MAX_IMAGE_CHARS) {
      return NextResponse.json(
        { error: "Imagen muy grande. Acérquese más o use menos zoom." },
        { status: 413 }
      );
    }

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: { tecnicos: { select: { tecnicoId: true } } },
    });
    if (!ticket || !tecnicoAsignadoAlTicket(ticket, session.tecnicoId)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const editable = await verificarTicketEditable(id);
    if (!editable.ok) {
      return NextResponse.json({ error: editable.error }, { status: editable.status });
    }

    const permiso = await asegurarColaboracionOrden(id, session.tecnicoId);
    if (!permiso.ok) {
      return NextResponse.json(
        { error: permiso.error, reportadoPor: permiso.reportadoPorNombre },
        { status: permiso.status }
      );
    }

    const orden = await getOrCreateOrden(id);

    const base64 = imageData.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64, "base64");
    const filename = `${tipo.toLowerCase()}_${Date.now()}.jpg`;
    const url = await persistTicketImage(id, filename, buffer);

    const normalizedData = imageData.startsWith("data:")
      ? imageData
      : `data:image/jpeg;base64,${base64}`;

    const foto = await prisma.fotografia.create({
      data: {
        ordenId: orden.id,
        tipo: tipo as TipoFoto,
        url,
        imagenData: normalizedData,
        lat,
        lng,
      },
    });

    return NextResponse.json({ foto });
  } catch (err) {
    console.error("[POST fotos]", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "No se pudo guardar la foto. Intente de nuevo.",
      },
      { status: 500 }
    );
  }
}
