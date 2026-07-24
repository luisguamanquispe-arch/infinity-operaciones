import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
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
  cookieStore.set("session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 12,
    path: "/",
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
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
