import { NextResponse } from "next/server";
import { evaluarRecordatorios } from "@/lib/recordatorios/motor";

export const runtime = "nodejs";
export const maxDuration = 60;

function cronSecret(): string | null {
  const a = process.env.RECORDATORIO_CRON_SECRET?.trim();
  const b = process.env.BACKUP_CRON_SECRET?.trim();
  return a || b || null;
}

export async function POST(request: Request) {
  const secret = cronSecret();
  if (!secret) {
    return NextResponse.json(
      { error: "RECORDATORIO_CRON_SECRET no configurado" },
      { status: 503 }
    );
  }
  const auth = request.headers.get("authorization") || "";
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  try {
    const result = await evaluarRecordatorios();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message.slice(0, 180) : "error";
    console.error("[recordatorios/cron]", msg);
    return NextResponse.json({ error: "Error al evaluar recordatorios" }, { status: 500 });
  }
}
