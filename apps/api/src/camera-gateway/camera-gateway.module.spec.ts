import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { CameraGatewayModule } from './camera-gateway.module';
import { CameraGatewayConfigService } from './config/camera-gateway.config';
import { CameraGatewayLogger } from './logging/camera-gateway-logger.service';
import { CameraIngestionService } from './camera-ingestion.service';
import { CameraIngestionCoreService } from './core/services/camera-ingestion-core.service';
import { DahuaIngestionController } from './providers/dahua/dahua-ingestion.controller';
import { DahuaProviderAdapter } from './providers/dahua/dahua-provider.adapter';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';

describe('CameraGatewayModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        PrismaModule,
        CameraGatewayModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();
  });

  it('provides CameraGatewayConfigService', () => {
    expect(module.get(CameraGatewayConfigService)).toBeDefined();
  });

  it('provides CameraGatewayLogger', () => {
    expect(module.get(CameraGatewayLogger)).toBeDefined();
  });

  it('provides CameraIngestionCoreService', () => {
    expect(module.get(CameraIngestionCoreService)).toBeDefined();
  });

  it('provides DahuaProviderAdapter', () => {
    expect(module.get(DahuaProviderAdapter)).toBeDefined();
  });

  it('provides CameraIngestionService, injected via DI (not manually constructed)', () => {
    const service = module.get(CameraIngestionService);
    expect(service).toBeDefined();
    expect(service).toBeInstanceOf(CameraIngestionService);
  });

  it('registers DahuaIngestionController', () => {
    expect(module.get(DahuaIngestionController)).toBeDefined();
  });
});
