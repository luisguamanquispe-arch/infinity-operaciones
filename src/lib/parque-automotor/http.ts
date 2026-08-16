import { NextResponse } from "next/server";
import { errorUnicidadAsignacion, ParqueError } from "./servicio";

export function parqueFail(err: unknown) {
  if (err instanceof ParqueError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  const unique = errorUnicidadAsignacion(err);
  if (unique) {
    return NextResponse.json({ error: unique.message }, { status: unique.status });
  }
  console.error("[parque]", err);
  return NextResponse.json({ error: "Error interno" }, { status: 500 });
}
