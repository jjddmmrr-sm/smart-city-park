import { Module } from '@nestjs/common';
import { CameraGatewayConfigService } from './config/camera-gateway.config';
import { CameraGatewayLogger } from './logging/camera-gateway-logger.service';
import { CameraIngestionService } from './camera-ingestion.service';
import { DahuaIngestionController } from './providers/dahua/dahua-ingestion.controller';

/**
 * Camera Integration Gateway — Dahua ITSAPI.
 * Scope so far: DeviceInfo ingestion only — see DAHUA_IMPLEMENTATION_PLAN.md §16.
 * No JwtAuthGuard on DahuaIngestionController: cameras never present a Bearer token.
 */
@Module({
  controllers: [DahuaIngestionController],
  providers: [
    CameraGatewayConfigService,
    CameraGatewayLogger,
    CameraIngestionService,
  ],
  exports: [CameraGatewayConfigService, CameraGatewayLogger],
})
export class CameraGatewayModule {}
