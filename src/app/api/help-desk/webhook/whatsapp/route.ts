import { NextResponse } from "next/server";

/**
 * WhatsApp inbound desactivado (opción C — reemplazo Help Desk → Soporte Remoto).
 * Meta puede seguir haciendo GET de verificación; respondemos desactivado.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const challenge = searchParams.get("hub.challenge");
  if (mode === "subscribe" && challenge) {
    // Mantener verificación Meta estable, pero el canal ya no crea conversaciones.
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json(
    {
      ok: false,
      error:
        "Canal WhatsApp Help Desk desactivado. Use Soporte Remoto en /help-desk.",
    },
    { status: 410 }
  );
}

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      error:
        "Canal WhatsApp Help Desk desactivado. Registre la atención en Soporte Remoto (/help-desk).",
    },
    { status: 410 }
  );
}
