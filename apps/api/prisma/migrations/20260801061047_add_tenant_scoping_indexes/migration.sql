-- CreateIndex
CREATE INDEX "audit_logs_tenantId_idx" ON "audit_logs"("tenantId");

-- CreateIndex
CREATE INDEX "enforcement_cases_tenantId_idx" ON "enforcement_cases"("tenantId");

-- CreateIndex
CREATE INDEX "fines_tenantId_idx" ON "fines"("tenantId");

-- CreateIndex
CREATE INDEX "inspectors_tenantId_idx" ON "inspectors"("tenantId");

-- CreateIndex
CREATE INDEX "parking_rates_tenantId_idx" ON "parking_rates"("tenantId");

-- CreateIndex
CREATE INDEX "parking_sessions_tenantId_idx" ON "parking_sessions"("tenantId");

-- CreateIndex
CREATE INDEX "parking_spaces_tenantId_idx" ON "parking_spaces"("tenantId");

-- CreateIndex
CREATE INDEX "parking_zones_tenantId_idx" ON "parking_zones"("tenantId");

-- CreateIndex
CREATE INDEX "payments_tenantId_idx" ON "payments"("tenantId");

-- CreateIndex
CREATE INDEX "users_tenantId_idx" ON "users"("tenantId");
