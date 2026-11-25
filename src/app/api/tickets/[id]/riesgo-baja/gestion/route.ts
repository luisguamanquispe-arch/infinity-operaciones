import { NextResponse } from "next/server";
import { getFullSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { registrarGestionRiesgoBaja } from "@/lib/motivo-tecnico/riesgo-baja";
import { RESULTADOS_GESTION_RIESGO } from "@/lib/motivo-tecnico/catalogo";
import {
  rolPuedeGestionarRiesgoBaja,
  validarObservacionesRecuperacion,
} from "@/lib/motivo-tecnico/reglas-patch";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getFullSession();
  if (!session || !rolPuedeGestionarRiesgoBaja(session.rol)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const { id } = await params;
  const gestiones = await prisma.ticketGestionRiesgoBaja.findMany({
    where: { ticketId: id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({
    gestiones: gestiones.map((g) => ({
      ...g,
      createdAt: g.createdAt.toISOString(),
    })),
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getFullSession();
  if (!session || !rolPuedeGestionarRiesgoBaja(session.rol)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    resultado?: string;
    observaciones?: string;
  };
  const resultado = String(body.resultado || "").trim();
  if (!RESULTADOS_GESTION_RIESGO.some((r) => r.id === resultado)) {
    return NextResponse.json(
      { error: "Seleccione un resultado de gestión válido" },
      { status: 400 }
    );
  }

  if (resultado === "RECUPERADO") {
    const obs = validarObservacionesRecuperacion(body.observaciones);
    if (!obs.ok) {
      return NextResponse.json({ error: obs.error }, { status: 400 });
    }
  }

  try {
    const r = await registrarGestionRiesgoBaja({
      ticketId: id,
      usuarioId: session.id,
      usuarioNombre: session.nombre,
      resultado: resultado as "CONTACTO_REALIZADO" | "RECUPERADO" | "CONTINUA_RIESGO",
      observaciones: body.observaciones ?? null,
    });
    return NextResponse.json({ ok: true, resuelto: r.resuelto });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error al registrar gestión";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
