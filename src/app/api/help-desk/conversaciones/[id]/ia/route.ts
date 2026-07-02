import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { HelpDeskAuthError, requireHelpDeskSession } from "@/lib/help-desk/auth";
import { generarSugerenciasIa } from "@/lib/help-desk/ia-copiloto";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireHelpDeskSession();
    const { id } = await params;

    const mensajes = await prisma.hdMensaje.findMany({
      where: { conversacionId: id },
      orderBy: { createdAt: "asc" },
      select: { autor: true, contenido: true },
    });

    const sugerencias = await generarSugerenciasIa(id, mensajes);
    return NextResponse.json({ sugerencias });
  } catch (err) {
    if (err instanceof HelpDeskAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
