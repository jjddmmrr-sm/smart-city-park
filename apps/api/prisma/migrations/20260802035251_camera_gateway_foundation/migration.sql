-- DropForeignKey
ALTER TABLE "cameras" DROP CONSTRAINT "cameras_cityId_fkey";

-- DropForeignKey
ALTER TABLE "cameras" DROP CONSTRAINT "cameras_tenantId_fkey";

-- DropIndex
DROP INDEX "cameras_tenantId_code_key";

-- AlterTable
ALTER TABLE "camera_events" DROP COLUMN "imageUrl",
ADD COLUMN     "detectionScope" TEXT NOT NULL,
ADD COLUMN     "idempotencyKey" TEXT NOT NULL,
ADD COLUMN     "parkingSpaceId" TEXT,
ADD COLUMN     "rawEventId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "cameras" ADD COLUMN     "authMode" TEXT NOT NULL DEFAULT 'ip_allowlist',
ADD COLUMN     "channel" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "deviceId" TEXT NOT NULL,
ADD COLUMN     "firmwareVersion" TEXT,
ADD COLUMN     "ipAddress" TEXT,
ADD COLUMN     "lastSeenAt" TIMESTAMP(3),
ADD COLUMN     "macAddress" TEXT,
ADD COLUMN     "manufacturer" TEXT,
ADD COLUMN     "model" TEXT,
ADD COLUMN     "registrationStatus" TEXT NOT NULL DEFAULT 'pending_review',
ALTER COLUMN "tenantId" DROP NOT NULL,
ALTER COLUMN "cityId" DROP NOT NULL,
ALTER COLUMN "code" DROP NOT NULL,
ALTER COLUMN "name" DROP NOT NULL;

-- CreateTable
CREATE TABLE "camera_events_raw" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "cameraId" TEXT,
    "deviceIdRaw" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "contextIp" TEXT NOT NULL,
    "contextHeaders" JSONB NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validationStatus" TEXT NOT NULL,
    "processingStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "processedAt" TIMESTAMP(3),
    "error" TEXT,

    CONSTRAINT "camera_events_raw_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "camera_snapshots" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "cameraEventId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "storageUrl" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "contentType" TEXT NOT NULL DEFAULT 'image/jpeg',
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "camera_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parking_space_status_history" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "previousStatus" TEXT NOT NULL,
    "newStatus" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceEventId" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "parking_space_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "cameraId" TEXT,
    "parkingSpaceId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "camera_events_raw_processingStatus_receivedAt_idx" ON "camera_events_raw"("processingStatus", "receivedAt");

-- CreateIndex
CREATE INDEX "camera_events_raw_tenantId_idx" ON "camera_events_raw"("tenantId");

-- CreateIndex
CREATE INDEX "camera_snapshots_cameraEventId_idx" ON "camera_snapshots"("cameraEventId");

-- CreateIndex
CREATE INDEX "camera_snapshots_tenantId_idx" ON "camera_snapshots"("tenantId");

-- CreateIndex
CREATE INDEX "parking_space_status_history_spaceId_changedAt_idx" ON "parking_space_status_history"("spaceId", "changedAt");

-- CreateIndex
CREATE INDEX "parking_space_status_history_tenantId_idx" ON "parking_space_status_history"("tenantId");

-- CreateIndex
CREATE INDEX "alerts_tenantId_status_idx" ON "alerts"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "camera_events_idempotencyKey_key" ON "camera_events"("idempotencyKey");

-- CreateIndex
CREATE INDEX "camera_events_tenantId_cityId_occurredAt_idx" ON "camera_events"("tenantId", "cityId", "occurredAt");

-- CreateIndex
CREATE INDEX "camera_events_parkingSpaceId_idx" ON "camera_events"("parkingSpaceId");

-- CreateIndex
CREATE UNIQUE INDEX "cameras_deviceId_key" ON "cameras"("deviceId");

-- CreateIndex
CREATE INDEX "cameras_tenantId_idx" ON "cameras"("tenantId");

-- CreateIndex
CREATE INDEX "cameras_tenantId_cityId_idx" ON "cameras"("tenantId", "cityId");

-- AddForeignKey
ALTER TABLE "cameras" ADD CONSTRAINT "cameras_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cameras" ADD CONSTRAINT "cameras_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "camera_events" ADD CONSTRAINT "camera_events_parkingSpaceId_fkey" FOREIGN KEY ("parkingSpaceId") REFERENCES "parking_spaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "camera_events" ADD CONSTRAINT "camera_events_rawEventId_fkey" FOREIGN KEY ("rawEventId") REFERENCES "camera_events_raw"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "camera_events_raw" ADD CONSTRAINT "camera_events_raw_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "camera_events_raw" ADD CONSTRAINT "camera_events_raw_cameraId_fkey" FOREIGN KEY ("cameraId") REFERENCES "cameras"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "camera_snapshots" ADD CONSTRAINT "camera_snapshots_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "camera_snapshots" ADD CONSTRAINT "camera_snapshots_cameraEventId_fkey" FOREIGN KEY ("cameraEventId") REFERENCES "camera_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parking_space_status_history" ADD CONSTRAINT "parking_space_status_history_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parking_space_status_history" ADD CONSTRAINT "parking_space_status_history_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parking_space_status_history" ADD CONSTRAINT "parking_space_status_history_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "parking_spaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_cameraId_fkey" FOREIGN KEY ("cameraId") REFERENCES "cameras"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_parkingSpaceId_fkey" FOREIGN KEY ("parkingSpaceId") REFERENCES "parking_spaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

