import { NextResponse } from "next/server";
import { sesionSatisfaccion } from "@/lib/satisfaccion/http";
import { comparativoMensual } from "@/lib/satisfaccion/consultas";

export async function GET() {
  const acceso = await sesionSatisfaccion("consulta");
  if (!acceso.ok) return acceso.response;
  return NextResponse.json(await comparativoMensual());
}
