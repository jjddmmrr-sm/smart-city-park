import { Injectable } from '@nestjs/common';
import { CameraIngestionCoreService } from './core/services/camera-ingestion-core.service';
import type { IngestionAck } from './core/services/camera-ingestion-core.service';
import { DahuaProviderAdapter } from './providers/dahua/dahua-provider.adapter';

export type { IngestionAck };

/**
 * ITSAPI handshake ack for DeviceInfo — Dahua hardware (see
 * smartpark-dahua-reference/docs/payloads-reales.md) expects its own
 * Result/Message/DeviceID vocabulary here, not the generic IngestionAck
 * used by KeepAlive/ParkingInfo. Result is always true: this only
 * reports that the handshake was received, the same "always ok"
 * contract the generic ack already had — it does not encode
 * registrationStatus/tenant approval.
 */
export interface DeviceInfoAckResponse {
  Result: boolean;
  Message: string;
  DeviceID: string;
}

/**
 * Same ITSAPI Result/Message/DeviceID contract as DeviceInfoAckResponse,
 * now also used for ParkingInfo — see
 * smartpark-dahua-reference/docs/payloads-reales.md. The generic
 * IngestionAck ({status:'ok'}) wasn't recognized by the camera's firmware,
 * which kept resubmitting the same SnapTime/snapshot every ~1.2s instead
 * of advancing. KeepAlive is untouched — no retry behavior was observed
 * there.
 */
export type ParkingInfoAckResponse = DeviceInfoAckResponse;

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

  async handleDeviceInfo(
    rawBody: Record<string, unknown>,
    ip: string,
    headers: Record<string, unknown>,
  ): Promise<DeviceInfoAckResponse> {
    const { externalDeviceId } = await this.ingest(
      rawBody,
      ip,
      headers,
      'DeviceInfo',
    );
    return {
      Result: true,
      Message: 'DeviceInfo recibido y autorizado',
      DeviceID: externalDeviceId,
    };
  }

  async handleKeepAlive(
    rawBody: Record<string, unknown>,
    ip: string,
    headers: Record<string, unknown>,
  ): Promise<IngestionAck> {
    const { ack } = await this.ingest(rawBody, ip, headers, 'KeepAlive');
    return ack;
  }

  async handleParkingInfo(
    rawBody: Record<string, unknown>,
    ip: string,
    headers: Record<string, unknown>,
  ): Promise<ParkingInfoAckResponse> {
    const { externalDeviceId } = await this.ingest(
      rawBody,
      ip,
      headers,
      'ParkingInfo',
    );
    return {
      Result: true,
      Message: 'ParkingInfo recibido y procesado',
      DeviceID: externalDeviceId,
    };
  }

  /**
   * Same Result/Message/DeviceID ITSAPI ack contract as ParkingInfo —
   * applied preventively here too, since the generic {status:'ok'} ack was
   * the exact cause of ParkingInfo's firmware retry-storm bug (see
   * ParkingInfoAckResponse above) and both endpoints belong to the same
   * ITSAPI firmware family.
   */
  async handleTimedParkingSpaceInfo(
    rawBody: Record<string, unknown>,
    ip: string,
    headers: Record<string, unknown>,
  ): Promise<ParkingInfoAckResponse> {
    const { externalDeviceId } = await this.ingest(
      rawBody,
      ip,
      headers,
      'TimedParkingSpaceInfo',
    );
    return {
      Result: true,
      Message: 'TimedParkingSpaceInfo recibido y procesado',
      DeviceID: externalDeviceId,
    };
  }

  private async ingest(
    rawBody: Record<string, unknown>,
    ip: string,
    headers: Record<string, unknown>,
    expectedEventType: string,
  ): Promise<{ ack: IngestionAck; externalDeviceId: string }> {
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
      return {
        ack: { status: 'ok' },
        externalDeviceId: rawEvent.externalDeviceId,
      };
    }

    const canonicalEvent = this.dahuaAdapter.normalize(rawEvent, rawEventId);
    const ack = await this.core.process(canonicalEvent);
    return { ack, externalDeviceId: rawEvent.externalDeviceId };
  }
}
