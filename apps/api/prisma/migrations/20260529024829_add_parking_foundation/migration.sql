-- CreateTable
CREATE TABLE "parking_zones" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parking_zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parking_spaces" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT,
    "type" TEXT NOT NULL DEFAULT 'vehicle',
    "status" TEXT NOT NULL DEFAULT 'available',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parking_spaces_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "parking_zones_cityId_code_key" ON "parking_zones"("cityId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "parking_spaces_zoneId_code_key" ON "parking_spaces"("zoneId", "code");

-- AddForeignKey
ALTER TABLE "parking_zones" ADD CONSTRAINT "parking_zones_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parking_zones" ADD CONSTRAINT "parking_zones_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parking_spaces" ADD CONSTRAINT "parking_spaces_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parking_spaces" ADD CONSTRAINT "parking_spaces_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parking_spaces" ADD CONSTRAINT "parking_spaces_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "parking_zones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
