import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFullSession } from "@/lib/auth";
import { actualizarCliente } from "@/lib/cliente-crud";
import { esClienteInfraestructura } from "@/lib/cliente-infraestructura";

function puedeGestionarClientes(rol: string) {
  return ["SUPERVISOR", "ADMIN"].includes(rol);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getFullSession();
  if (!session || !puedeGestionarClientes(session.rol)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const cliente = await prisma.cliente.findUnique({
    where: { id },
    include: {
      _count: { select: { tickets: true } },
    },
  });

  if (!cliente) {
    return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
  }

  return NextResponse.json({ cliente });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getFullSession();
  if (!session || !puedeGestionarClientes(session.rol)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const cliente = await actualizarCliente(id, body, session.id);
    return NextResponse.json({ cliente });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error al actualizar cliente";
    const status = msg.includes("no encontrado") ? 404 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
