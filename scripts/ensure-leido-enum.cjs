/**
 * Asegura el valor LEIDO en el enum EstadoTicket (semáforo).
 * No toca _prisma_migrations (evita desfase de checksums).
 */
const { PrismaClient } = require("@prisma/client");

async function ensureLeidoEnum() {
  if (!process.env.DATABASE_URL) {
    console.warn("[schema] DATABASE_URL ausente — omitiendo ensure LEIDO.");
    return { ok: false, reason: "no_database_url" };
  }

  const prisma = new PrismaClient();
  try {
    const rows = await prisma.$queryRawUnsafe(`
      SELECT e.enumlabel AS label
      FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = 'EstadoTicket'
      ORDER BY e.enumsortorder
    `);
    const labels = (rows || []).map((r) => r.label);
    console.log(`[schema] EstadoTicket: ${labels.join(", ") || "(vacío)"}`);

    if (!labels.includes("LEIDO")) {
      console.log("[schema] Agregando LEIDO...");
      try {
        await prisma.$executeRawUnsafe(
          `ALTER TYPE "EstadoTicket" ADD VALUE IF NOT EXISTS 'LEIDO'`
        );
      } catch (err) {
        // PG < 15 sin IF NOT EXISTS
        await prisma.$executeRawUnsafe(`
          DO $$ BEGIN
            ALTER TYPE "EstadoTicket" ADD VALUE 'LEIDO';
          EXCEPTION
            WHEN duplicate_object THEN NULL;
          END $$;
        `);
      }
    }

    const verify = await prisma.$queryRawUnsafe(`
      SELECT 1 AS ok
      FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = 'EstadoTicket' AND e.enumlabel = 'LEIDO'
      LIMIT 1
    `);
    const ok = Array.isArray(verify) && verify.length > 0;
    console.log(`[schema] enum LEIDO listo: ${ok}`);
    return { ok, labels: ok ? [...new Set([...labels, "LEIDO"])] : labels };
  } catch (err) {
    console.error("[schema] Error asegurando LEIDO:", err?.message || err);
    return { ok: false, reason: String(err?.message || err) };
  } finally {
    await prisma.$disconnect();
  }
}

module.exports = { ensureLeidoEnum };

if (require.main === module) {
  ensureLeidoEnum().then((r) => {
    if (!r.ok) process.exitCode = 1;
  });
}
