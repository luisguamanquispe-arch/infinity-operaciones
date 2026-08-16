import { NextResponse } from "next/server";
import { getFullSession, type SessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  evaluarIdVehiculoTecnico,
  evaluarOperacionCampo,
  puedeGestionarParque,
} from "./reglas";

export async function requireOpsVehiculo(): Promise<
  { ok: true; session: SessionUser } | { ok: false; response: NextResponse }
> {
  const session = await getFullSession();
  if (!session || !puedeGestionarParque(session.rol)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "No autorizado" }, { status: 401 }),
    };
  }
  return { ok: true, session };
}

export async function requireTecnicoFlota(): Promise<
  | { ok: true; session: SessionUser; tecnicoId: string }
  | { ok: false; response: NextResponse }
> {
  const session = await getFullSession();
  if (!session || session.rol !== "TECNICO") {
    return {
      ok: false,
      response: NextResponse.json({ error: "No autorizado" }, { status: 401 }),
    };
  }
  if (!session.tecnicoId) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Su usuario no tiene perfil de técnico. Contacte a gerencia." },
        { status: 403 }
      ),
    };
  }
  return { ok: true, session, tecnicoId: session.tecnicoId };
}

export async function asignacionAbiertaDeTecnico(tecnicoId: string) {
  return prisma.asignacionVehiculo.findFirst({
    where: { tecnicoId, fechaFin: null },
    include: {
      vehiculo: true,
      tecnico: { include: { usuario: { select: { nombre: true } } } },
    },
    orderBy: { fechaInicio: "desc" },
  });
}

export async function requireTecnicoVehiculoAsignado(vehiculoId: string): Promise<
  | { ok: true; session: SessionUser; tecnicoId: string }
  | { ok: false; response: NextResponse }
> {
  const base = await requireTecnicoFlota();
  if (!base.ok) return base;
  const asig = await prisma.asignacionVehiculo.findFirst({
    where: { vehiculoId, tecnicoId: base.tecnicoId, fechaFin: null },
    select: { id: true },
  });
  if (!asig) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "No tiene este vehículo asignado." },
        { status: 403 }
      ),
    };
  }
  return base;
}

export async function requireTecnicoVehiculoCampo(
  requestedVehiculoId?: string | null
): Promise<
  | {
      ok: true;
      session: SessionUser;
      tecnicoId: string;
      asignacion: NonNullable<
        Awaited<ReturnType<typeof asignacionAbiertaDeTecnico>>
      >;
      vehiculo: NonNullable<
        Awaited<ReturnType<typeof asignacionAbiertaDeTecnico>>
      >["vehiculo"];
    }
  | { ok: false; response: NextResponse }
> {
  const base = await requireTecnicoFlota();
  if (!base.ok) return base;
  const asig = await asignacionAbiertaDeTecnico(base.tecnicoId);
  if (!asig) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "No tiene vehículo asignado." },
        { status: 403 }
      ),
    };
  }
  const idCheck = evaluarIdVehiculoTecnico({
    asignadoVehiculoId: asig.vehiculoId,
    requestedVehiculoId,
  });
  if (!idCheck.ok) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: idCheck.error },
        { status: idCheck.status }
      ),
    };
  }
  const campo = evaluarOperacionCampo(asig.vehiculo.estado);
  if (!campo.ok) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: campo.error },
        { status: campo.status }
      ),
    };
  }
  return {
    ok: true,
    session: base.session,
    tecnicoId: base.tecnicoId,
    asignacion: asig,
    vehiculo: asig.vehiculo,
  };
}
