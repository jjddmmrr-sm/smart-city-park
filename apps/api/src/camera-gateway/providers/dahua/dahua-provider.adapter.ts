import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { plainToInstance } from 'class-transformer';
import { validateSync, ValidationError } from 'class-validator';
import type {
  CameraProviderAdapter,
  CameraProviderAuthStrategy,
  CameraProviderCapability,
  CameraProviderValidationResult,
  ProviderRawEvent,
  ResolvedCameraContext,
} from '../../core/contracts/camera-provider-adapter.interface';
import type { CanonicalCameraEvent } from '../../core/contracts/canonical-camera-event';
import { isCanonicalParkingStatus } from '../../core/contracts/canonical-camera-event';
import { DeviceInfoDto } from './dto/device-info.dto';
import { KeepAliveDto } from './dto/keep-alive.dto';
import { ParkingInfoDto } from './dto/parking-info.dto';
import {
  computeIdempotencyKey as computeDahuaOccupancyIdempotencyKey,
  normalizeParkingInfo,
  parseSnapTime,
} from './normalizer';
import type { DahuaOccupancyStatus } from './types';

type DahuaExternalEventType = 'DeviceInfo' | 'KeepAlive' | 'ParkingInfo';

const DEVICE_IDENTITY_FIELDS = [
  'DeviceModel',
  'DeviceName',
  'DeviceType',
  'IPAddress',
  'IPv6Address',
  'MACAddress',
  'Manufacturer',
] as const;

/**
 * Dahua's DeviceInfo and KeepAlive share the exact same envelope shape
 * (both carry only DeviceID at the root — see dto/keep-alive.dto.ts).
 * The route the camera hits is what actually disambiguates them on real
 * hardware; this classifier is only used inside this adapter's own
 * parseEvent()/tests, not by the live controller yet (see commit scope).
 * It relies on evidence, not guesswork: every real DeviceInfo payload
 * observed (test/dahua/payloads/DeviceInfo.json,
 * smartpark-dahua-reference/docs/payloads-reales.md) carries at least
 * one identity field beyond DeviceID; every real KeepAlive payload
 * carries none.
 */
function classifyDahuaEvent(
  body: Record<string, unknown>,
): DahuaExternalEventType {
  const picture = body.Picture as Record<string, unknown> | undefined;
  if (picture && typeof picture === 'object' && 'ParkingInfo' in picture) {
    return 'ParkingInfo';
  }
  const hasDeviceIdentityFields = DEVICE_IDENTITY_FIELDS.some(
    (key) => key in body,
  );
  return hasDeviceIdentityFields ? 'DeviceInfo' : 'KeepAlive';
}

function extractBestEffortDeviceId(
  body: Record<string, unknown>,
  eventType: DahuaExternalEventType,
): string {
  if (eventType === 'ParkingInfo') {
    const picture = body.Picture as Record<string, unknown> | undefined;
    const parkingInfo = picture?.ParkingInfo as
      | Record<string, unknown>
      | undefined;
    return typeof parkingInfo?.DeviceID === 'string'
      ? parkingInfo.DeviceID
      : '';
  }
  return typeof body.DeviceID === 'string' ? body.DeviceID : '';
}

function flattenValidationErrors(
  errors: ValidationError[],
  fallbackIfNone?: string,
): string[] {
  const messages = errors.flatMap((error) =>
    Object.values(error.constraints ?? {}),
  );
  if (messages.length === 0 && fallbackIfNone) {
    return [fallbackIfNone];
  }
  return messages;
}

/**
 * AVAILABLE is canonical; Dahua's own DahuaOccupancyStatus uses FREE.
 * This is the single place that translation happens — see
 * core/contracts/canonical-camera-event.ts.
 */
function translateOccupancyStatus(
  status: DahuaOccupancyStatus | undefined,
): CanonicalCameraEvent['parkingStatus'] {
  if (!status) {
    return 'UNKNOWN';
  }
  if (status === 'FREE') {
    return 'AVAILABLE';
  }
  return isCanonicalParkingStatus(status) ? status : 'UNKNOWN';
}

/**
 * Dahua ITSAPI provider adapter — see
 * docs/architecture/iot-device-management-foundation.md §3.
 *
 * Exclusively responsible for Dahua DTOs, parsing, validation,
 * ParkingStatus/DeviceID/ParkingStallsNo/SnapTime translation, Dahua's
 * idempotency formula, and normalization to CanonicalCameraEvent.
 *
 * Deliberately does NOT: import Prisma, update ParkingSpace, write
 * ParkingSpaceStatusHistory, resolve tenantId/cityId/zoneId, create
 * CameraEvent, or know anything about business logic or other
 * providers — that all remains in CameraIngestionService today, and
 * moves to CameraIngestionCoreService in a later commit.
 *
 * Not yet wired into the live request flow — DahuaIngestionController
 * still calls CameraIngestionService directly (see commit scope).
 */
@Injectable()
export class DahuaProviderAdapter implements CameraProviderAdapter {
  readonly code = 'DAHUA_ITSAPI';

  /**
   * headers/ip are part of the CameraProviderAdapter contract (a future
   * provider may need them, e.g. for Digest auth) but Dahua's own
   * classifier only needs the body — kept as named parameters instead of
   * shrinking the signature so it stays self-documenting against the
   * interface and doesn't need to change when this is wired to the live
   * controller in a later commit.
   */
  parseEvent(
    rawBody: unknown,
    headers: Record<string, unknown>,
    ip: string,
  ): ProviderRawEvent {
    void headers;
    void ip;
    const body = (rawBody ?? {}) as Record<string, unknown>;
    const externalEventType = classifyDahuaEvent(body);
    return {
      externalDeviceId: extractBestEffortDeviceId(body, externalEventType),
      externalEventType,
      payload: rawBody,
    };
  }

  validate(rawEvent: ProviderRawEvent): CameraProviderValidationResult {
    switch (rawEvent.externalEventType as DahuaExternalEventType) {
      case 'DeviceInfo': {
        const dto = this.toDeviceInfoDto(rawEvent.payload);
        const errors = validateSync(dto);
        const valid = errors.length === 0 && !!dto.DeviceID;
        return {
          valid,
          errors: flattenValidationErrors(
            errors,
            !dto.DeviceID ? 'DeviceID missing' : undefined,
          ),
        };
      }
      case 'KeepAlive': {
        const dto = this.toKeepAliveDto(rawEvent.payload);
        const errors = validateSync(dto);
        const valid = errors.length === 0 && !!dto.DeviceID;
        return {
          valid,
          errors: flattenValidationErrors(
            errors,
            !dto.DeviceID ? 'DeviceID missing' : undefined,
          ),
        };
      }
      case 'ParkingInfo': {
        const dto = this.toParkingInfoDto(rawEvent.payload);
        const errors = validateSync(dto);
        const block = dto.Picture?.ParkingInfo;
        const missingRequired =
          !block?.DeviceID ||
          block.ParkingStatus === undefined ||
          block.ParkingStatus === null;
        return {
          valid: errors.length === 0 && !missingRequired,
          errors: flattenValidationErrors(
            errors,
            missingRequired ? 'DeviceID or ParkingStatus missing' : undefined,
          ),
        };
      }
      default:
        return {
          valid: false,
          errors: [`Unknown Dahua event type: ${rawEvent.externalEventType}`],
        };
    }
  }

  resolveDeviceIdentifier(rawEvent: ProviderRawEvent): string {
    switch (rawEvent.externalEventType as DahuaExternalEventType) {
      case 'ParkingInfo':
        return (
          this.toParkingInfoDto(rawEvent.payload).Picture?.ParkingInfo
            ?.DeviceID ?? ''
        );
      case 'DeviceInfo':
        return this.toDeviceInfoDto(rawEvent.payload).DeviceID ?? '';
      case 'KeepAlive':
        return this.toKeepAliveDto(rawEvent.payload).DeviceID ?? '';
      default:
        return rawEvent.externalDeviceId;
    }
  }

  /**
   * Pure — no I/O, no Prisma. `rawEventId` defaults to '' because this
   * adapter is not wired into the live flow yet (see commit scope);
   * callers that already have a persisted CameraEventRaw id should pass
   * it explicitly, as the unit tests below do.
   */
  normalize(
    rawEvent: ProviderRawEvent,
    camera: ResolvedCameraContext,
    rawEventId = '',
  ): CanonicalCameraEvent {
    switch (rawEvent.externalEventType as DahuaExternalEventType) {
      case 'ParkingInfo': {
        const dto = this.toParkingInfoDto(rawEvent.payload);
        const event = normalizeParkingInfo(
          dto,
          {
            id: camera.id,
            tenantId: camera.tenantId,
            cityId: camera.cityId,
            deviceId: camera.externalDeviceId,
            channel: camera.channel ?? 0,
          },
          rawEventId,
          rawEvent.payload,
        );
        return {
          providerCode: this.code,
          externalDeviceId: event.deviceId,
          externalEventType: 'ParkingInfo',
          eventType: 'OCCUPANCY_UPDATE',
          externalStallCode: event.parkingSpaceCode,
          parkingStatus: translateOccupancyStatus(event.occupancyStatus),
          occurredAt: parseSnapTime(event.detectedAt),
          channel: event.channel,
          plate: event.plate,
          vehicle: event.vehicle,
          rawEventId: event.rawEventId,
          metadata: {
            illegalAreaName: event.illegalAreaName ?? null,
            allowedUser: event.allowedUser ?? null,
            entryRecordId: event.entryRecordId ?? null,
            timezoneOffset: event.timezoneOffset ?? null,
          },
          idempotencyKey: event.idempotencyKey,
        };
      }
      case 'DeviceInfo': {
        const dto = this.toDeviceInfoDto(rawEvent.payload);
        return {
          providerCode: this.code,
          externalDeviceId: dto.DeviceID || rawEvent.externalDeviceId,
          externalEventType: 'DeviceInfo',
          eventType: 'DEVICE_HANDSHAKE',
          parkingStatus: 'UNKNOWN',
          occurredAt: new Date(),
          rawEventId,
          metadata: {
            ipAddress: dto.IPAddress ?? null,
            macAddress: dto.MACAddress ?? null,
            manufacturer: dto.Manufacturer ?? null,
            model: dto.DeviceModel ?? null,
            deviceName: dto.DeviceName ?? null,
            deviceType: dto.DeviceType ?? null,
          },
          idempotencyKey: this.computeIdempotencyKey(rawEvent),
        };
      }
      case 'KeepAlive': {
        const dto = this.toKeepAliveDto(rawEvent.payload);
        return {
          providerCode: this.code,
          externalDeviceId: dto.DeviceID || rawEvent.externalDeviceId,
          externalEventType: 'KeepAlive',
          eventType: 'HEARTBEAT',
          parkingStatus: 'UNKNOWN',
          occurredAt: new Date(),
          rawEventId,
          metadata: {},
          idempotencyKey: this.computeIdempotencyKey(rawEvent),
        };
      }
      default:
        return {
          providerCode: this.code,
          externalDeviceId: rawEvent.externalDeviceId,
          externalEventType: rawEvent.externalEventType,
          eventType: 'UNCLASSIFIED',
          parkingStatus: 'UNKNOWN',
          occurredAt: new Date(),
          rawEventId,
          metadata: {},
          idempotencyKey: this.computeIdempotencyKey(rawEvent),
        };
    }
  }

  /**
   * ParkingInfo reuses the exact formula already in production
   * (DeviceID|ParkingStallsNo/DetectRegionName|ParkingStatus|SnapTime —
   * see normalizer.ts computeIdempotencyKey), unchanged. DeviceInfo/
   * KeepAlive have no business-level idempotency constraint today (only
   * CameraEvent.idempotencyKey is unique, and CameraEvent is only ever
   * created from ParkingInfo) — this branch is still deterministic to
   * satisfy the adapter contract, even though nothing consumes it yet.
   */
  computeIdempotencyKey(rawEvent: ProviderRawEvent): string {
    if (rawEvent.externalEventType === 'ParkingInfo') {
      const dto = this.toParkingInfoDto(rawEvent.payload);
      return computeDahuaOccupancyIdempotencyKey(dto, rawEvent.payload);
    }
    return createHash('sha256')
      .update(
        `${this.code}|${rawEvent.externalEventType}|${rawEvent.externalDeviceId}`,
      )
      .digest('hex');
  }

  getCapabilities(): CameraProviderCapability[] {
    return ['DEVICE_HANDSHAKE', 'HEARTBEAT', 'OCCUPANCY_UPDATE'];
  }

  getAuthStrategy(): CameraProviderAuthStrategy {
    return 'ip_allowlist';
  }

  private toDeviceInfoDto(payload: unknown): DeviceInfoDto {
    return plainToInstance(DeviceInfoDto, payload);
  }

  private toKeepAliveDto(payload: unknown): KeepAliveDto {
    return plainToInstance(KeepAliveDto, payload);
  }

  private toParkingInfoDto(payload: unknown): ParkingInfoDto {
    return plainToInstance(ParkingInfoDto, payload);
  }
}
