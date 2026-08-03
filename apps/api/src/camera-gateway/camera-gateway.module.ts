import { Module } from '@nestjs/common';
import { CameraGatewayConfigService } from './config/camera-gateway.config';
import { CameraGatewayLogger } from './logging/camera-gateway-logger.service';
import { CameraIngestionService } from './camera-ingestion.service';
import { CameraIngestionCoreService } from './core/services/camera-ingestion-core.service';
import { DahuaIngestionController } from './providers/dahua/dahua-ingestion.controller';
import { DahuaProviderAdapter } from './providers/dahua/dahua-provider.adapter';

/**
 * Camera Integration Gateway — Dahua ITSAPI, first of possibly several
 * provider adapters — see
 * docs/architecture/iot-device-management-foundation.md.
 * No JwtAuthGuard on DahuaIngestionController: cameras never present a Bearer token.
 */
@Module({
  controllers: [DahuaIngestionController],
  providers: [
    CameraGatewayConfigService,
    CameraGatewayLogger,
    CameraIngestionCoreService,
    DahuaProviderAdapter,
    CameraIngestionService,
  ],
  exports: [CameraGatewayConfigService, CameraGatewayLogger],
})
export class CameraGatewayModule {}
