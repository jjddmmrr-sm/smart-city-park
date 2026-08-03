import 'reflect-metadata';
import { DahuaProviderAdapter } from './dahua-provider.adapter';
import { computeIdempotencyKey } from './normalizer';
import { plainToInstance } from 'class-transformer';
import { ParkingInfoDto } from './dto/parking-info.dto';

// Real payload observed against hardware ITC413-PW4D-IZ1 — see
// test/dahua/payloads/DeviceInfo.json and
// smartpark-dahua-reference/docs/payloads-reales.md.
const deviceInfoPayload = {
  DeviceID: '1a85820a-9edf-406a-8338-170689f6099e',
  DeviceModel: 'ITC413-PW4D-IZ1',
  DeviceName: 'BM0F879PAJ5D7B6',
  DeviceType: 'Tollgate',
  IPAddress: '192.168.10.155',
  IPv6Address: '',
  MACAddress: '40:7a:a4:c8:92:04',
  Manufacturer: 'Dahua',
};

// KeepAlive carries no fields beyond DeviceID in every real payload
// observed — see dto/keep-alive.dto.ts.
const keepAlivePayload = { DeviceID: '1a85820a-9edf-406a-8338-170689f6099e' };

const occupiedPayload = {
  Picture: {
    ParkingInfo: {
      Channel: 0,
      DeviceID: '1a85820a-9edf-406a-8338-170689f6099e',
      ParkingStallsNo: 'A004',
      ParkingStatus: 0,
      SnapTime: '2026-07-14 14:56:40',
    },
    Plate: { IsExist: false },
    Vehicle: { VehicleSeries: 'Otro' },
  },
};

const freeSpacePayload = {
  Picture: {
    ParkingInfo: {
      DeviceID: '1a85820a-9edf-406a-8338-170689f6099e',
      ParkingStallsNo: 'A004',
      ParkingStatus: 1,
      SnapTime: '2026-07-14 15:10:00',
    },
  },
};

const illegalAreaPayload = {
  Picture: {
    ParkingInfo: {
      DeviceID: '1a85820a-9edf-406a-8338-170689f6099e',
      ParkingStallsNo: '',
      ParkingStatus: 7,
      DetectRegionName: 'Área de detección ilegal 0',
      SnapTime: '2026-07-24 16:18:37',
    },
    Plate: { IsExist: true, PlateNumber: '47012' },
  },
};

describe('DahuaProviderAdapter', () => {
  let adapter: DahuaProviderAdapter;

  beforeEach(() => {
    adapter = new DahuaProviderAdapter();
  });

  it('exposes DAHUA_ITSAPI as its provider code', () => {
    expect(adapter.code).toBe('DAHUA_ITSAPI');
  });

  describe('parseEvent', () => {
    it('classifies a real DeviceInfo payload and extracts the device id', () => {
      const event = adapter.parseEvent(deviceInfoPayload, {}, '192.168.10.155');
      expect(event.externalEventType).toBe('DeviceInfo');
      expect(event.externalDeviceId).toBe(
        '1a85820a-9edf-406a-8338-170689f6099e',
      );
    });

    it('classifies a bare KeepAlive payload (DeviceID only)', () => {
      const event = adapter.parseEvent(keepAlivePayload, {}, '192.168.10.155');
      expect(event.externalEventType).toBe('KeepAlive');
      expect(event.externalDeviceId).toBe(
        '1a85820a-9edf-406a-8338-170689f6099e',
      );
    });

    it('classifies a ParkingInfo payload and extracts the nested device id', () => {
      const event = adapter.parseEvent(occupiedPayload, {}, '192.168.10.155');
      expect(event.externalEventType).toBe('ParkingInfo');
      expect(event.externalDeviceId).toBe(
        '1a85820a-9edf-406a-8338-170689f6099e',
      );
    });

    it('never throws on a malformed payload — best-effort empty device id', () => {
      const event = adapter.parseEvent(null, {}, '192.168.10.155');
      expect(event.externalDeviceId).toBe('');
      expect(event.externalEventType).toBe('KeepAlive');
    });
  });

  describe('validate', () => {
    it('accepts a valid DeviceInfo payload', () => {
      const rawEvent = adapter.parseEvent(deviceInfoPayload, {}, 'ip');
      expect(adapter.validate(rawEvent)).toEqual({ valid: true, errors: [] });
    });

    it('rejects a DeviceInfo payload without DeviceID', () => {
      const rawEvent = adapter.parseEvent({}, {}, 'ip');
      const result = adapter.validate({
        ...rawEvent,
        externalEventType: 'DeviceInfo',
      });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('accepts a valid KeepAlive payload', () => {
      const rawEvent = adapter.parseEvent(keepAlivePayload, {}, 'ip');
      expect(adapter.validate(rawEvent)).toEqual({ valid: true, errors: [] });
    });

    it('accepts a valid ParkingInfo payload', () => {
      const rawEvent = adapter.parseEvent(occupiedPayload, {}, 'ip');
      expect(adapter.validate(rawEvent)).toEqual({ valid: true, errors: [] });
    });

    it('rejects a ParkingInfo payload missing ParkingStatus', () => {
      const rawEvent = adapter.parseEvent(
        { Picture: { ParkingInfo: { DeviceID: 'device-1' } } },
        {},
        'ip',
      );
      const result = adapter.validate(rawEvent);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('DeviceID or ParkingStatus missing');
    });
  });

  describe('resolveDeviceIdentifier', () => {
    it('resolves from the validated DeviceInfo payload', () => {
      const rawEvent = adapter.parseEvent(deviceInfoPayload, {}, 'ip');
      expect(adapter.resolveDeviceIdentifier(rawEvent)).toBe(
        '1a85820a-9edf-406a-8338-170689f6099e',
      );
    });

    it('resolves from the validated ParkingInfo payload (nested)', () => {
      const rawEvent = adapter.parseEvent(occupiedPayload, {}, 'ip');
      expect(adapter.resolveDeviceIdentifier(rawEvent)).toBe(
        '1a85820a-9edf-406a-8338-170689f6099e',
      );
    });
  });

  describe('normalize', () => {
    it('normalizes DeviceInfo into a DEVICE_HANDSHAKE canonical event', () => {
      const rawEvent = adapter.parseEvent(deviceInfoPayload, {}, 'ip');
      const event = adapter.normalize(rawEvent, 'raw-1');

      expect(event.providerCode).toBe('DAHUA_ITSAPI');
      expect(event.eventType).toBe('DEVICE_HANDSHAKE');
      expect(event.externalEventType).toBe('DeviceInfo');
      expect(event.parkingStatus).toBe('UNKNOWN');
      expect(event.rawEventId).toBe('raw-1');
      expect(event.metadata.manufacturer).toBe('Dahua');
      expect(event.metadata.ipAddress).toBe('192.168.10.155');
    });

    it('normalizes KeepAlive into a HEARTBEAT canonical event', () => {
      const rawEvent = adapter.parseEvent(keepAlivePayload, {}, 'ip');
      const event = adapter.normalize(rawEvent, 'raw-2');

      expect(event.eventType).toBe('HEARTBEAT');
      expect(event.parkingStatus).toBe('UNKNOWN');
      expect(event.metadata).toEqual({});
    });

    it('normalizes a real occupied-space ParkingInfo event', () => {
      const rawEvent = adapter.parseEvent(occupiedPayload, {}, 'ip');
      const event = adapter.normalize(rawEvent, 'raw-3');

      expect(event.eventType).toBe('OCCUPANCY_UPDATE');
      expect(event.externalStallCode).toBe('A004');
      expect(event.parkingStatus).toBe('OCCUPIED');
      expect(event.vehicle?.type).toBe('Otro');
      expect(event.rawEventId).toBe('raw-3');
    });

    it('translates Dahua FREE to the canonical AVAILABLE status', () => {
      const rawEvent = adapter.parseEvent(freeSpacePayload, {}, 'ip');
      const event = adapter.normalize(rawEvent, 'raw-4');

      expect(event.parkingStatus).toBe('AVAILABLE');
      expect(event.parkingStatus).not.toBe('FREE');
    });

    it('normalizes a real illegal-area event without a stall code', () => {
      const rawEvent = adapter.parseEvent(illegalAreaPayload, {}, 'ip');
      const event = adapter.normalize(rawEvent, 'raw-5');

      expect(event.externalStallCode).toBeUndefined();
      expect(event.parkingStatus).toBe('ILLEGAL');
      expect(event.metadata.illegalAreaName).toBe('Área de detección ilegal 0');
    });
  });

  describe('computeIdempotencyKey', () => {
    it('matches the existing production formula for ParkingInfo, unchanged', () => {
      const rawEvent = adapter.parseEvent(occupiedPayload, {}, 'ip');
      const dto = plainToInstance(ParkingInfoDto, occupiedPayload);
      const expected = computeIdempotencyKey(dto, occupiedPayload);

      expect(adapter.computeIdempotencyKey(rawEvent)).toBe(expected);
    });

    it('is deterministic for DeviceInfo/KeepAlive even without a formal formula', () => {
      const rawEvent = adapter.parseEvent(deviceInfoPayload, {}, 'ip');
      const key1 = adapter.computeIdempotencyKey(rawEvent);
      const key2 = adapter.computeIdempotencyKey(rawEvent);
      expect(key1).toBe(key2);
    });
  });

  describe('capabilities and auth strategy', () => {
    it('declares exactly the 3 implemented event types as capabilities', () => {
      expect(adapter.getCapabilities()).toEqual([
        'DEVICE_HANDSHAKE',
        'HEARTBEAT',
        'OCCUPANCY_UPDATE',
      ]);
    });

    it('declares ip_allowlist as its auth strategy', () => {
      expect(adapter.getAuthStrategy()).toBe('ip_allowlist');
    });
  });
});
