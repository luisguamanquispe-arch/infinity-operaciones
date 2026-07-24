import { NextResponse } from "next/server";
import { getFullSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { tecnicoAsignadoAlTicket } from "@/lib/ticket-tecnicos";
import { generarPdfReporteSoporte } from "@/lib/reporte-pdf";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getFullSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: { tecnicos: { select: { tecnicoId: true } } },
  });
  if (!ticket) {
    return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });
  }

  const puede =
    session.rol === "ADMIN" ||
    session.rol === "SUPERVISOR" ||
    (session.rol === "TECNICO" &&
      !!session.tecnicoId &&
      tecnicoAsignadoAlTicket(ticket, session.tecnicoId));

  if (!puede) {
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
  }

  try {
    const { buffer, filename } = await generarPdfReporteSoporte(id);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[reporte-pdf]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "No se pudo generar el PDF" },
      { status: 500 }
    );
  }
}
