import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CameraGatewayConfigService } from './camera-gateway.config';

describe('CameraGatewayConfigService', () => {
  let service: CameraGatewayConfigService;
  let configService: { get: jest.Mock };

  beforeEach(async () => {
    configService = { get: jest.fn().mockReturnValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CameraGatewayConfigService,
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<CameraGatewayConfigService>(
      CameraGatewayConfigService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('defaults', () => {
    it('returns an empty allowlist when unset', () => {
      expect(service.ipAllowlist).toEqual([]);
    });

    it('defaults pilotAutoRegisterEnabled to false', () => {
      expect(service.pilotAutoRegisterEnabled).toBe(false);
    });

    it('defaults maxBodyMb to 8', () => {
      expect(service.maxBodyMb).toBe(8);
    });

    it('defaults rateLimitPerMinute to 60', () => {
      expect(service.rateLimitPerMinute).toBe(60);
    });

    it('defaults rawRetentionDays to 14', () => {
      expect(service.rawRetentionDays).toBe(14);
    });

    it('defaults ingestionSlaMs to 300', () => {
      expect(service.ingestionSlaMs).toBe(300);
    });
  });

  describe('parsing configured values', () => {
    it('parses a comma-separated allowlist and trims whitespace', () => {
      configService.get.mockReturnValue('10.0.0.1/32, 192.168.1.0/24 ,');
      expect(service.ipAllowlist).toEqual(['10.0.0.1/32', '192.168.1.0/24']);
    });

    it('parses pilotAutoRegisterEnabled=true', () => {
      configService.get.mockReturnValue('true');
      expect(service.pilotAutoRegisterEnabled).toBe(true);
    });

    it('falls back to the default for a non-numeric value', () => {
      configService.get.mockReturnValue('not-a-number');
      expect(service.maxBodyMb).toBe(8);
    });

    it('falls back to the default for a zero or negative value', () => {
      configService.get.mockReturnValue('-5');
      expect(service.rateLimitPerMinute).toBe(60);
    });

    it('parses a valid numeric override', () => {
      configService.get.mockReturnValue('30');
      expect(service.rawRetentionDays).toBe(30);
    });
  });
});
