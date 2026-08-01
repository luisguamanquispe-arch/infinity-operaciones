import { NextResponse } from "next/server";
import { requireInfraSession } from "@/lib/infraestructura-red/auth";
import { generarPdfIrReporte } from "@/lib/infraestructura-red/pdf";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireInfraSession();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const reporte = await prisma.irReporte.findUnique({
    where: { id },
    select: { tecnicoId: true },
  });
  if (!reporte) {
    return NextResponse.json({ error: "Reporte no encontrado" }, { status: 404 });
  }
  if (auth.session.rol === "TECNICO" && auth.session.tecnicoId !== reporte.tecnicoId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const { buffer, filename } = await generarPdfIrReporte(id);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("[infraestructura pdf]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al generar PDF" },
      { status: 500 }
    );
  }
}
