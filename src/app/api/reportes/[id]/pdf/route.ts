import { NextResponse } from "next/server";
import { getFullSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generarPdfReporteSoporte } from "@/lib/reporte-pdf";

export const runtime = "nodejs";
export const maxDuration = 60;

/** PDF consolidado para cliente — disponible desde reportes finalizados (supervisor/admin). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getFullSession();
  if (!session || !["SUPERVISOR", "ADMIN"].includes(session.rol)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    select: { id: true, estado: true },
  });
  if (!ticket) {
    return NextResponse.json({ error: "Reporte no encontrado" }, { status: 404 });
  }
  if (!["CERRADO", "FINALIZADO"].includes(ticket.estado)) {
    return NextResponse.json(
      { error: "Solo disponible para órdenes finalizadas o cerradas" },
      { status: 400 }
    );
  }

  try {
    const { buffer, filename } = await generarPdfReporteSoporte(id);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[reportes/pdf]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "No se pudo generar el PDF" },
      { status: 500 }
    );
  }
}
