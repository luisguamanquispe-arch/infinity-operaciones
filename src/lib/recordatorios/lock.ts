import type { Prisma, PrismaClient } from "@prisma/client";

/**
 * Lock transaccional (pg_try_advisory_xact_lock), no de sesión.
 *
 * Prisma no expone una conexión dedicada del pool. Un lock de sesión
 * (pg_advisory_lock) adquirido con $queryRaw se queda en esa sesión cuando
 * la conexión vuelve al pool, y el unlock puede ejecutarse en otra.
 *
 * pg_try_advisory_xact_lock vive solo dentro de la transacción interactiva
 * de Prisma, que sí usa una sola conexión para el callback. Se libera solo
 * al COMMIT o ROLLBACK (incluido un throw). No hay que llamar unlock.
 */
export const RECORDATORIO_LOCK_KEY = 87231021;

export class RecordatorioLockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RecordatorioLockError";
  }
}

export type ResultadoLock<T> =
  | { acquired: false }
  | { acquired: true; value: T };

export function lockAdquirido(rows: unknown): boolean {
  if (!Array.isArray(rows) || rows.length === 0) return false;
  const v = (rows[0] as { locked?: unknown } | null)?.locked;
  return v === true || v === "t" || v === "true";
}

type DbConTransaccion = {
  $transaction: PrismaClient["$transaction"];
};

export async function withRecordatorioLock<T>(
  db: DbConTransaccion,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  opts?: { timeout?: number; maxWait?: number }
): Promise<ResultadoLock<T>> {
  return db.$transaction(
    async (tx) => {
      let rows: unknown;
      try {
        rows = await tx.$queryRawUnsafe(
          `SELECT pg_try_advisory_xact_lock(${RECORDATORIO_LOCK_KEY}) AS locked`
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message.slice(0, 180) : "error";
        throw new RecordatorioLockError(
          `No se pudo adquirir el lock de recordatorios: ${msg}`
        );
      }
      if (!lockAdquirido(rows)) {
        return { acquired: false } as ResultadoLock<T>;
      }
      const value = await fn(tx);
      return { acquired: true, value };
    },
    {
      maxWait: opts?.maxWait ?? 5_000,
      timeout: opts?.timeout ?? 55_000,
    }
  );
}
