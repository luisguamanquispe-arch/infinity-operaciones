import { NextResponse } from "next/server";
import { checkLoginRateLimit, rotateClienteRefreshToken } from "@/lib/cliente-app/auth";

export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!checkLoginRateLimit(`cliente-refresh:${ip}`, 30)) {
      return NextResponse.json({ error: "Demasiados intentos" }, { status: 429 });
    }

    const body = await request.json();
    const refreshToken = typeof body.refreshToken === "string" ? body.refreshToken : "";
    if (!refreshToken) {
      return NextResponse.json({ error: "refreshToken requerido" }, { status: 400 });
    }

    const rotated = await rotateClienteRefreshToken(refreshToken);
    if (!rotated) {
      return NextResponse.json({ error: "Sesión inválida o expirada" }, { status: 401 });
    }

    return NextResponse.json({
      accessToken: rotated.accessToken,
      refreshToken: rotated.refreshToken,
      expiresIn: 3600,
      tokenType: "Bearer",
      user: {
        id: rotated.session.id,
        email: rotated.session.email,
        nombre: rotated.session.nombre,
        clienteId: rotated.session.clienteId,
      },
    });
  } catch (err) {
    console.error("[cliente/auth/refresh]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
