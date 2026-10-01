import { NextResponse } from "next/server";
import { responderEncuestaPublica } from "@/lib/satisfaccion/servicio";
import { tokenEncuestaValido, validarRespuestaEncuesta } from "@/lib/satisfaccion/reglas";
import { ipDeRequest, limitarTasa } from "@/lib/satisfaccion/rate-limit";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const ip = ipDeRequest(request);
  if (!limitarTasa(`responder:${ip}`, 8, 60 * 60_000)) {
    return NextResponse.json({ error: "Demasiadas solicitudes" }, { status: 429 });
  }
  const { token } = await params;
  if (!tokenEncuestaValido(token)) {
    return NextResponse.json({ error: "Encuesta no encontrada" }, { status: 404 });
  }
  const body = await request.json().catch(() => null);
  const validacion = validarRespuestaEncuesta(body);
  if (!validacion.ok) {
    return NextResponse.json({ error: validacion.errores[0]?.mensaje || "Datos inválidos", errores: validacion.errores }, { status: 400 });
  }
  const resultado = await responderEncuestaPublica({
    token,
    ratingGeneral: validacion.ratingGeneral,
    ratingTecnico: validacion.ratingTecnico,
    solucionado: validacion.solucionado,
    comentario: validacion.comentario,
    ip,
    userAgent: request.headers.get("user-agent"),
  });
  if (!resultado.ok) {
    if (resultado.status === 409) {
      return NextResponse.json({ error: "Esta encuesta ya fue respondida" }, { status: 409 });
    }
    const error = resultado.status === 410 ? "Esta encuesta ya no está disponible" : "Encuesta no encontrada";
    return NextResponse.json({ error }, { status: resultado.status });
  }
  return NextResponse.json({
    ok: true,
    mensaje: "Gracias por tu opinión. Tu evaluación nos ayuda a mejorar nuestro servicio técnico.",
  });
}
