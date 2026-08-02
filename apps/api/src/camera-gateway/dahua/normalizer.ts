import { createHash } from 'crypto';
import type { ParkingInfoDto } from './dto/parking-info.dto';
import type {
  CameraParkingEvent,
  DahuaDetectionScope,
  DahuaOccupancyStatus,
} from './types';

export interface ResolvedCameraForParkingInfo {
  id: string;
  tenantId: string;
  cityId: string;
  deviceId: string;
  channel: number;
}

const OCCUPANCY_STATUS_BY_CODE: Record<number, DahuaOccupancyStatus> = {
  0: 'OCCUPIED',
  1: 'FREE',
  2: 'UNKNOWN',
  3: 'ILLEGAL',
  4: 'DETECTION',
  7: 'ILLEGAL',
};

export function resolveDetectionScope(
  parkingStallsNo: string | undefined,
): DahuaDetectionScope {
  return parkingStallsNo ? 'PARKING_SPACE' : 'ILLEGAL_AREA';
}

export function resolveOccupancyStatus(
  parkingStatus: number,
): DahuaOccupancyStatus {
  return OCCUPANCY_STATUS_BY_CODE[parkingStatus] ?? 'UNKNOWN';
}

/**
 * SnapTime arrives as "YYYY-MM-DD HH:mm:ss" (no offset). Falls back to the
 * ingestion time if absent or unparseable — never throws.
 */
export function parseSnapTime(snapTime: string | undefined): Date {
  if (!snapTime) {
    return new Date();
  }
  const isoLike = snapTime.includes('T')
    ? snapTime
    : snapTime.replace(' ', 'T');
  const parsed = new Date(isoLike);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

/**
 * DeviceID + (ParkingStallsNo || DetectRegionName) + ParkingStatus + SnapTime
 * — see DAHUA_IMPLEMENTATION_PLAN.md §10. SnapTime can be absent (open risk,
 * unresolved by both the reference and the official Dahua document); the
 * fallback hashes the full payload as a tie-breaker, documented as
 * non-definitive.
 */
export function computeIdempotencyKey(
  dto: ParkingInfoDto,
  rawPayload: unknown,
): string {
  const block = dto.Picture.ParkingInfo;
  const spaceOrArea = block.ParkingStallsNo || block.DetectRegionName || '';
  const base = `${block.DeviceID}|${spaceOrArea}|${block.ParkingStatus}|${block.SnapTime ?? ''}`;

  if (block.SnapTime) {
    return createHash('sha256').update(base).digest('hex');
  }

  const payloadHash = createHash('sha256')
    .update(JSON.stringify(rawPayload))
    .digest('hex');
  return createHash('sha256').update(`${base}|${payloadHash}`).digest('hex');
}

/**
 * Pure Dahua → canonical CameraParkingEvent mapping. No I/O, no Prisma —
 * see DAHUA_IMPLEMENTATION_PLAN.md §3. Image content (Base64) is never
 * read here — out of scope for this commit.
 */
export function normalizeParkingInfo(
  dto: ParkingInfoDto,
  camera: ResolvedCameraForParkingInfo,
  rawEventId: string,
  rawPayload: unknown,
): CameraParkingEvent {
  const block = dto.Picture.ParkingInfo;
  const detectionScope = resolveDetectionScope(block.ParkingStallsNo);

  return {
    source: 'DAHUA_ITSAPI',
    tenantId: camera.tenantId,
    cityId: camera.cityId,
    cameraId: camera.id,
    deviceId: camera.deviceId,
    detectionScope,
    parkingSpaceCode: block.ParkingStallsNo || undefined,
    occupancyStatus: resolveOccupancyStatus(block.ParkingStatus),
    illegalAreaName:
      detectionScope === 'ILLEGAL_AREA'
        ? block.DetectRegionName || undefined
        : undefined,
    detectedAt: block.SnapTime,
    plate: dto.Picture.Plate
      ? {
          exists: dto.Picture.Plate.IsExist,
          number: dto.Picture.Plate.PlateNumber || undefined,
          confidence: dto.Picture.Plate.Confidence,
          color: dto.Picture.Plate.PlateColor || undefined,
          region: dto.Picture.Plate.Region || undefined,
        }
      : undefined,
    vehicle: dto.Picture.Vehicle
      ? { type: dto.Picture.Vehicle.VehicleSeries || undefined }
      : undefined,
    idempotencyKey: computeIdempotencyKey(dto, rawPayload),
    rawEventId,
    channel: block.Channel ?? camera.channel,
    timezoneOffset: block.TimeZone,
    allowedUser: block.AllowUser,
    entryRecordId: block.inRecordId || undefined,
  };
}
