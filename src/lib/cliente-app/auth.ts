import { createHash, randomBytes } from "crypto";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";
import { getJwtSecret } from "@/lib/env";

export const CLIENTE_AUD = "cliente" as const;
const ACCESS_TTL = "1h";
const REFRESH_DAYS = 30;

export interface ClienteSession {
  id: string;
  email: string;
  nombre: string;
  rol: "CLIENTE";
  clienteId: string;
  aud: typeof CLIENTE_AUD;
}

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export async function createClienteAccessToken(session: ClienteSession): Promise<string> {
  return new SignJWT({
    id: session.id,
    email: session.email,
    nombre: session.nombre,
    rol: session.rol,
    clienteId: session.clienteId,
    aud: CLIENTE_AUD,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setAudience(CLIENTE_AUD)
    .setExpirationTime(ACCESS_TTL)
    .sign(getJwtSecret());
}

export async function verifyClienteAccessToken(token: string): Promise<ClienteSession | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret(), {
      audience: CLIENTE_AUD,
    });
    if (payload.rol !== "CLIENTE" || payload.aud !== CLIENTE_AUD) return null;
    if (typeof payload.id !== "string" || typeof payload.clienteId !== "string") return null;
    return {
      id: payload.id,
      email: String(payload.email ?? ""),
      nombre: String(payload.nombre ?? ""),
      rol: "CLIENTE",
      clienteId: payload.clienteId,
      aud: CLIENTE_AUD,
    };
  } catch {
    return null;
  }
}

export async function issueClienteRefreshToken(usuarioId: string): Promise<string> {
  const raw = randomBytes(48).toString("base64url");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_DAYS);

  await prisma.appClienteRefreshToken.create({
    data: {
      usuarioId,
      tokenHash: hashToken(raw),
      expiresAt,
    },
  });

  return raw;
}

export async function rotateClienteRefreshToken(
  rawRefresh: string
): Promise<{ session: ClienteSession; accessToken: string; refreshToken: string } | null> {
  const tokenHash = hashToken(rawRefresh);
  const existing = await prisma.appClienteRefreshToken.findUnique({
    where: { tokenHash },
    include: {
      usuario: {
        include: { cuentaCliente: true },
      },
    },
  });

  if (!existing || existing.revokedAt || existing.expiresAt < new Date()) {
    return null;
  }

  const usuario = existing.usuario;
  if (!usuario.activo || usuario.rol !== "CLIENTE" || !usuario.cuentaCliente) {
    return null;
  }

  await prisma.appClienteRefreshToken.update({
    where: { id: existing.id },
    data: { revokedAt: new Date() },
  });

  const session: ClienteSession = {
    id: usuario.id,
    email: usuario.email,
    nombre: usuario.nombre,
    rol: "CLIENTE",
    clienteId: usuario.cuentaCliente.clienteId,
    aud: CLIENTE_AUD,
  };

  const [accessToken, refreshToken] = await Promise.all([
    createClienteAccessToken(session),
    issueClienteRefreshToken(usuario.id),
  ]);

  return { session, accessToken, refreshToken };
}

export async function revokeClienteRefreshToken(rawRefresh: string): Promise<void> {
  const tokenHash = hashToken(rawRefresh);
  await prisma.appClienteRefreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllClienteRefreshTokens(usuarioId: string): Promise<void> {
  await prisma.appClienteRefreshToken.updateMany({
    where: { usuarioId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/** Extrae Bearer de Authorization; no usa cookie de operaciones. */
export function extractBearer(request: Request): string | null {
  const header = request.headers.get("authorization") || request.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  return token || null;
}

export async function requireClienteSession(request: Request): Promise<ClienteSession> {
  const token = extractBearer(request);
  if (!token) throw new Error("UNAUTHORIZED");
  const session = await verifyClienteAccessToken(token);
  if (!session) throw new Error("UNAUTHORIZED");
  return session;
}

const loginAttempts = new Map<string, { count: number; resetAt: number }>();

export function checkLoginRateLimit(key: string, max = 10, windowMs = 15 * 60 * 1000): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(key);
  if (!entry || entry.resetAt < now) {
    loginAttempts.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= max) return false;
  entry.count += 1;
  return true;
}
