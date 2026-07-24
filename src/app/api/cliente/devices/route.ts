import { NextResponse } from "next/server";
import { requireClienteSession } from "@/lib/cliente-app/auth";
import { desactivarDeviceToken, registrarDeviceToken } from "@/lib/cliente-app/push";

export async function POST(request: Request) {
  try {
    const session = await requireClienteSession(request);
    const body = await request.json();
    const token = typeof body.token === "string" ? body.token : "";
    const plataforma = typeof body.plataforma === "string" ? body.plataforma : "unknown";

    const row = await registrarDeviceToken({
      usuarioId: session.id,
      token,
      plataforma,
    });

    return NextResponse.json({
      ok: true,
      device: {
        id: row.id,
        plataforma: row.plataforma,
        activo: row.activo,
      },
    });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    const msg = err instanceof Error ? err.message : "Error al registrar dispositivo";
    console.error("[cliente/devices POST]", err);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await requireClienteSession(request);
    const body = await request.json().catch(() => ({}));
    const token = typeof body.token === "string" ? body.token : "";
    if (!token) {
      return NextResponse.json({ error: "token requerido" }, { status: 400 });
    }
    await desactivarDeviceToken(session.id, token);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    console.error("[cliente/devices DELETE]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
