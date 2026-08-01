import { NextResponse } from "next/server";

const MSG =
  "Soporte remoto por chat desactivado. Contacte a Infinity Internet por teléfono u oficina.";

export async function GET() {
  return NextResponse.json({ error: MSG, disabled: true }, { status: 503 });
}

export async function POST() {
  return NextResponse.json({ error: MSG, disabled: true }, { status: 503 });
}
