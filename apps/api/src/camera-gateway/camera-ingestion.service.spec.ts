import { Test, TestingModule } from '@nestjs/testing';
import { CameraIngestionService } from './camera-ingestion.service';
import { CameraIngestionCoreService } from './core/services/camera-ingestion-core.service';
import { DahuaProviderAdapter } from './providers/dahua/dahua-provider.adapter';

describe('CameraIngestionService (orchestration only)', () => {
  let service: CameraIngestionService;
  let core: {
    captureRawEvent: jest.Mock;
    markRawInvalid: jest.Mock;
    process: jest.Mock;
  };
  let adapter: {
    parseEvent: jest.Mock;
    validate: jest.Mock;
    normalize: jest.Mock;
  };

  beforeEach(async () => {
    core = {
      captureRawEvent: jest.fn().mockResolvedValue({ id: 'raw-1' }),
      markRawInvalid: jest.fn().mockResolvedValue(undefined),
      process: jest.fn().mockResolvedValue({ status: 'ok' }),
    };
    // parseEvent deliberately returns a "wrong" externalEventType here, to
    // prove the endpoint hint (not the adapter's own shape classifier) is
    // what actually drives the flow — see CameraIngestionService.ingest().
    adapter = {
      parseEvent: jest.fn().mockReturnValue({
        externalDeviceId: 'device-1',
        externalEventType: 'KeepAlive',
        payload: { DeviceID: 'device-1' },
      }),
      validate: jest.fn().mockReturnValue({ valid: true, errors: [] }),
      normalize: jest.fn().mockReturnValue({
        eventType: 'DEVICE_HANDSHAKE',
        rawEventId: 'raw-1',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CameraIngestionService,
        { provide: CameraIngestionCoreService, useValue: core },
        { provide: DahuaProviderAdapter, useValue: adapter },
      ],
    }).compile();

    service = module.get<CameraIngestionService>(CameraIngestionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('handleDeviceInfo', () => {
    it('orchestrates parseEvent → captureRawEvent → validate → normalize → process, in order', async () => {
      const body = { DeviceID: 'device-1' };
      const headers = { authorization: 'Bearer x' };
      const ip = '192.168.10.155';

      const result = await service.handleDeviceInfo(body, ip, headers);

      expect(adapter.parseEvent).toHaveBeenCalledWith(body, headers, ip);
      expect(core.captureRawEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          deviceIdRaw: 'device-1',
          eventType: 'DeviceInfo',
          contextIp: ip,
        }),
      );
      expect(adapter.validate).toHaveBeenCalledWith(
        expect.objectContaining({ externalEventType: 'DeviceInfo' }),
      );
      expect(adapter.normalize).toHaveBeenCalledWith(
        expect.objectContaining({ externalEventType: 'DeviceInfo' }),
        'raw-1',
      );
      expect(core.process).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'DEVICE_HANDSHAKE' }),
      );
      expect(result).toEqual({
        Result: true,
        Message: 'DeviceInfo recibido y autorizado',
        DeviceID: 'device-1',
      });
    });

    it('applies the DeviceInfo hint even though the adapter classified it as KeepAlive', async () => {
      await service.handleDeviceInfo({ DeviceID: 'device-1' }, 'ip', {});
      const [captureArgs] = core.captureRawEvent.mock.calls[0] as [
        { eventType: string },
      ];
      expect(captureArgs.eventType).toBe('DeviceInfo');
    });

    it('short-circuits on invalid payload: marks invalid, never normalizes or processes', async () => {
      adapter.validate.mockReturnValue({
        valid: false,
        errors: ['DeviceID missing'],
      });

      const result = await service.handleDeviceInfo({}, 'ip', {});

      expect(core.markRawInvalid).toHaveBeenCalledWith('raw-1', [
        'DeviceID missing',
      ]);
      expect(adapter.normalize).not.toHaveBeenCalled();
      expect(core.process).not.toHaveBeenCalled();
      expect(result).toEqual({
        Result: true,
        Message: 'DeviceInfo recibido y autorizado',
        DeviceID: 'device-1',
      });
    });
  });

  describe('handleKeepAlive', () => {
    it('applies the KeepAlive hint', async () => {
      await service.handleKeepAlive({ DeviceID: 'device-1' }, 'ip', {});
      const [captureArgs] = core.captureRawEvent.mock.calls[0] as [
        { eventType: string },
      ];
      expect(captureArgs.eventType).toBe('KeepAlive');
      expect(adapter.validate).toHaveBeenCalledWith(
        expect.objectContaining({ externalEventType: 'KeepAlive' }),
      );
    });
  });

  describe('handleParkingInfo', () => {
    it('applies the ParkingInfo hint', async () => {
      await service.handleParkingInfo(
        { Picture: { ParkingInfo: { DeviceID: 'device-1' } } },
        'ip',
        {},
      );
      const [captureArgs] = core.captureRawEvent.mock.calls[0] as [
        { eventType: string },
      ];
      expect(captureArgs.eventType).toBe('ParkingInfo');
      expect(adapter.validate).toHaveBeenCalledWith(
        expect.objectContaining({ externalEventType: 'ParkingInfo' }),
      );
    });
  });
});
