import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CameraGatewayConfigService {
  constructor(private readonly configService: ConfigService) {}

  get ipAllowlist(): string[] {
    return this.parseList(this.configService.get<string>('DAHUA_IP_ALLOWLIST'));
  }

  get pilotAutoRegisterEnabled(): boolean {
    return (
      this.configService.get<string>('DAHUA_PILOT_AUTOREGISTER_ENABLED') ===
      'true'
    );
  }

  get maxBodyMb(): number {
    return this.parseNumber(
      this.configService.get<string>('DAHUA_MAX_BODY_MB'),
      8,
    );
  }

  get rateLimitPerMinute(): number {
    return this.parseNumber(
      this.configService.get<string>('DAHUA_RATE_LIMIT_PER_MINUTE'),
      60,
    );
  }

  get rawRetentionDays(): number {
    return this.parseNumber(
      this.configService.get<string>('DAHUA_RAW_RETENTION_DAYS'),
      14,
    );
  }

  get ingestionSlaMs(): number {
    return this.parseNumber(
      this.configService.get<string>('DAHUA_INGESTION_SLA_MS'),
      300,
    );
  }

  private parseList(raw: string | undefined): string[] {
    return (raw ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
  }

  private parseNumber(raw: string | undefined, fallback: number): number {
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }
}
