-- AlterTable
ALTER TABLE "cameras" ADD COLUMN     "gatewayId" TEXT,
ADD COLUMN     "groupId" TEXT,
ADD COLUMN     "providerId" TEXT;

-- CreateTable
CREATE TABLE "camera_providers" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "protocol" TEXT NOT NULL,
    "capabilities" JSONB NOT NULL,
    "defaultAuthMode" TEXT NOT NULL,
    "endpointTemplates" JSONB NOT NULL,
    "documentationUrl" TEXT,
    "supportUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "camera_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "camera_gateways" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "protocol" TEXT NOT NULL,
    "publicBaseUrl" TEXT NOT NULL,
    "privateBaseUrl" TEXT,
    "basePath" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "camera_gateways_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "camera_groups" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "zoneId" TEXT,
    "gatewayId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "camera_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "camera_stall_mappings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "cameraId" TEXT NOT NULL,
    "externalStallCode" TEXT NOT NULL,
    "parkingSpaceId" TEXT,
    "mappingStatus" TEXT NOT NULL DEFAULT 'DISCOVERED',
    "firstReportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "camera_stall_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "camera_providers_code_key" ON "camera_providers"("code");

-- CreateIndex
CREATE INDEX "camera_gateways_providerId_idx" ON "camera_gateways"("providerId");

-- CreateIndex
CREATE INDEX "camera_groups_tenantId_idx" ON "camera_groups"("tenantId");

-- CreateIndex
CREATE INDEX "camera_groups_cityId_idx" ON "camera_groups"("cityId");

-- CreateIndex
CREATE INDEX "camera_stall_mappings_parkingSpaceId_idx" ON "camera_stall_mappings"("parkingSpaceId");

-- CreateIndex
CREATE INDEX "camera_stall_mappings_mappingStatus_idx" ON "camera_stall_mappings"("mappingStatus");

-- CreateIndex
CREATE INDEX "camera_stall_mappings_tenantId_idx" ON "camera_stall_mappings"("tenantId");

-- CreateIndex
CREATE INDEX "camera_stall_mappings_cityId_idx" ON "camera_stall_mappings"("cityId");

-- CreateIndex
CREATE UNIQUE INDEX "camera_stall_mappings_cameraId_externalStallCode_key" ON "camera_stall_mappings"("cameraId", "externalStallCode");

-- CreateIndex
CREATE INDEX "cameras_providerId_idx" ON "cameras"("providerId");

-- CreateIndex
CREATE INDEX "cameras_gatewayId_idx" ON "cameras"("gatewayId");

-- CreateIndex
CREATE INDEX "cameras_groupId_idx" ON "cameras"("groupId");

-- AddForeignKey
ALTER TABLE "camera_gateways" ADD CONSTRAINT "camera_gateways_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "camera_providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "camera_groups" ADD CONSTRAINT "camera_groups_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "camera_groups" ADD CONSTRAINT "camera_groups_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "camera_groups" ADD CONSTRAINT "camera_groups_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "parking_zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "camera_groups" ADD CONSTRAINT "camera_groups_gatewayId_fkey" FOREIGN KEY ("gatewayId") REFERENCES "camera_gateways"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cameras" ADD CONSTRAINT "cameras_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "camera_providers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cameras" ADD CONSTRAINT "cameras_gatewayId_fkey" FOREIGN KEY ("gatewayId") REFERENCES "camera_gateways"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cameras" ADD CONSTRAINT "cameras_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "camera_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "camera_stall_mappings" ADD CONSTRAINT "camera_stall_mappings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "camera_stall_mappings" ADD CONSTRAINT "camera_stall_mappings_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "camera_stall_mappings" ADD CONSTRAINT "camera_stall_mappings_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "parking_zones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "camera_stall_mappings" ADD CONSTRAINT "camera_stall_mappings_cameraId_fkey" FOREIGN KEY ("cameraId") REFERENCES "cameras"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "camera_stall_mappings" ADD CONSTRAINT "camera_stall_mappings_parkingSpaceId_fkey" FOREIGN KEY ("parkingSpaceId") REFERENCES "parking_spaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Manual addition — NOT generated by Prisma. Partial unique indexes are
-- not representable in schema.prisma, so this line was added by hand to
-- this migration file after `prisma migrate dev --create-only`.
--
-- Enforces at the database level (not just in application code) that at
-- most one CameraStallMapping with mappingStatus='ACTIVE' can exist per
-- parkingSpaceId — approved as a domain integrity rule for Commit 5
-- ("una sola relación activa según el diseño"). Postgres partial unique
-- indexes only constrain rows matching the WHERE clause: any number of
-- DISCOVERED/MAPPED/DISABLED/CONFLICT mappings may still point at the
-- same parking space, and NULL parkingSpaceId values are never
-- constrained by a unique index (Postgres treats each NULL as distinct).
CREATE UNIQUE INDEX "camera_stall_mappings_active_parking_space_key"
ON "camera_stall_mappings" ("parkingSpaceId")
WHERE "mappingStatus" = 'ACTIVE';
