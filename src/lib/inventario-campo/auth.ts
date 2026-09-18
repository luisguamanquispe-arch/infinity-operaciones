import { NextResponse } from "next/server";
import { getFullSession, type SessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  puedeAjustarInventario,
  puedeAprobarMaterial,
  puedeConciliarMaterial,
  puedeGestionarCatalogo,
  puedeOperarBodega,
  puedeSolicitarMaterial,
  tecnicoPuedeUsarInventarioCampo,
} from "./reglas";

type AuthOk = { ok: true; session: SessionUser };
type AuthFail = { ok: false; response: NextResponse };

export async function requireSession(): Promise<AuthOk | AuthFail> {
  const session = await getFullSession();
  if (!session) {
    return {
      ok: false,
      response: NextResponse.json({ error: "No autorizado" }, { status: 401 }),
    };
  }
  return { ok: true, session };
}

export async function requireSolicitarMaterial(): Promise<AuthOk | AuthFail> {
  const base = await requireSession();
  if (!base.ok) return base;
  if (!puedeSolicitarMaterial(base.session.rol)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Solo supervisor o admin puede solicitar materiales." },
        { status: 403 }
      ),
    };
  }
  return base;
}

export async function requireAprobarMaterial(): Promise<AuthOk | AuthFail> {
  const base = await requireSession();
  if (!base.ok) return base;
  if (!puedeAprobarMaterial(base.session.rol)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "No autorizado para aprobar solicitudes." },
        { status: 403 }
      ),
    };
  }
  return base;
}

export async function requireBodegaOrOps(): Promise<AuthOk | AuthFail> {
  const base = await requireSession();
  if (!base.ok) return base;
  if (!puedeOperarBodega(base.session.rol)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "No autorizado para operaciones de bodega." },
        { status: 403 }
      ),
    };
  }
  return base;
}

export async function requireCatalogoAdmin(): Promise<AuthOk | AuthFail> {
  const base = await requireSession();
  if (!base.ok) return base;
  if (!puedeGestionarCatalogo(base.session.rol)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Solo admin puede gestionar el catálogo." },
        { status: 403 }
      ),
    };
  }
  return base;
}

export async function requireAjusteAdmin(): Promise<AuthOk | AuthFail> {
  const base = await requireSession();
  if (!base.ok) return base;
  if (!puedeAjustarInventario(base.session.rol)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Solo admin puede ajustar inventario." },
        { status: 403 }
      ),
    };
  }
  return base;
}

export async function requireConciliar(): Promise<AuthOk | AuthFail> {
  const base = await requireSession();
  if (!base.ok) return base;
  if (!puedeConciliarMaterial(base.session.rol)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "No autorizado" }, { status: 403 }),
    };
  }
  return base;
}

export async function requireTecnicoCampo(): Promise<
  | { ok: true; session: SessionUser; tecnicoId: string }
  | AuthFail
> {
  const base = await requireSession();
  if (!base.ok) return base;
  if (!tecnicoPuedeUsarInventarioCampo(base.session.rol) || !base.session.tecnicoId) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Solo el técnico asignado puede operar materiales de campo." },
        { status: 403 }
      ),
    };
  }
  return { ok: true, session: base.session, tecnicoId: base.session.tecnicoId };
}

export async function requireTecnicoEnTicket(
  ticketId: string
): Promise<
  | { ok: true; session: SessionUser; tecnicoId: string }
  | AuthFail
> {
  const base = await requireTecnicoCampo();
  if (!base.ok) return base;
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: {
      tecnicoId: true,
      tecnicos: { select: { tecnicoId: true } },
    },
  });
  if (!ticket) {
    return {
      ok: false,
      response: NextResponse.json({ error: "OT no encontrada." }, { status: 404 }),
    };
  }
  const ok =
    ticket.tecnicoId === base.tecnicoId ||
    ticket.tecnicos.some((t) => t.tecnicoId === base.tecnicoId);
  if (!ok) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "No está asignado a esta orden de trabajo." },
        { status: 403 }
      ),
    };
  }
  return base;
}

export async function requireOpsInventarioView(): Promise<AuthOk | AuthFail> {
  const base = await requireSession();
  if (!base.ok) return base;
  if (
    !puedeSolicitarMaterial(base.session.rol) &&
    !puedeOperarBodega(base.session.rol)
  ) {
    return {
      ok: false,
      response: NextResponse.json({ error: "No autorizado" }, { status: 403 }),
    };
  }
  return base;
}
