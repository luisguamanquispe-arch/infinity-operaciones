/**
 * Elimina técnicos Carlos Mendoza y Juan Pérez sin borrar tickets.
 *
 * Uso:
 *   npm run db:eliminar-tecnicos
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { PrismaClient } from "@prisma/client";
import { eliminarTecnicosPrueba } from "../src/lib/eliminar-tecnicos-db";

function loadEnv() {
  const envPath = resolve(__dirname, "../.env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (process.env[key]) continue;
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (
      key === "DATABASE_URL" &&
      val &&
      !val.startsWith("postgresql://") &&
      !val.startsWith("postgres://")
    ) {
      continue;
    }
    process.env[key] = val;
  }
}

loadEnv();

const prisma = new PrismaClient();

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL no configurada. Usa la External Database URL de Render en .env o ejecuta scripts/eliminar-tecnicos-render.ps1"
    );
  }

  const result = await eliminarTecnicosPrueba(prisma);

  if (result.total === 0) {
    console.log("No se encontraron técnicos Carlos Mendoza ni Juan Pérez.");
    return;
  }

  console.log(`Eliminados ${result.total} técnico(s):`);
  for (const e of result.eliminados) {
    console.log(`  - ${e.label} (tickets desvinculados: ${e.ticketsDesvinculados})`);
  }
  console.log("Listo.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
