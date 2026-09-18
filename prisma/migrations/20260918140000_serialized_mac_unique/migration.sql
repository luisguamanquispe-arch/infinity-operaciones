-- Unique MAC allowing multiple NULLs (PostgreSQL UNIQUE treats NULL as distinct).
-- If this fails due to duplicate non-null MACs, clean data before applying.
CREATE UNIQUE INDEX IF NOT EXISTS "SerializedAsset_macAddress_key"
ON "SerializedAsset"("macAddress");
