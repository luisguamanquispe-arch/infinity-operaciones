import { NextResponse } from "next/server";
import { getFullSession } from "@/lib/auth";
import { puedeGestionarClientes } from "@/lib/cliente-permisos";
import { generarPdfHistorialSoportes } from "@/lib/historial-soportes-pdf";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getFullSession();
  if (!session || !puedeGestionarClientes(session.rol)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  try {
    const { buffer, filename } = await generarPdfHistorialSoportes(
      id,
      new URL(request.url).searchParams
    );
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "No se pudo generar el PDF";
    const status = msg.includes("no encontrado") ? 404 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
