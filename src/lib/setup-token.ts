export function getSetupTokenFromRequest(request: Request): string | null {
  const header = request.headers.get("x-setup-token")?.trim();
  if (header) return header;
  const q = new URL(request.url).searchParams.get("token")?.trim();
  return q || null;
}

export function requireSetupToken(
  request: Request
):
  | { ok: true }
  | {
      ok: false;
      error: string;
      status: number;
      receivedLength: number;
      configuredLength: number;
    } {
  const setupToken = process.env.SETUP_TOKEN?.trim() ?? "";
  const provided = getSetupTokenFromRequest(request) ?? "";

  if (!setupToken) {
    return {
      ok: false,
      error: "SETUP_TOKEN no configurado en el servidor (Render Environment)",
      status: 503,
      receivedLength: provided.length,
      configuredLength: 0,
    };
  }

  if (!provided || provided !== setupToken) {
    return {
      ok: false,
      error: "Token inválido: no coincide con SETUP_TOKEN de Render",
      status: 401,
      receivedLength: provided.length,
      configuredLength: setupToken.length,
    };
  }

  return { ok: true };
}
