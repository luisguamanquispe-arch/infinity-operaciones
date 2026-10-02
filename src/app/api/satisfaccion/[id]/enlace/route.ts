import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sesionSatisfaccion } from "@/lib/satisfaccion/http";
import { urlEncuestaPublica } from "@/lib/satisfaccion/reglas";
import { auditar } from "@/lib/satisfaccion/servicio";

const ESTADOS_CON_ENLACE = new Set(["PENDING", "SENT", "OPENED"]);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const acceso = await sesionSatisfaccion("consulta");
  if (!acceso.ok) return acceso.response;
  const { id } = await params;
  const survey = await prisma.customerSatisfactionSurvey.findUnique({
    where: { id },
    select: { id: true, token: true, status: true, ticketId: true, deliveryStatus: true },
  });
  if (!survey) return NextResponse.json({ error: "Encuesta no encontrada" }, { status: 404 });
  if (!ESTADOS_CON_ENLACE.has(survey.status)) {
    return NextResponse.json({ error: "Esta encuesta ya no tiene un enlace para el cliente" }, { status: 409 });
  }
  if (survey.deliveryStatus !== "MANUAL") {
    await prisma.customerSatisfactionSurvey.update({
      where: { id: survey.id },
      data: { deliveryStatus: "MANUAL", channel: null },
    });
    await auditar(survey.ticketId, "SURVEY_LINK_COPIED", { surveyId: survey.id });
  }
  return NextResponse.json({
    url: urlEncuestaPublica(survey.token, process.env.PUBLIC_APP_URL),
  });
}
