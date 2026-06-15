-- CreateEnum
CREATE TYPE "TipoConexionInstalacion" AS ENUM ('IP', 'PPPOE');

-- AlterTable
ALTER TABLE "OrdenServicio" ADD COLUMN "tipoConexionInstalacion" "TipoConexionInstalacion";
ALTER TABLE "OrdenServicio" ADD COLUMN "direccionIp" TEXT;
ALTER TABLE "OrdenServicio" ADD COLUMN "pppoeUsuario" TEXT;
ALTER TABLE "OrdenServicio" ADD COLUMN "pppoeClave" TEXT;
ALTER TABLE "OrdenServicio" ADD COLUMN "nombreRedWifi" TEXT;
ALTER TABLE "OrdenServicio" ADD COLUMN "claveRedWifi" TEXT;
