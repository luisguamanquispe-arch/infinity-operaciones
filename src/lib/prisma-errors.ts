/** Mensaje legible para errores Prisma en APIs. */
export function mensajeErrorPrisma(err: unknown): string {
  if (!err || typeof err !== "object") {
    return "Error de base de datos";
  }

  const code = "code" in err ? String(err.code) : "";
  const meta = "meta" in err && err.meta && typeof err.meta === "object" ? err.meta : null;
  const table =
    meta && "table" in meta && typeof meta.table === "string" ? meta.table : null;

  switch (code) {
    case "P2021":
      return table
        ? `Falta la tabla "${table}" en la base de datos. Ejecute las migraciones (prisma migrate deploy).`
        : "Faltan tablas en la base de datos. Ejecute las migraciones (prisma migrate deploy).";
    case "P2022":
      return "La base de datos no coincide con el esquema actual. Ejecute prisma migrate deploy.";
    case "P1001":
      return "No se puede conectar a la base de datos. Verifique DATABASE_URL en Render.";
    case "P1002":
      return "Tiempo de espera agotado al conectar con la base de datos.";
    default:
      break;
  }

  if ("message" in err && typeof err.message === "string") {
    return err.message;
  }

  return "Error de base de datos";
}
