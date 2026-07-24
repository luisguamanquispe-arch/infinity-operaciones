import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireSetupToken } from "@/lib/setup-token";

/**
 * Crea usuario demo de la app INFINITY Connect (rol CLIENTE).
 * Requiere SETUP_TOKEN igual que otros endpoints de setup.
 *
 * GET/POST con ?token=SETUP_TOKEN o header x-setup-token
 * Body opcional: { email, password, cedula, nombre, telefono, plan, sector, direccion }
 */
export async function GET(request: Request) {
  return POST(request);
}

export async function POST(request: Request) {
  const auth = requireSetupToken(request);
  if (!auth.ok) {
    return NextResponse.json(
      {
        error: auth.error,
        receivedLength: auth.receivedLength,
        configuredLength: auth.configuredLength,
        hint:
          auth.status === 503
            ? "Define SETUP_TOKEN en Render → Environment y redeploy"
            : "Copia SETUP_TOKEN de Render (Reveal). Longitudes distintas = token incorrecto o cortado.",
      },
      { status: auth.status }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const email = (body.email as string)?.trim().toLowerCase() || "cliente@infinity.ec";
    const password = (body.password as string) || "cliente123";
    const cedula = (body.cedula as string)?.trim() || "9999999999";
    const nombre = (body.nombre as string)?.trim() || "Cliente Demo Infinity";
    const telefono = (body.telefono as string)?.trim() || "0990000000";
    const plan = (body.plan as string)?.trim() || "Fibra 100 Mbps";
    const sector = (body.sector as string)?.trim() || "Centro";
    const direccion = (body.direccion as string)?.trim() || "Av. Principal s/n";

    let cliente = await prisma.cliente.findUnique({ where: { cedula } });
    if (!cliente) {
      cliente = await prisma.cliente.create({
        data: {
          cedula,
          nombre,
          telefono,
          plan,
          sector,
          direccion,
          potencia: -18.5,
          onuSerial: "ONU-DEMO-001",
          nodo: "NODO-01",
          cajaNap: "NAP-A12",
          puerto: "4",
        },
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    let usuario = await prisma.usuario.findUnique({
      where: { email },
      include: { cuentaCliente: true },
    });

    if (!usuario) {
      usuario = await prisma.usuario.create({
        data: {
          email,
          passwordHash,
          nombre,
          rol: "CLIENTE",
          cuentaCliente: {
            create: { clienteId: cliente.id },
          },
        },
        include: { cuentaCliente: true },
      });
    } else {
      await prisma.usuario.update({
        where: { id: usuario.id },
        data: { passwordHash, nombre, rol: "CLIENTE", activo: true },
      });
      if (!usuario.cuentaCliente) {
        await prisma.appClienteCuenta.create({
          data: { usuarioId: usuario.id, clienteId: cliente.id },
        });
      }
      usuario = await prisma.usuario.findUniqueOrThrow({
        where: { id: usuario.id },
        include: { cuentaCliente: true },
      });
    }

    return NextResponse.json({
      ok: true,
      user: {
        email: usuario.email,
        password,
        clienteId: usuario.cuentaCliente?.clienteId,
      },
      message: "Usuario CLIENTE listo para INFINITY Connect",
    });
  } catch (err) {
    console.error("[setup/cliente-app-usuario]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}
