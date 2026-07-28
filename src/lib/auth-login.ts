import { NextResponse } from "next/server";
import type { PrismaClient, Usuario } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  applySessionCookie,
  createToken,
  dashboardPath,
  setSessionCookie,
} from "@/lib/auth";
import { activarTecnicosRegistrados } from "@/lib/bootstrap-tecnico";
import {
  normalizeEmail,
  normalizePassword,
  passwordHashLooksValid,
  verifyPassword,
} from "@/lib/password";

type UsuarioConTecnico = Usuario & {
  tecnico: { id: string } | null;
};

export type AuthLoginInput = {
  email: unknown;
  password: unknown;
  appTecnico?: boolean;
};

export type AuthLoginResult =
  | {
      ok: true;
      user: { id: string; email: string; nombre: string; rol: string };
      redirect: string;
      token: string;
      reparado?: string[];
    }
  | { ok: false; status: number; error: string };

function esAppTecnico(request: Request, explicit?: boolean): boolean {
  if (explicit) return true;
  const h = request.headers.get("x-infinity-app")?.toLowerCase();
  return h === "tecnico" || h === "tecnicos";
}

export async function authenticateOperacionesLogin(
  input: AuthLoginInput,
  request: Request,
  db: PrismaClient = prisma
): Promise<AuthLoginResult> {
  const emailNorm = normalizeEmail(input.email);
  const passwordNorm = normalizePassword(input.password);
  const appTecnico = esAppTecnico(request, input.appTecnico);

  if (!emailNorm || !passwordNorm) {
    return { ok: false, status: 400, error: "Email y contraseña requeridos" };
  }

  let usuario = (await db.usuario.findUnique({
    where: { email: emailNorm },
    include: { tecnico: { select: { id: true } } },
  })) as UsuarioConTecnico | null;

  if (!usuario) {
    return { ok: false, status: 401, error: "Credenciales inválidas" };
  }

  if (usuario.rol === "CLIENTE") {
    return {
      ok: false,
      status: 403,
      error: "Use la app INFINITY Connect para iniciar sesión",
    };
  }

  if (appTecnico && usuario.rol !== "TECNICO") {
    return {
      ok: false,
      status: 403,
      error: "Esta app es solo para técnicos de campo. Use el panel web de Operaciones.",
    };
  }

  if (!passwordHashLooksValid(usuario.passwordHash)) {
    console.error("[Login] Hash inválido para", usuario.email);
    return {
      ok: false,
      status: 401,
      error:
        "La cuenta no tiene contraseña válida. Gerencia debe restablecerla en Usuarios y claves.",
    };
  }

  const valid = await verifyPassword(passwordNorm, usuario.passwordHash);
  if (!valid) {
    return { ok: false, status: 401, error: "Credenciales inválidas" };
  }

  const reparado: string[] = [];

  if (usuario.rol === "TECNICO") {
    if (!usuario.activo) {
      await db.usuario.update({
        where: { id: usuario.id },
        data: { activo: true },
      });
      usuario = { ...usuario, activo: true };
      reparado.push("cuenta_activada");
    }

    if (!usuario.tecnico) {
      const tecnico = await db.tecnico.create({
        data: {
          usuarioId: usuario.id,
          estadoActual: "DISPONIBLE",
        },
        select: { id: true },
      });
      usuario = { ...usuario, tecnico };
      reparado.push("perfil_tecnico");
    }
  } else if (!usuario.activo) {
    return {
      ok: false,
      status: 403,
      error: "Su cuenta está desactivada. Contacte a gerencia.",
    };
  }

  const token = await createToken({
    id: usuario.id,
    email: usuario.email,
    nombre: usuario.nombre,
    rol: usuario.rol,
    tecnicoId: usuario.tecnico?.id,
  });

  // Doble escritura: next/headers + Response (Firefox necesita Set-Cookie en el Response)
  await setSessionCookie(token);

  return {
    ok: true,
    user: {
      id: usuario.id,
      email: usuario.email,
      nombre: usuario.nombre,
      rol: usuario.rol,
    },
    redirect: dashboardPath(usuario.rol),
    token,
    reparado: reparado.length ? reparado : undefined,
  };
}

/** Repara cuentas TECNICO (activo + perfil). Idempotente. */
export async function repararAccesoTecnicos(db: PrismaClient = prisma) {
  return activarTecnicosRegistrados(db);
}

export function authLoginJson(result: AuthLoginResult) {
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  const res = NextResponse.json({
    user: result.user,
    redirect: result.redirect,
    reparado: result.reparado,
  });
  return applySessionCookie(res, result.token);
}
