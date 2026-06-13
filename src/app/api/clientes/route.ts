import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFullSession } from "@/lib/auth";
import { mensajeCedulaInvalida, normalizarCedula, validarCedulaEcuatoriana } from "@/lib/cedula-ec";

export async function GET(request: Request) {
  const session = await getFullSession();
  if (!session || !["SUPERVISOR", "ADMIN"].includes(session.rol)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();

  if (!q) {
    const clientes = await prisma.cliente.findMany({
      where: { activo: true },
      orderBy: { nombre: "asc" },
      take: 20,
    });
    return NextResponse.json({ clientes });
  }

  const clientes = await prisma.cliente.findMany({
    where: {
      activo: true,
      OR: [
        { cedula: { contains: q } },
        { nombre: { contains: q } },
        { telefono: { contains: q } },
      ],
    },
    take: 10,
  });

  return NextResponse.json({ clientes });
}

export async function POST(request: Request) {
  const session = await getFullSession();
  if (!session || !["SUPERVISOR", "ADMIN"].includes(session.rol)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json();
  const {
    cedula,
    nombre,
    telefono,
    plan,
    direccion,
    sector,
    nodo,
    referencia,
    clienteId,
  } = body;

  if (!cedula || !nombre || !telefono || !direccion || !sector) {
    return NextResponse.json(
      { error: "Cédula, nombre, teléfono, dirección y sector son obligatorios" },
      { status: 400 }
    );
  }

  const cedulaNorm = normalizarCedula(cedula);
  if (!validarCedulaEcuatoriana(cedulaNorm)) {
    return NextResponse.json({ error: mensajeCedulaInvalida() }, { status: 400 });
  }

  let cliente;
  if (clienteId) {
    cliente = await prisma.cliente.update({
      where: { id: clienteId },
      data: {
        cedula: cedulaNorm,
        nombre,
        telefono,
        plan: plan || "Sin plan",
        direccion,
        sector,
        nodo: nodo || null,
        referencia: referencia || null,
      },
    });
  } else {
    cliente = await prisma.cliente.upsert({
      where: { cedula: cedulaNorm },
      create: {
        cedula: cedulaNorm,
        nombre,
        telefono,
        plan: plan || "Sin plan",
        direccion,
        sector,
        nodo: nodo || null,
        referencia: referencia || null,
      },
      update: {
        nombre,
        telefono,
        plan: plan || "Sin plan",
        direccion,
        sector,
        nodo: nodo || null,
        referencia: referencia || null,
      },
    });
  }

  return NextResponse.json({ cliente });
}
