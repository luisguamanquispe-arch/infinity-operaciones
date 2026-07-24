-- CreateTable
CREATE TABLE "AppClienteSpeedTest" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "pingMs" DOUBLE PRECISION,
    "downloadMbps" DOUBLE PRECISION NOT NULL,
    "uploadMbps" DOUBLE PRECISION NOT NULL,
    "planMbps" INTEGER,
    "calidad" TEXT NOT NULL,
    "servidor" TEXT NOT NULL DEFAULT 'infinity-soporte',
    "plataforma" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppClienteSpeedTest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AppClienteSpeedTest_clienteId_createdAt_idx" ON "AppClienteSpeedTest"("clienteId", "createdAt");

-- AddForeignKey
ALTER TABLE "AppClienteSpeedTest" ADD CONSTRAINT "AppClienteSpeedTest_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
