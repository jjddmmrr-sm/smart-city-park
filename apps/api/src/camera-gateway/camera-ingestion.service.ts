import { Injectable } from '@nestjs/common';
import { CameraIngestionCoreService } from './core/services/camera-ingestion-core.service';
import type { IngestionAck } from './core/services/camera-ingestion-core.service';
import { DahuaProviderAdapter } from './providers/dahua/dahua-provider.adapter';

export type { IngestionAck };

/**
 * Thin orchestrator — see
 * docs/architecture/iot-device-management-foundation.md §4. Temporary
 * facade standing in for what will become each provider's own thin
 * controller once this class is retired. Owns the request-scoped
 * sequence below but contains zero business logic and zero direct
 * Prisma access — both live exclusively in the services it delegates to.
 *
 * The event-type hint passed to ingest() below (not
 * DahuaProviderAdapter.parseEvent()'s own shape-based classifier) is the
 * source of truth for which endpoint was hit — Nest already routes
 * deterministically to one of the 3 public methods here. The adapter's
 * classifier stays as a fallback/diagnostic tool, never load-bearing.
 */
@Injectable()
export class CameraIngestionService {
  constructor(
    private readonly core: CameraIngestionCoreService,
    private readonly dahuaAdapter: DahuaProviderAdapter,
  ) {}

  handleDeviceInfo(
    rawBody: Record<string, unknown>,
    ip: string,
    headers: Record<string, unknown>,
  ): Promise<IngestionAck> {
    return this.ingest(rawBody, ip, headers, 'DeviceInfo');
  }

  handleKeepAlive(
    rawBody: Record<string, unknown>,
    ip: string,
    headers: Record<string, unknown>,
  ): Promise<IngestionAck> {
    return this.ingest(rawBody, ip, headers, 'KeepAlive');
  }

  handleParkingInfo(
    rawBody: Record<string, unknown>,
    ip: string,
    headers: Record<string, unknown>,
  ): Promise<IngestionAck> {
    return this.ingest(rawBody, ip, headers, 'ParkingInfo');
  }

  private async ingest(
    rawBody: Record<string, unknown>,
    ip: string,
    headers: Record<string, unknown>,
    expectedEventType: string,
  ): Promise<IngestionAck> {
    const rawEvent = {
      ...this.dahuaAdapter.parseEvent(rawBody, headers, ip),
      externalEventType: expectedEventType,
    };

    const { id: rawEventId } = await this.core.captureRawEvent({
      deviceIdRaw: rawEvent.externalDeviceId,
      eventType: rawEvent.externalEventType,
      payload: rawEvent.payload,
      contextIp: ip,
      contextHeaders: headers,
    });

    const validation = this.dahuaAdapter.validate(rawEvent);
    if (!validation.valid) {
      await this.core.markRawInvalid(rawEventId, validation.errors);
      return { status: 'ok' };
    }

    const canonicalEvent = this.dahuaAdapter.normalize(rawEvent, rawEventId);
    return this.core.process(canonicalEvent);
  }
}
