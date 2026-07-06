-- AlterTable Cliente: timestamps
ALTER TABLE "Cliente" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Cliente" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable HistorialCliente
CREATE TABLE IF NOT EXISTS "HistorialCliente" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "usuarioId" TEXT,
    "accion" TEXT NOT NULL,
    "cambiosJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistorialCliente_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "HistorialCliente_clienteId_createdAt_idx" ON "HistorialCliente"("clienteId", "createdAt");

ALTER TABLE "HistorialCliente" DROP CONSTRAINT IF EXISTS "HistorialCliente_clienteId_fkey";
ALTER TABLE "HistorialCliente" ADD CONSTRAINT "HistorialCliente_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HistorialCliente" DROP CONSTRAINT IF EXISTS "HistorialCliente_usuarioId_fkey";
ALTER TABLE "HistorialCliente" ADD CONSTRAINT "HistorialCliente_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
