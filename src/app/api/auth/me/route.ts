import { NextResponse } from "next/server";
import { getFullSession } from "@/lib/auth";
import { permisosClientes } from "@/lib/cliente-permisos";

export async function GET() {
  const session = await getFullSession();
  if (!session) {
    return NextResponse.json({ user: null }, { status: 401 });
  }
  return NextResponse.json({
    user: session,
    permisos: {
      clientes: permisosClientes(session.rol),
    },
  });
}
