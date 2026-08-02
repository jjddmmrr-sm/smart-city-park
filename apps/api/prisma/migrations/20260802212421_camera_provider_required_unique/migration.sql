-- Every existing camera already has providerId populated by
-- camera:backfill-provider (a data command, not embedded here — see
-- docs/architecture/iot-device-management-foundation.md). If that
-- command was never run in this environment, the NOT NULL below fails
-- loudly and the whole migration rolls back — no silent partial state.
ALTER TABLE "cameras" ALTER COLUMN "providerId" SET NOT NULL;

-- Global-unique deviceId is replaced by a provider-scoped uniqueness —
-- two different manufacturers may now report the same deviceId without
-- colliding.
DROP INDEX "cameras_deviceId_key";

CREATE UNIQUE INDEX "cameras_providerId_deviceId_key" ON "cameras"("providerId", "deviceId");

-- The FK was created back when providerId was optional (ON DELETE SET NULL).
-- Now that providerId is required, Prisma's default referential action for a
-- mandatory relation is RESTRICT — deleting a CameraProvider that still has
-- cameras must fail loudly, never silently null out a required column.
ALTER TABLE "cameras" DROP CONSTRAINT "cameras_providerId_fkey";
ALTER TABLE "cameras" ADD CONSTRAINT "cameras_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "camera_providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
