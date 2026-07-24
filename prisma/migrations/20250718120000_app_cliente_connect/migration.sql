-- AlterEnum
ALTER TYPE "Rol" ADD VALUE 'CLIENTE';

-- CreateTable
CREATE TABLE "AppClienteCuenta" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppClienteCuenta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppClienteRefreshToken" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppClienteRefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AppClienteCuenta_usuarioId_key" ON "AppClienteCuenta"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "AppClienteCuenta_clienteId_key" ON "AppClienteCuenta"("clienteId");

-- CreateIndex
CREATE UNIQUE INDEX "AppClienteRefreshToken_tokenHash_key" ON "AppClienteRefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "AppClienteRefreshToken_usuarioId_idx" ON "AppClienteRefreshToken"("usuarioId");

-- CreateIndex
CREATE INDEX "AppClienteRefreshToken_expiresAt_idx" ON "AppClienteRefreshToken"("expiresAt");

-- AddForeignKey
ALTER TABLE "AppClienteCuenta" ADD CONSTRAINT "AppClienteCuenta_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppClienteCuenta" ADD CONSTRAINT "AppClienteCuenta_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppClienteRefreshToken" ADD CONSTRAINT "AppClienteRefreshToken_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
