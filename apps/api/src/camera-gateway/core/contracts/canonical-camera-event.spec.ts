import {
  CANONICAL_CAMERA_EVENT_TYPES,
  CANONICAL_PARKING_STATUSES,
  isCanonicalCameraEventType,
  isCanonicalParkingStatus,
} from './canonical-camera-event';

describe('CANONICAL_PARKING_STATUSES', () => {
  it('contains exactly the 5 minimum canonical states, no duplicates', () => {
    expect(CANONICAL_PARKING_STATUSES).toEqual([
      'OCCUPIED',
      'AVAILABLE',
      'ILLEGAL',
      'DETECTION',
      'UNKNOWN',
    ]);
    expect(new Set(CANONICAL_PARKING_STATUSES).size).toBe(
      CANONICAL_PARKING_STATUSES.length,
    );
  });

  it('never contains a Dahua-specific word like FREE', () => {
    expect(CANONICAL_PARKING_STATUSES).not.toContain('FREE');
  });
});

describe('isCanonicalParkingStatus', () => {
  it('accepts every canonical status', () => {
    for (const status of CANONICAL_PARKING_STATUSES) {
      expect(isCanonicalParkingStatus(status)).toBe(true);
    }
  });

  it('rejects a manufacturer-specific word (e.g. Dahua FREE)', () => {
    expect(isCanonicalParkingStatus('FREE')).toBe(false);
  });

  it('rejects non-string and unrelated values', () => {
    expect(isCanonicalParkingStatus(0)).toBe(false);
    expect(isCanonicalParkingStatus(undefined)).toBe(false);
    expect(isCanonicalParkingStatus('occupied')).toBe(false); // case-sensitive
  });
});

describe('CANONICAL_CAMERA_EVENT_TYPES', () => {
  it('contains exactly the 4 minimum canonical event types, no duplicates', () => {
    expect(CANONICAL_CAMERA_EVENT_TYPES).toEqual([
      'DEVICE_HANDSHAKE',
      'HEARTBEAT',
      'OCCUPANCY_UPDATE',
      'UNCLASSIFIED',
    ]);
    expect(new Set(CANONICAL_CAMERA_EVENT_TYPES).size).toBe(
      CANONICAL_CAMERA_EVENT_TYPES.length,
    );
  });
});

describe('isCanonicalCameraEventType', () => {
  it('accepts every canonical event type', () => {
    for (const eventType of CANONICAL_CAMERA_EVENT_TYPES) {
      expect(isCanonicalCameraEventType(eventType)).toBe(true);
    }
  });

  it('rejects a provider-specific event name (e.g. Dahua ParkingInfo)', () => {
    expect(isCanonicalCameraEventType('ParkingInfo')).toBe(false);
  });

  it('rejects non-string and unrelated values', () => {
    expect(isCanonicalCameraEventType(null)).toBe(false);
    expect(isCanonicalCameraEventType({})).toBe(false);
  });
});
