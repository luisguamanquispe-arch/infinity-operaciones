import { NextResponse } from "next/server";
import { filtrosDesdeUrl, paginaDesdeUrl, sesionSatisfaccion } from "@/lib/satisfaccion/http";
import { listarEncuestas } from "@/lib/satisfaccion/consultas";

export async function GET(request: Request) {
  const acceso = await sesionSatisfaccion("consulta");
  if (!acceso.ok) return acceso.response;
  const url = new URL(request.url);
  const { page, pageSize } = paginaDesdeUrl(url);
  const data = await listarEncuestas(filtrosDesdeUrl(url), page, pageSize);
  return NextResponse.json(data);
}
