import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { HelpDeskAuthError, requireHelpDeskSession } from "@/lib/help-desk/auth";

export async function POST(request: Request) {
  try {
    const session = await requireHelpDeskSession();
    const body = await request.json().catch(() => ({}));
    const conectado = body.conectado !== false;

    await prisma.hdSesionAgente.upsert({
      where: { usuarioId: session.id },
      create: { usuarioId: session.id, conectado, ultimoPing: new Date() },
      update: { conectado, ultimoPing: new Date() },
    });

    return NextResponse.json({ ok: true, conectado });
  } catch (err) {
    if (err instanceof HelpDeskAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
