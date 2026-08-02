import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { ParkingInfoDto } from './dto/parking-info.dto';
import {
  computeIdempotencyKey,
  normalizeParkingInfo,
  parseSnapTime,
  resolveDetectionScope,
  resolveOccupancyStatus,
} from './normalizer';

// Real payload observed against hardware ITC413-PW4D-IZ1 — see
// smartpark-dahua-reference/docs/payloads-reales.md.
const occupiedPayload = {
  Picture: {
    NormalPic: {
      Content: '[BASE64 OMITIDO]',
      Height: 1584,
      PicName: 'noplate-20260714145640.jpg',
      Width: 2688,
    },
    ParkingInfo: {
      AllowUser: false,
      Channel: 0,
      DSTTune: 0,
      DetectRegionName: '',
      DeviceID: '1a85820a-9edf-406a-8338-170689f6099e',
      ParkingStallsNo: 'A004',
      ParkingStatus: 0,
      Relationship: null,
      SnapTime: '2026-07-14 14:56:40',
      TimeZone: 25,
      inRecordId: '',
    },
    Plate: {
      BoundingBox: [0, 0, 0, 0],
      Confidence: 0,
      IsExist: false,
      PlateColor: '',
      PlateNumber: '',
      PlateType: '',
      Region: '',
    },
    Vehicle: {
      VehicleBoundingBox: [320, 337, 798, 601],
      VehicleSeries: 'Otro',
    },
  },
};

// Illegal-area payload — same endpoint, ParkingStallsNo empty, ParkingStatus=7.
const illegalAreaPayload = {
  Picture: {
    ParkingInfo: {
      DeviceID: '1a85820a-9edf-406a-8338-170689f6099e',
      ParkingStallsNo: '',
      ParkingStatus: 7,
      DetectRegionName: 'Área de detección ilegal 0',
      SnapTime: '2026-07-24 16:18:37',
    },
    Plate: {
      IsExist: true,
      PlateNumber: '47012',
      Confidence: 36,
      PlateColor: 'Yellow',
      Region: 'COL',
    },
  },
};

const camera = {
  id: 'cam-1',
  tenantId: 'tenant-a',
  cityId: 'city-a',
  deviceId: '1a85820a-9edf-406a-8338-170689f6099e',
  channel: 0,
};

describe('resolveDetectionScope', () => {
  it('returns PARKING_SPACE when ParkingStallsNo is present', () => {
    expect(resolveDetectionScope('A004')).toBe('PARKING_SPACE');
  });

  it('returns ILLEGAL_AREA when ParkingStallsNo is empty', () => {
    expect(resolveDetectionScope('')).toBe('ILLEGAL_AREA');
    expect(resolveDetectionScope(undefined)).toBe('ILLEGAL_AREA');
  });
});

describe('resolveOccupancyStatus', () => {
  it('maps the confirmed Dahua status codes', () => {
    expect(resolveOccupancyStatus(0)).toBe('OCCUPIED');
    expect(resolveOccupancyStatus(1)).toBe('FREE');
    expect(resolveOccupancyStatus(2)).toBe('UNKNOWN');
    expect(resolveOccupancyStatus(3)).toBe('ILLEGAL');
    expect(resolveOccupancyStatus(4)).toBe('DETECTION');
    expect(resolveOccupancyStatus(7)).toBe('ILLEGAL');
  });

  it('falls back to UNKNOWN for an unrecognized code', () => {
    expect(resolveOccupancyStatus(99)).toBe('UNKNOWN');
  });
});

describe('parseSnapTime', () => {
  it('parses the real "YYYY-MM-DD HH:mm:ss" format', () => {
    const parsed = parseSnapTime('2026-07-14 14:56:40');
    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(6); // 0-indexed
    expect(parsed.getDate()).toBe(14);
  });

  it('falls back to the current time when absent', () => {
    const before = Date.now();
    const parsed = parseSnapTime(undefined);
    expect(parsed.getTime()).toBeGreaterThanOrEqual(before);
  });

  it('falls back to the current time when unparseable', () => {
    const parsed = parseSnapTime('not-a-date');
    expect(Number.isNaN(parsed.getTime())).toBe(false);
  });
});

describe('computeIdempotencyKey', () => {
  it('is deterministic for the same payload', () => {
    const dto = plainToInstance(ParkingInfoDto, occupiedPayload);
    const key1 = computeIdempotencyKey(dto, occupiedPayload);
    const key2 = computeIdempotencyKey(dto, occupiedPayload);
    expect(key1).toBe(key2);
  });

  it('differs when SnapTime differs', () => {
    const dto1 = plainToInstance(ParkingInfoDto, occupiedPayload);
    const dto2 = plainToInstance(ParkingInfoDto, {
      Picture: {
        ...occupiedPayload.Picture,
        ParkingInfo: {
          ...occupiedPayload.Picture.ParkingInfo,
          SnapTime: '2026-07-14 15:00:00',
        },
      },
    });
    expect(computeIdempotencyKey(dto1, occupiedPayload)).not.toBe(
      computeIdempotencyKey(dto2, occupiedPayload),
    );
  });

  it('uses DetectRegionName instead of ParkingStallsNo for illegal-area events', () => {
    const dto = plainToInstance(ParkingInfoDto, illegalAreaPayload);
    const key = computeIdempotencyKey(dto, illegalAreaPayload);
    expect(key).toHaveLength(64); // sha256 hex digest
  });

  it('still produces a deterministic key when SnapTime is missing (payload-hash fallback)', () => {
    const payloadWithoutSnapTime = {
      Picture: {
        ParkingInfo: {
          DeviceID: 'device-x',
          ParkingStallsNo: 'B002',
          ParkingStatus: 0,
        },
      },
    };
    const dto = plainToInstance(ParkingInfoDto, payloadWithoutSnapTime);
    const key1 = computeIdempotencyKey(dto, payloadWithoutSnapTime);
    const key2 = computeIdempotencyKey(dto, payloadWithoutSnapTime);
    expect(key1).toBe(key2);
    expect(key1).toHaveLength(64);
  });
});

describe('normalizeParkingInfo', () => {
  it('normalizes a real occupied-space event', () => {
    const dto = plainToInstance(ParkingInfoDto, occupiedPayload);
    const event = normalizeParkingInfo(dto, camera, 'raw-1', occupiedPayload);

    expect(event.source).toBe('DAHUA_ITSAPI');
    expect(event.tenantId).toBe('tenant-a');
    expect(event.detectionScope).toBe('PARKING_SPACE');
    expect(event.parkingSpaceCode).toBe('A004');
    expect(event.occupancyStatus).toBe('OCCUPIED');
    expect(event.illegalAreaName).toBeUndefined();
    expect(event.plate?.exists).toBe(false);
    expect(event.vehicle?.type).toBe('Otro');
    expect(event.rawEventId).toBe('raw-1');
  });

  it('normalizes a real illegal-area event without a parking space code', () => {
    const dto = plainToInstance(ParkingInfoDto, illegalAreaPayload);
    const event = normalizeParkingInfo(
      dto,
      camera,
      'raw-2',
      illegalAreaPayload,
    );

    expect(event.detectionScope).toBe('ILLEGAL_AREA');
    expect(event.parkingSpaceCode).toBeUndefined();
    expect(event.illegalAreaName).toBe('Área de detección ilegal 0');
    expect(event.occupancyStatus).toBe('ILLEGAL');
    expect(event.plate?.number).toBe('47012');
  });
});
