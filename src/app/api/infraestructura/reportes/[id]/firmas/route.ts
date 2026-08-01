import { NextResponse } from "next/server";
import type { IrTipoFirma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { enMayusculasGuardar } from "@/lib/mayusculas";
import { requireInfraSession } from "@/lib/infraestructura-red/auth";
import { puedeGestionarInfraestructura } from "@/lib/infraestructura-red/labels";

export async function PUT(
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
    const tipo = body.tipo as IrTipoFirma;
    if (tipo !== "TECNICO" && tipo !== "SUPERVISOR") {
      return NextResponse.json({ error: "Tipo de firma inválido" }, { status: 400 });
    }
    if (tipo === "SUPERVISOR" && !puedeGestionarInfraestructura(auth.session.rol)) {
      return NextResponse.json(
        { error: "Solo supervisor/admin puede firmar como supervisor" },
        { status: 403 }
      );
    }

    const imagen = typeof body.imagen === "string" ? body.imagen : "";
    if (!imagen.startsWith("data:image")) {
      return NextResponse.json({ error: "Firma inválida" }, { status: 400 });
    }
    const nombre = enMayusculasGuardar(
      String(body.nombre || auth.session.nombre || "FIRMANTE").trim()
    );
    const filename = `ir_firma_${tipo.toLowerCase()}_${Date.now()}.png`;
    const imagenUrl = `/api/infraestructura/media/${id}/${filename}`;

    const firma = await prisma.irFirma.upsert({
      where: { reporteId_tipo: { reporteId: id, tipo } },
      create: {
        reporteId: id,
        tipo,
        nombre,
        imagenUrl,
        imagenData: imagen,
      },
      update: {
        nombre,
        imagenUrl,
        imagenData: imagen,
        firmadoEn: new Date(),
      },
    });

    return NextResponse.json({ firma });
  } catch (err) {
    console.error("[infraestructura firmas]", err);
    return NextResponse.json({ error: "Error al guardar firma" }, { status: 500 });
  }
}
