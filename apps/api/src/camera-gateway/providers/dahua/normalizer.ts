import { createHash } from 'crypto';
import type { ParkingInfoDto } from './dto/parking-info.dto';
import type { DahuaDetectionScope, DahuaOccupancyStatus } from './types';

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
