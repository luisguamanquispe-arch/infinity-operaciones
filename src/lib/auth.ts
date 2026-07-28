import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "./prisma";
import { getJwtSecret } from "./env";
import type { Rol } from "@prisma/client";
export interface SessionUser {
  id: string;
  email: string;
  nombre: string;
  rol: Rol;
  tecnicoId?: string;
}

export async function createToken(user: SessionUser): Promise<string> {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("12h")
    .sign(getJwtSecret());
}

export async function verifyToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());    return payload as unknown as SessionUser;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function requireSession(roles?: Rol[]): Promise<SessionUser> {
  const session = await getSession();
  if (!session) throw new Error("UNAUTHORIZED");
  if (roles && !roles.includes(session.rol)) throw new Error("FORBIDDEN");
  return session;
}

export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set("session", token, sessionCookieOptions());
}

/** Opciones de cookie de sesión (compatibles Chrome / Firefox en HTTPS). */
export function sessionCookieOptions() {
  const secure =
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL === "1" ||
    process.env.COOKIE_SECURE === "1";
  return {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 12,
    path: "/",
  };
}

/** Adjunta la cookie al Response (más fiable en Firefox que cookies().set solo). */
export function applySessionCookie(res: NextResponse, token: string) {
  res.cookies.set("session", token, sessionCookieOptions());
  return res;
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set("session", "", {
    ...sessionCookieOptions(),
    maxAge: 0,
  });
  cookieStore.delete("session");
}

export async function getFullSession(): Promise<SessionUser | null> {
  const session = await getSession();
  if (!session) return null;

  if (session.rol === "TECNICO") {
    const tecnico = await prisma.tecnico.findUnique({
      where: { usuarioId: session.id },
      select: { id: true },
    });
    if (!tecnico) return null;
    session.tecnicoId = tecnico.id;
  }

  return session;
}

export function dashboardPath(rol: Rol): string {
  switch (rol) {
    case "TECNICO":
      return "/tecnico";
    case "HELP_DESK":
      return "/help-desk";
    case "SUPERVISOR":
      return "/supervisor";
    case "ADMIN":
      return "/gerencia";
    case "CLIENTE":
      return "/login";
    default:
      return "/login";
  }
}
