import { NextResponse } from "next/server";
import { abrirEncuestaPublica } from "@/lib/satisfaccion/servicio";
import { tokenEncuestaValido } from "@/lib/satisfaccion/reglas";
import { ipDeRequest, limitarTasa } from "@/lib/satisfaccion/rate-limit";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const ip = ipDeRequest(request);
  if (!limitarTasa(`abrir:${ip}`, 60, 60_000)) {
    return NextResponse.json({ error: "Demasiadas solicitudes" }, { status: 429 });
  }
  const { token } = await params;
  if (!tokenEncuestaValido(token)) {
    return NextResponse.json({ error: "Encuesta no encontrada" }, { status: 404 });
  }
  const resultado = await abrirEncuestaPublica(token);
  if (!resultado.ok) {
    const error = resultado.status === 410 ? "Esta encuesta ya no está disponible" : "Encuesta no encontrada";
    return NextResponse.json({ error }, { status: resultado.status });
  }
  return NextResponse.json({
    respondida: resultado.respondida,
    tipoServicio: resultado.tipoServicio,
  });
}
