-- Semáforo de tickets: PENDIENTE → LEIDO → EN_PROCESO → CERRADO
DO $$ BEGIN
  ALTER TYPE "EstadoTicket" ADD VALUE 'LEIDO';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
