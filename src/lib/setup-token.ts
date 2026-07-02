export function getSetupTokenFromRequest(request: Request): string | null {
  const header = request.headers.get("x-setup-token");
  if (header) return header;
  return new URL(request.url).searchParams.get("token");
}

export function requireSetupToken(request: Request): { ok: true } | { ok: false; error: string } {
  const setupToken = process.env.SETUP_TOKEN;
  const provided = getSetupTokenFromRequest(request);
  if (!setupToken || !provided || provided !== setupToken) {
    return { ok: false, error: "Token inválido o SETUP_TOKEN no configurado" };
  }
  return { ok: true };
}
