import { NextResponse } from "next/server";
import { getFullSession } from "@/lib/auth";
import {
  guardarConfigRecordatorio,
  obtenerConfigRecordatorio,
} from "@/lib/recordatorios/config";
import { pushConfigurado } from "@/lib/recordatorios/push";

async function requireAdmin() {
  const session = await getFullSession();
  if (!session || session.rol !== "ADMIN") return null;
  return session;
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Solo gerencia puede ver esta configuración" }, { status: 401 });
  }
  const config = await obtenerConfigRecordatorio();
  return NextResponse.json({
    config,
    pushServidor: pushConfigurado(),
    zona: "America/Guayaquil",
  });
}

export async function PATCH(request: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Solo gerencia puede editar recordatorios" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: Parameters<typeof guardarConfigRecordatorio>[0] = {};
  const bools = ["activo", "internoHabilitado", "pushHabilitado", "respetarHorario"] as const;
  const ints = [
    "minutosAnticipacion",
    "minutosRepeticion",
    "maxRepeticiones",
    "horaInicio",
    "horaFin",
  ] as const;
  for (const k of bools) {
    if (typeof body[k] === "boolean") patch[k] = body[k];
  }
  for (const k of ints) {
    if (typeof body[k] === "number" && Number.isFinite(body[k])) patch[k] = body[k];
  }
  const config = await guardarConfigRecordatorio(patch);
  return NextResponse.json({ config });
}
