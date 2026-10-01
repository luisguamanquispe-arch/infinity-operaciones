import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sesionSatisfaccion } from "@/lib/satisfaccion/http";
import { auditar } from "@/lib/satisfaccion/servicio";
import { sanitizarComentario } from "@/lib/satisfaccion/reglas";

const ESTADOS = ["OPEN", "IN_PROGRESS", "RESOLVED", "CANCELLED"] as const;

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const acceso = await sesionSatisfaccion("seguimiento");
  if (!acceso.ok) return acceso.response;
  const { id } = await params;
  const actual = await prisma.satisfactionFollowUp.findUnique({
    where: { id },
    select: { id: true, survey: { select: { ticketId: true } } },
  });
  if (!actual) return NextResponse.json({ error: "Seguimiento no encontrado" }, { status: 404 });
  const body = await request.json().catch(() => null);
  const status = typeof body?.status === "string" ? body.status : undefined;
  if (status && !(ESTADOS as readonly string[]).includes(status)) {
    return NextResponse.json({ error: "Estado de seguimiento inválido" }, { status: 400 });
  }
  const data: {
    motivo?: string;
    accion?: string | null;
    contacto?: string | null;
    resultado?: string | null;
    observaciones?: string | null;
    status?: (typeof ESTADOS)[number];
    resolvedAt?: Date | null;
  } = {};
  if (typeof body?.motivo === "string") data.motivo = sanitizarComentario(body.motivo).slice(0, 500);
  if (typeof body?.accion === "string") data.accion = sanitizarComentario(body.accion).slice(0, 1000);
  if (typeof body?.contacto === "string") data.contacto = sanitizarComentario(body.contacto).slice(0, 300);
  if (typeof body?.resultado === "string") data.resultado = sanitizarComentario(body.resultado).slice(0, 1000);
  if (typeof body?.observaciones === "string") {
    data.observaciones = sanitizarComentario(body.observaciones).slice(0, 1000);
  }
  if (status) {
    data.status = status as (typeof ESTADOS)[number];
    data.resolvedAt = status === "RESOLVED" ? new Date() : null;
  }
  await prisma.satisfactionFollowUp.update({ where: { id }, data });
  if (status === "RESOLVED") {
    await auditar(actual.survey.ticketId, "SATISFACTION_FOLLOWUP_RESOLVED", { followUpId: id });
  }
  return NextResponse.json({ ok: true });
}
