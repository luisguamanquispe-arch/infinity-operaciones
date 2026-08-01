import { NextResponse } from "next/server";
import { requireSrSession } from "@/lib/soporte-remoto/auth";
import { escalarSrTicketAPresencial } from "@/lib/soporte-remoto/escalar";
import { srTicketInclude } from "@/lib/soporte-remoto/include";
import { prisma } from "@/lib/prisma";
import type { SrResultado } from "@prisma/client";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSrSession();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  try {
    const body = await request.json().catch(() => ({}));
    const resultado = body.resultado as SrResultado | undefined;
    const { ticket: presencial, codigo } = await escalarSrTicketAPresencial({
      ticketId: id,
      usuarioId: auth.session.id,
      usuarioNombre: auth.session.nombre,
      resultado,
      nota: typeof body.nota === "string" ? body.nota : undefined,
    });

    const ticket = await prisma.srTicket.findUnique({
      where: { id },
      include: srTicketInclude,
    });

    return NextResponse.json({
      ticket,
      ordenPresencial: { id: presencial.id, codigo },
    });
  } catch (err) {
    console.error("[help-desk escalar]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al escalar" },
      { status: 400 }
    );
  }
}
