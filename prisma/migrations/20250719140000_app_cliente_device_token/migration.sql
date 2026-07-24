-- CreateTable
CREATE TABLE "AppClienteDeviceToken" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "plataforma" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppClienteDeviceToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AppClienteDeviceToken_token_key" ON "AppClienteDeviceToken"("token");

-- CreateIndex
CREATE INDEX "AppClienteDeviceToken_usuarioId_idx" ON "AppClienteDeviceToken"("usuarioId");

-- AddForeignKey
ALTER TABLE "AppClienteDeviceToken" ADD CONSTRAINT "AppClienteDeviceToken_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
