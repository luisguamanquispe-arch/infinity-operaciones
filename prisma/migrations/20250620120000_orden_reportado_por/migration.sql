-- Técnico que registró y cerró el reporte (tickets multi-técnico)
ALTER TABLE "OrdenServicio" ADD COLUMN "reportadoPorTecnicoId" TEXT;
ALTER TABLE "OrdenServicio" ADD COLUMN "reportadoEn" TIMESTAMP(3);

ALTER TABLE "OrdenServicio"
  ADD CONSTRAINT "OrdenServicio_reportadoPorTecnicoId_fkey"
  FOREIGN KEY ("reportadoPorTecnicoId") REFERENCES "Tecnico"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
