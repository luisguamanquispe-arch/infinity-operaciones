import { NextResponse } from "next/server";
import type { IrTipoFoto } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireInfraSession } from "@/lib/infraestructura-red/auth";
import { IR_TIPOS_FOTO } from "@/lib/infraestructura-red/labels";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireInfraSession();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const reporte = await prisma.irReporte.findUnique({ where: { id } });
  if (!reporte) {
    return NextResponse.json({ error: "Reporte no encontrado" }, { status: 404 });
  }
  if (auth.session.rol === "TECNICO" && auth.session.tecnicoId !== reporte.tecnicoId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const tipo = body.tipo as IrTipoFoto;
    if (!tipo || !IR_TIPOS_FOTO.includes(tipo)) {
      return NextResponse.json({ error: "Tipo de foto inválido (ANTES/DURANTE/DESPUES)" }, { status: 400 });
    }
    const imagen = typeof body.imagen === "string" ? body.imagen : "";
    if (!imagen.startsWith("data:image")) {
      return NextResponse.json({ error: "Imagen inválida" }, { status: 400 });
    }

    const filename = `ir_${tipo.toLowerCase()}_${Date.now()}.jpg`;
    const url = `/api/infraestructura/media/${id}/${filename}`;

    const foto = await prisma.irFoto.create({
      data: {
        reporteId: id,
        tipo,
        url,
        imagenData: imagen,
      },
    });

    return NextResponse.json({ foto }, { status: 201 });
  } catch (err) {
    console.error("[infraestructura fotos]", err);
    return NextResponse.json({ error: "Error al guardar fotografía" }, { status: 500 });
  }
}
