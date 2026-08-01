import { NextResponse } from "next/server";
import { requireSrSession } from "@/lib/soporte-remoto/auth";
import { generarPdfSrTicket } from "@/lib/soporte-remoto/pdf";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSrSession();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const ticket = await prisma.srTicket.findUnique({ where: { id }, select: { id: true } });
  if (!ticket) {
    return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });
  }

  try {
    const { buffer, filename } = await generarPdfSrTicket(id);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("[soporte-remoto pdf]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al generar PDF" },
      { status: 500 }
    );
  }
}
