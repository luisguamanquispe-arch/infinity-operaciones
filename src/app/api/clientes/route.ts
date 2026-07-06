import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFullSession } from "@/lib/auth";
import { crearCliente } from "@/lib/cliente-crud";
import { esClienteInfraestructura } from "@/lib/cliente-infraestructura";

function puedeGestionarClientes(rol: string) {
  return ["SUPERVISOR", "ADMIN"].includes(rol);
}

export async function GET(request: Request) {
  const session = await getFullSession();
  if (!session || !puedeGestionarClientes(session.rol)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const incluirInactivos = searchParams.get("incluirInactivos") === "1";
  const take = Math.min(100, Math.max(1, parseInt(searchParams.get("take") || "30", 10)));

  const where = {
    ...(incluirInactivos ? {} : { activo: true }),
    ...(q
      ? {
          OR: [
            { cedula: { contains: q } },
            { nombre: { contains: q, mode: "insensitive" as const } },
            { telefono: { contains: q } },
            { sector: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const clientes = await prisma.cliente.findMany({
    where,
    orderBy: { nombre: "asc" },
    take,
  });

  const filtrados = clientes.filter((c) => !esClienteInfraestructura(c.cedula));

  return NextResponse.json({ clientes: filtrados });
}

export async function POST(request: Request) {
  const session = await getFullSession();
  if (!session || !puedeGestionarClientes(session.rol)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const cliente = await crearCliente(body, session.id);
    return NextResponse.json({ cliente }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error al crear cliente";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
