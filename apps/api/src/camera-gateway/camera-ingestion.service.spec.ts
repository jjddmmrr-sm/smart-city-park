import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { CameraIngestionService } from './camera-ingestion.service';
import { PrismaService } from '../prisma/prisma.service';
import { CameraGatewayConfigService } from './config/camera-gateway.config';
import { CameraGatewayLogger } from './logging/camera-gateway-logger.service';

describe('CameraIngestionService', () => {
  let service: CameraIngestionService;
  let tx: {
    cameraEvent: { create: jest.Mock };
    parkingSpace: { update: jest.Mock };
    parkingSpaceStatusHistory: { create: jest.Mock };
  };
  let prisma: {
    cameraEventRaw: { create: jest.Mock; update: jest.Mock };
    camera: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
    parkingSpace: { findUnique: jest.Mock };
    $transaction: jest.Mock;
  };
  let config: { pilotAutoRegisterEnabled: boolean };

  const ip = '192.168.10.155';
  const headers = { authorization: 'Bearer secret', 'x-forwarded-for': ip };

  beforeEach(async () => {
    tx = {
      cameraEvent: { create: jest.fn().mockResolvedValue({ id: 'event-1' }) },
      parkingSpace: { update: jest.fn().mockResolvedValue({}) },
      parkingSpaceStatusHistory: { create: jest.fn().mockResolvedValue({}) },
    };
    prisma = {
      cameraEventRaw: {
        create: jest.fn().mockResolvedValue({ id: 'raw-1' }),
        update: jest.fn().mockResolvedValue({}),
      },
      camera: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      parkingSpace: { findUnique: jest.fn() },
      $transaction: jest.fn(
        async (cb: (txArg: typeof tx) => Promise<unknown>) => cb(tx),
      ),
    };
    config = { pilotAutoRegisterEnabled: false };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CameraIngestionService,
        { provide: PrismaService, useValue: prisma },
        { provide: CameraGatewayConfigService, useValue: config },
        { provide: CameraGatewayLogger, useValue: new CameraGatewayLogger() },
      ],
    }).compile();

    service = module.get<CameraIngestionService>(CameraIngestionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('persists the raw event before validating', async () => {
    prisma.camera.findUnique.mockResolvedValue({
      id: 'cam-1',
      tenantId: 'tenant-a',
      ipAddress: null,
      macAddress: null,
      manufacturer: null,
      model: null,
    });
    prisma.camera.update.mockResolvedValue({
      id: 'cam-1',
      tenantId: 'tenant-a',
    });

    await service.handleDeviceInfo(
      { DeviceID: 'device-1', Manufacturer: 'Dahua' },
      ip,
      headers,
    );

    const [[createArgs]] = prisma.cameraEventRaw.create.mock.calls as [
      [{ data: Record<string, unknown> }],
    ];
    expect(createArgs.data.deviceIdRaw).toBe('device-1');
    expect(createArgs.data.eventType).toBe('DeviceInfo');
    expect(createArgs.data.contextIp).toBe(ip);
  });

  it('redacts sensitive headers before persisting context', async () => {
    prisma.camera.findUnique.mockResolvedValue(null);

    await service.handleDeviceInfo({ DeviceID: 'device-1' }, ip, headers);

    const [[call]] = prisma.cameraEventRaw.create.mock.calls as [
      [{ data: { contextHeaders: Record<string, unknown> } }],
    ];
    expect(call.data.contextHeaders.authorization).toBe('[REDACTED]');
  });

  it('updates an existing camera and returns 200-equivalent ack', async () => {
    prisma.camera.findUnique.mockResolvedValue({
      id: 'cam-1',
      tenantId: 'tenant-a',
      ipAddress: null,
      macAddress: null,
      manufacturer: null,
      model: null,
    });
    prisma.camera.update.mockResolvedValue({
      id: 'cam-1',
      tenantId: 'tenant-a',
    });

    const result = await service.handleDeviceInfo(
      { DeviceID: 'device-1', IPAddress: ip, Manufacturer: 'Dahua' },
      ip,
      headers,
    );

    expect(prisma.camera.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'cam-1' } }),
    );
    expect(prisma.camera.create).not.toHaveBeenCalled();
    expect(result).toEqual({ status: 'ok' });
  });

  it('auto-registers an unknown camera as pending_review when the pilot flag is enabled', async () => {
    config.pilotAutoRegisterEnabled = true;
    prisma.camera.findUnique.mockResolvedValue(null);
    prisma.camera.create.mockResolvedValue({ id: 'cam-2', tenantId: null });

    await service.handleDeviceInfo({ DeviceID: 'device-2' }, ip, headers);

    const [createArgs] = prisma.camera.create.mock.calls[0] as [
      { data: Record<string, unknown> },
    ];
    expect(createArgs.data.deviceId).toBe('device-2');
    expect(createArgs.data.registrationStatus).toBe('pending_review');
    expect(createArgs.data.tenantId).toBeUndefined();
    expect(createArgs.data.cityId).toBeUndefined();
  });

  it('silently discards an unknown device when auto-register is disabled, without creating a Camera', async () => {
    config.pilotAutoRegisterEnabled = false;
    prisma.camera.findUnique.mockResolvedValue(null);

    const result = await service.handleDeviceInfo(
      { DeviceID: 'device-3' },
      ip,
      headers,
    );

    expect(prisma.camera.create).not.toHaveBeenCalled();
    expect(result).toEqual({ status: 'ok' });

    const lastUpdateArgs = prisma.cameraEventRaw.update.mock.calls.at(-1) as [
      { data: Record<string, unknown> },
    ];
    expect(lastUpdateArgs[0].data.processingStatus).toBe('FAILED');
  });

  it('marks the raw event INVALID and still acks 200 when DeviceID is missing', async () => {
    const result = await service.handleDeviceInfo({}, ip, headers);

    expect(prisma.camera.findUnique).not.toHaveBeenCalled();
    expect(result).toEqual({ status: 'ok' });

    const [[updateArgs]] = prisma.cameraEventRaw.update.mock.calls as [
      [{ data: Record<string, unknown> }],
    ];
    expect(updateArgs.data.validationStatus).toBe('INVALID');
    expect(updateArgs.data.processingStatus).toBe('FAILED');
  });

  describe('handleKeepAlive', () => {
    it('persists the raw heartbeat event before validating', async () => {
      prisma.camera.findUnique.mockResolvedValue(null);

      await service.handleKeepAlive({ DeviceID: 'device-1' }, ip, headers);

      const [[createArgs]] = prisma.cameraEventRaw.create.mock.calls as [
        [{ data: Record<string, unknown> }],
      ];
      expect(createArgs.data.deviceIdRaw).toBe('device-1');
      expect(createArgs.data.eventType).toBe('KeepAlive');
      expect(createArgs.data.contextIp).toBe(ip);
    });

    it('refreshes lastSeenAt and status to active for a known camera', async () => {
      prisma.camera.findUnique.mockResolvedValue({
        id: 'cam-1',
        tenantId: 'tenant-a',
        status: 'active',
      });
      prisma.camera.update.mockResolvedValue({
        id: 'cam-1',
        tenantId: 'tenant-a',
      });

      const result = await service.handleKeepAlive(
        { DeviceID: 'device-1' },
        ip,
        headers,
      );

      const [updateArgs] = prisma.camera.update.mock.calls[0] as [
        { where: { id: string }; data: Record<string, unknown> },
      ];
      expect(updateArgs.where).toEqual({ id: 'cam-1' });
      expect(updateArgs.data.status).toBe('active');
      expect(updateArgs.data.lastSeenAt).toBeInstanceOf(Date);
      expect(prisma.camera.create).not.toHaveBeenCalled();
      expect(result).toEqual({ status: 'ok' });
    });

    it('marks the raw event PROCESSED and links cameraId/tenantId for a known camera', async () => {
      prisma.camera.findUnique.mockResolvedValue({
        id: 'cam-1',
        tenantId: 'tenant-a',
      });
      prisma.camera.update.mockResolvedValue({
        id: 'cam-1',
        tenantId: 'tenant-a',
      });

      await service.handleKeepAlive({ DeviceID: 'device-1' }, ip, headers);

      const lastUpdateArgs = prisma.cameraEventRaw.update.mock.calls.at(-1) as [
        { data: Record<string, unknown> },
      ];
      expect(lastUpdateArgs[0].data.processingStatus).toBe('PROCESSED');
      expect(lastUpdateArgs[0].data.cameraId).toBe('cam-1');
      expect(lastUpdateArgs[0].data.tenantId).toBe('tenant-a');
    });

    it('never creates a Camera for an unknown device — silent discard, still acks 200', async () => {
      prisma.camera.findUnique.mockResolvedValue(null);

      const result = await service.handleKeepAlive(
        { DeviceID: 'device-unknown' },
        ip,
        headers,
      );

      expect(prisma.camera.create).not.toHaveBeenCalled();
      expect(prisma.camera.update).not.toHaveBeenCalled();
      expect(result).toEqual({ status: 'ok' });

      const lastUpdateArgs = prisma.cameraEventRaw.update.mock.calls.at(-1) as [
        { data: Record<string, unknown> },
      ];
      expect(lastUpdateArgs[0].data.processingStatus).toBe('FAILED');
    });

    it('marks the raw event INVALID and still acks 200 when DeviceID is missing', async () => {
      const result = await service.handleKeepAlive({}, ip, headers);

      expect(prisma.camera.findUnique).not.toHaveBeenCalled();
      expect(result).toEqual({ status: 'ok' });

      const [[updateArgs]] = prisma.cameraEventRaw.update.mock.calls as [
        [{ data: Record<string, unknown> }],
      ];
      expect(updateArgs.data.validationStatus).toBe('INVALID');
      expect(updateArgs.data.processingStatus).toBe('FAILED');
    });
  });

  describe('handleParkingInfo', () => {
    const occupiedPayload = {
      Picture: {
        ParkingInfo: {
          DeviceID: 'device-1',
          ParkingStallsNo: 'A004',
          ParkingStatus: 0,
          SnapTime: '2026-07-14 14:56:40',
          Channel: 0,
        },
        Plate: { IsExist: false },
      },
    };

    const illegalAreaPayload = {
      Picture: {
        ParkingInfo: {
          DeviceID: 'device-1',
          ParkingStallsNo: '',
          ParkingStatus: 7,
          DetectRegionName: 'Área de detección ilegal 0',
          SnapTime: '2026-07-24 16:18:37',
        },
        Plate: { IsExist: true, PlateNumber: '47012' },
      },
    };

    const resolvedCamera = {
      id: 'cam-1',
      tenantId: 'tenant-a',
      cityId: 'city-a',
      deviceId: 'device-1',
      channel: 0,
      zoneId: 'zone-1',
    };

    it('persists the raw event before validating', async () => {
      prisma.camera.findUnique.mockResolvedValue(null);

      await service.handleParkingInfo(occupiedPayload, ip, headers);

      const [[createArgs]] = prisma.cameraEventRaw.create.mock.calls as [
        [{ data: Record<string, unknown> }],
      ];
      expect(createArgs.data.deviceIdRaw).toBe('device-1');
      expect(createArgs.data.eventType).toBe('ParkingInfo');
    });

    it('marks the raw event INVALID and still acks 200 when ParkingStatus is missing', async () => {
      const result = await service.handleParkingInfo(
        { Picture: { ParkingInfo: { DeviceID: 'device-1' } } },
        ip,
        headers,
      );

      expect(prisma.camera.findUnique).not.toHaveBeenCalled();
      expect(result).toEqual({ status: 'ok' });
      const [[updateArgs]] = prisma.cameraEventRaw.update.mock.calls as [
        [{ data: Record<string, unknown> }],
      ];
      expect(updateArgs.data.validationStatus).toBe('INVALID');
    });

    it('discards the event when the camera is unresolved, without starting a transaction', async () => {
      prisma.camera.findUnique.mockResolvedValue(null);

      const result = await service.handleParkingInfo(
        occupiedPayload,
        ip,
        headers,
      );

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(result).toEqual({ status: 'ok' });
    });

    it('discards the event when the camera has no tenant/city assigned yet', async () => {
      prisma.camera.findUnique.mockResolvedValue({
        id: 'cam-1',
        tenantId: null,
        cityId: null,
      });

      await service.handleParkingInfo(occupiedPayload, ip, headers);

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('resolves the ParkingSpace and updates its status + writes history for an occupied event', async () => {
      prisma.camera.findUnique.mockResolvedValue(resolvedCamera);
      prisma.parkingSpace.findUnique.mockResolvedValue({
        id: 'space-1',
        status: 'available',
        tenantId: 'tenant-a',
        cityId: 'city-a',
      });

      const result = await service.handleParkingInfo(
        occupiedPayload,
        ip,
        headers,
      );

      expect(prisma.parkingSpace.findUnique).toHaveBeenCalledWith({
        where: { zoneId_code: { zoneId: 'zone-1', code: 'A004' } },
      });

      const [createArgs] = tx.cameraEvent.create.mock.calls[0] as [
        { data: Record<string, unknown> },
      ];
      expect(createArgs.data.detectionScope).toBe('PLAZA');
      expect(createArgs.data.parkingSpaceId).toBe('space-1');

      const [updateArgs] = tx.parkingSpace.update.mock.calls[0] as [
        { where: { id: string }; data: { status: string } },
      ];
      expect(updateArgs.where).toEqual({ id: 'space-1' });
      expect(updateArgs.data.status).toBe('occupied');

      const [historyArgs] = tx.parkingSpaceStatusHistory.create.mock
        .calls[0] as [{ data: Record<string, unknown> }];
      expect(historyArgs.data.previousStatus).toBe('available');
      expect(historyArgs.data.newStatus).toBe('occupied');
      expect(historyArgs.data.source).toBe('CAMERA');
      expect(historyArgs.data.sourceEventId).toBe('event-1');

      expect(result).toEqual({ status: 'ok' });
    });

    it('does not touch ParkingSpace or history when the status is unchanged', async () => {
      prisma.camera.findUnique.mockResolvedValue(resolvedCamera);
      prisma.parkingSpace.findUnique.mockResolvedValue({
        id: 'space-1',
        status: 'occupied',
        tenantId: 'tenant-a',
        cityId: 'city-a',
      });

      await service.handleParkingInfo(occupiedPayload, ip, headers);

      expect(tx.cameraEvent.create).toHaveBeenCalled();
      expect(tx.parkingSpace.update).not.toHaveBeenCalled();
      expect(tx.parkingSpaceStatusHistory.create).not.toHaveBeenCalled();
    });

    it('records an illegal-area event without resolving or touching any ParkingSpace', async () => {
      prisma.camera.findUnique.mockResolvedValue(resolvedCamera);

      await service.handleParkingInfo(illegalAreaPayload, ip, headers);

      expect(prisma.parkingSpace.findUnique).not.toHaveBeenCalled();
      const [createArgs] = tx.cameraEvent.create.mock.calls[0] as [
        { data: Record<string, unknown> },
      ];
      expect(createArgs.data.detectionScope).toBe('AREA_ILEGAL');
      expect(createArgs.data.parkingSpaceId).toBeNull();
      expect(tx.parkingSpace.update).not.toHaveBeenCalled();
    });

    it('creates the event without a space when ParkingStallsNo does not resolve', async () => {
      prisma.camera.findUnique.mockResolvedValue(resolvedCamera);
      prisma.parkingSpace.findUnique.mockResolvedValue(null);

      await service.handleParkingInfo(occupiedPayload, ip, headers);

      const [createArgs] = tx.cameraEvent.create.mock.calls[0] as [
        { data: Record<string, unknown> },
      ];
      expect(createArgs.data.parkingSpaceId).toBeNull();
      expect(tx.parkingSpace.update).not.toHaveBeenCalled();
    });

    it('treats a duplicate idempotencyKey as already processed, without rethrowing', async () => {
      prisma.camera.findUnique.mockResolvedValue(resolvedCamera);
      prisma.parkingSpace.findUnique.mockResolvedValue({
        id: 'space-1',
        status: 'available',
        tenantId: 'tenant-a',
        cityId: 'city-a',
      });
      prisma.$transaction.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: '7.8.0',
        }),
      );

      const result = await service.handleParkingInfo(
        occupiedPayload,
        ip,
        headers,
      );

      expect(result).toEqual({ status: 'ok' });
      const lastUpdateArgs = prisma.cameraEventRaw.update.mock.calls.at(-1) as [
        { data: Record<string, unknown> },
      ];
      expect(lastUpdateArgs[0].data.processingStatus).toBe('PROCESSED');
    });

    it('rethrows a non-duplicate transaction error', async () => {
      prisma.camera.findUnique.mockResolvedValue(resolvedCamera);
      prisma.parkingSpace.findUnique.mockResolvedValue({
        id: 'space-1',
        status: 'available',
        tenantId: 'tenant-a',
        cityId: 'city-a',
      });
      prisma.$transaction.mockRejectedValueOnce(new Error('boom'));

      await expect(
        service.handleParkingInfo(occupiedPayload, ip, headers),
      ).rejects.toThrow('boom');
    });
  });
});
