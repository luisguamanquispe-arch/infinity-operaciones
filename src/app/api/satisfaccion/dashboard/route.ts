import { NextResponse } from "next/server";
import { filtrosDesdeUrl, sesionSatisfaccion } from "@/lib/satisfaccion/http";
import { dashboardSatisfaccion } from "@/lib/satisfaccion/consultas";

export async function GET(request: Request) {
  const acceso = await sesionSatisfaccion("consulta");
  if (!acceso.ok) return acceso.response;
  const data = await dashboardSatisfaccion(filtrosDesdeUrl(new URL(request.url)));
  return NextResponse.json(data);
}
