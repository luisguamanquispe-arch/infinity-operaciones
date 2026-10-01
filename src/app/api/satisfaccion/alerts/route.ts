import { NextResponse } from "next/server";
import { paginaDesdeUrl, sesionSatisfaccion } from "@/lib/satisfaccion/http";
import { alertasInsatisfaccion } from "@/lib/satisfaccion/consultas";

export async function GET(request: Request) {
  const acceso = await sesionSatisfaccion("consulta");
  if (!acceso.ok) return acceso.response;
  const { page, pageSize } = paginaDesdeUrl(new URL(request.url));
  return NextResponse.json(await alertasInsatisfaccion(page, pageSize));
}
