-- Un técnico = máximo 1 asignación abierta (fechaFin IS NULL).
-- Complementa AsignacionVehiculo_abierta_uidx (un vehículo = máximo 1 abierta).
CREATE UNIQUE INDEX "AsignacionVehiculo_tecnico_abierta_uidx"
  ON "AsignacionVehiculo"("tecnicoId")
  WHERE "fechaFin" IS NULL;

-- Impide que kilometrajeActual retroceda aunque haya lecturas concurrentes.
CREATE OR REPLACE FUNCTION "vehiculo_kilometraje_no_retrocede"()
RETURNS trigger AS $$
BEGIN
  IF NEW."kilometrajeActual" < OLD."kilometrajeActual" THEN
    RAISE EXCEPTION 'El kilometraje registrado es inferior al último kilometraje registrado.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "vehiculo_kilometraje_no_retrocede_trg" ON "Vehiculo";
CREATE TRIGGER "vehiculo_kilometraje_no_retrocede_trg"
  BEFORE UPDATE OF "kilometrajeActual" ON "Vehiculo"
  FOR EACH ROW
  EXECUTE PROCEDURE "vehiculo_kilometraje_no_retrocede"();
