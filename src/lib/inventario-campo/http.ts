import { NextResponse } from "next/server";
import { InventarioCampoError } from "./servicio";

export function inventarioFail(err: unknown) {
  if (err instanceof InventarioCampoError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error("[inventario-campo]", err);
  return NextResponse.json({ error: "Error interno" }, { status: 500 });
}
