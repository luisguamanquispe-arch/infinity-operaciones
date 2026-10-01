import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sesionSatisfaccion } from "@/lib/satisfaccion/http";
import { intentarEnvio } from "@/lib/satisfaccion/servicio";
import { urlEncuestaPublica } from "@/lib/satisfaccion/reglas";
import { limitarTasa } from "@/lib/satisfaccion/rate-limit";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const acceso = await sesionSatisfaccion("seguimiento");
  if (!acceso.ok) return acceso.response;
  const { id } = await params;
  const survey = await prisma.customerSatisfactionSurvey.findUnique({
    where: { id },
    select: { id: true, token: true, status: true },
  });
  if (!survey) return NextResponse.json({ error: "Encuesta no encontrada" }, { status: 404 });
  if (survey.status === "ANSWERED" || survey.status === "CANCELLED" || survey.status === "EXPIRED") {
    return NextResponse.json({ error: "La encuesta ya no se puede reenviar" }, { status: 409 });
  }
  if (!limitarTasa(`reenvio:${survey.id}`, 5, 60 * 60_000)) {
    return NextResponse.json({ error: "Demasiados reenvíos. Intente más tarde." }, { status: 429 });
  }
  const envio = await intentarEnvio(survey.id, "reenvio");
  return NextResponse.json({
    ok: true,
    pendiente: envio.pendiente,
    url: urlEncuestaPublica(survey.token, process.env.PUBLIC_APP_URL),
  });
}
