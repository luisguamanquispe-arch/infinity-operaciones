import { NextResponse } from "next/server";
import {
  extractBearer,
  requireClienteSession,
  revokeAllClienteRefreshTokens,
  revokeClienteRefreshToken,
  verifyClienteAccessToken,
} from "@/lib/cliente-app/auth";

export async function POST(request: Request) {
  try {
    let body: { refreshToken?: string } = {};
    try {
      body = await request.json();
    } catch {
      /* body opcional */
    }

    if (typeof body.refreshToken === "string" && body.refreshToken) {
      await revokeClienteRefreshToken(body.refreshToken);
    }

    const bearer = extractBearer(request);
    if (bearer) {
      const session = await verifyClienteAccessToken(bearer);
      if (session) {
        await revokeAllClienteRefreshTokens(session.id);
      }
    } else {
      try {
        const session = await requireClienteSession(request);
        await revokeAllClienteRefreshTokens(session.id);
      } catch {
        /* ya revocado refresh si venía */
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[cliente/auth/logout]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
