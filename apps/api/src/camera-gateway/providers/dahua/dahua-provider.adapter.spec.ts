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

// Real payload observed post-firmware-update — see
// test/dahua/payloads/TimedParkingSpaceInfo_Initial.json.
const timedParkingSpaceInfoPayload = {
  DSTTune: 0,
  DeviceID: '1a85820a-9edf-406a-8338-170689f6099e',
  EventID: 134218921,
  ParkingSpacePic: {
    Content: '[BASE64 OMITIDO]',
    PicName: 'noplate-20260815112129.jpg',
  },
  SpaceModeInfo: [
    { ParkNo: 'C01', SpaceType: 0, Used: true },
    { ParkNo: 'C02', SpaceType: 0, Used: true },
    { ParkNo: 'C03', SpaceType: 0, Used: true },
    { ParkNo: 'C04', SpaceType: 0, Used: false },
    { ParkNo: 'C05', SpaceType: 0, Used: false },
    { ParkNo: 'C06', SpaceType: 0, Used: false },
    { ParkNo: 'C07', SpaceType: 0, Used: false },
    { ParkNo: 'C08', SpaceType: 0, Used: false },
    { ParkNo: 'C09', SpaceType: 0, Used: false },
  ],
  StatisticsMode: 'SpaceMode',
  Time: '2026-08-15 11:21:29',
  TimeZone: 25,
  TimingPeriod: 0,
  ViolationSnapSource: 3,
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

    it('classifies a real TimedParkingSpaceInfo payload (root-level DeviceID)', () => {
      const event = adapter.parseEvent(
        timedParkingSpaceInfoPayload,
        {},
        '192.168.10.155',
      );
      expect(event.externalEventType).toBe('TimedParkingSpaceInfo');
      expect(event.externalDeviceId).toBe(
        '1a85820a-9edf-406a-8338-170689f6099e',
      );
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

    it('accepts a valid TimedParkingSpaceInfo payload (9 stalls)', () => {
      const rawEvent = adapter.parseEvent(
        timedParkingSpaceInfoPayload,
        {},
        'ip',
      );
      expect(adapter.validate(rawEvent)).toEqual({ valid: true, errors: [] });
    });

    it('rejects a TimedParkingSpaceInfo payload missing DeviceID', () => {
      const rawEvent = adapter.parseEvent(
        { SpaceModeInfo: [{ ParkNo: 'C01', Used: true }] },
        {},
        'ip',
      );
      const result = adapter.validate({
        ...rawEvent,
        externalEventType: 'TimedParkingSpaceInfo',
      });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('rejects a TimedParkingSpaceInfo payload whose SpaceModeInfo is not an array', () => {
      const rawEvent = adapter.parseEvent(
        { DeviceID: 'device-1', SpaceModeInfo: 'not-an-array' },
        {},
        'ip',
      );
      const result = adapter.validate({
        ...rawEvent,
        externalEventType: 'TimedParkingSpaceInfo',
      });
      expect(result.valid).toBe(false);
    });

    it('still validates when individual SpaceModeInfo entries are malformed (tolerant, per Caso 6)', () => {
      const rawEvent = adapter.parseEvent(
        {
          DeviceID: 'device-1',
          SpaceModeInfo: [
            { ParkNo: 'C01', Used: true },
            { SpaceType: 0 }, // missing ParkNo/Used — must not sink the batch
          ],
        },
        {},
        'ip',
      );
      const result = adapter.validate({
        ...rawEvent,
        externalEventType: 'TimedParkingSpaceInfo',
      });
      expect(result.valid).toBe(true);
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

    it('resolves from the validated TimedParkingSpaceInfo payload (root-level)', () => {
      const rawEvent = adapter.parseEvent(
        timedParkingSpaceInfoPayload,
        {},
        'ip',
      );
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

    it('normalizes a real TimedParkingSpaceInfo event into OCCUPANCY_SNAPSHOT with all 9 stalls, dynamic count', () => {
      const rawEvent = adapter.parseEvent(
        timedParkingSpaceInfoPayload,
        {},
        'ip',
      );
      const event = adapter.normalize(rawEvent, 'raw-6');

      expect(event.eventType).toBe('OCCUPANCY_SNAPSHOT');
      expect(event.externalEventType).toBe('TimedParkingSpaceInfo');
      expect(event.spaces).toHaveLength(9);
      expect(event.spaces?.[0]).toMatchObject({
        externalStallCode: 'C01',
        parkingStatus: 'OCCUPIED',
      });
      expect(typeof event.spaces?.[0]?.idempotencyKey).toBe('string');
      expect(event.spaces?.[3]).toMatchObject({
        externalStallCode: 'C04',
        parkingStatus: 'AVAILABLE',
      });
      expect(typeof event.spaces?.[3]?.idempotencyKey).toBe('string');
      expect(event.metadata.reportedCount).toBe(9);
      expect(event.metadata.invalidItemCount).toBe(0);
      expect(
        (event.metadata.picture as { base64Length: number }).base64Length,
      ).toBeGreaterThan(0);
    });

    it('handles a payload larger than any historical stall limit (Caso 13 — no hardcoded maximum)', () => {
      const manySpaces = Array.from({ length: 50 }, (_, i) => ({
        ParkNo: `C${String(i + 1).padStart(2, '0')}`,
        SpaceType: 0,
        Used: i % 2 === 0,
      }));
      const rawEvent = adapter.parseEvent(
        {
          DeviceID: 'device-1',
          SpaceModeInfo: manySpaces,
          Time: '2026-08-15 11:21:29',
        },
        {},
        'ip',
      );
      const event = adapter.normalize(rawEvent, 'raw-7');
      expect(event.spaces).toHaveLength(50);
    });

    it('drops malformed SpaceModeInfo entries instead of throwing (Caso 6)', () => {
      const rawEvent = adapter.parseEvent(
        {
          DeviceID: 'device-1',
          Time: '2026-08-15 11:21:29',
          SpaceModeInfo: [
            { ParkNo: 'C01', Used: true },
            { SpaceType: 0 }, // no ParkNo/Used
            { ParkNo: '', Used: false }, // empty ParkNo
            { ParkNo: 'C02', Used: false },
          ],
        },
        {},
        'ip',
      );
      const event = adapter.normalize(rawEvent, 'raw-8');
      expect(event.spaces).toHaveLength(2);
      expect(event.spaces?.map((s) => s.externalStallCode)).toEqual([
        'C01',
        'C02',
      ]);
      expect(event.metadata.reportedCount).toBe(4);
      expect(event.metadata.invalidItemCount).toBe(2);
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
    it('declares exactly the 4 implemented event types as capabilities', () => {
      expect(adapter.getCapabilities()).toEqual([
        'DEVICE_HANDSHAKE',
        'HEARTBEAT',
        'OCCUPANCY_UPDATE',
        'OCCUPANCY_SNAPSHOT',
      ]);
    });

    it('declares ip_allowlist as its auth strategy', () => {
      expect(adapter.getAuthStrategy()).toBe('ip_allowlist');
    });
  });
});
