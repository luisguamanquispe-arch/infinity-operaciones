-- Paso 1: nuevos valores de enum (deben commitearse antes de usarlos)
ALTER TYPE "SrEstado" ADD VALUE 'ESCALADO';
ALTER TYPE "SrTipoSoporte" ADD VALUE 'SIN_INTERNET';
ALTER TYPE "SrTipoSoporte" ADD VALUE 'INTERNET_LENTO';
ALTER TYPE "SrTipoAdjunto" ADD VALUE 'DOCUMENTO';
