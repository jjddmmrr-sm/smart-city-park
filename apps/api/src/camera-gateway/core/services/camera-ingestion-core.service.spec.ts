import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { CameraIngestionCoreService } from './camera-ingestion-core.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { CameraGatewayConfigService } from '../../config/camera-gateway.config';
import { CameraGatewayLogger } from '../../logging/camera-gateway-logger.service';
import type { CanonicalCameraEvent } from '../contracts/canonical-camera-event';

function buildEvent(
  overrides: Partial<CanonicalCameraEvent> = {},
): CanonicalCameraEvent {
  return {
    providerCode: 'DAHUA_ITSAPI',
    externalDeviceId: 'device-1',
    externalEventType: 'DeviceInfo',
    eventType: 'DEVICE_HANDSHAKE',
    parkingStatus: 'UNKNOWN',
    occurredAt: new Date('2026-07-14T14:56:40'),
    rawEventId: 'raw-1',
    metadata: {},
    idempotencyKey: 'key-1',
    ...overrides,
  };
}

describe('CameraIngestionCoreService', () => {
  let service: CameraIngestionCoreService;
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
        CameraIngestionCoreService,
        { provide: PrismaService, useValue: prisma },
        { provide: CameraGatewayConfigService, useValue: config },
        { provide: CameraGatewayLogger, useValue: new CameraGatewayLogger() },
      ],
    }).compile();

    service = module.get<CameraIngestionCoreService>(
      CameraIngestionCoreService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('captureRawEvent', () => {
    it('persists CameraEventRaw as PENDING with redacted headers', async () => {
      const result = await service.captureRawEvent({
        deviceIdRaw: 'device-1',
        eventType: 'DeviceInfo',
        payload: { DeviceID: 'device-1' },
        contextIp: '192.168.10.155',
        contextHeaders: { authorization: 'Bearer secret' },
      });

      expect(result).toEqual({ id: 'raw-1' });
      const [[createArgs]] = prisma.cameraEventRaw.create.mock.calls as [
        [{ data: Record<string, unknown> }],
      ];
      expect(createArgs.data.deviceIdRaw).toBe('device-1');
      expect(createArgs.data.eventType).toBe('DeviceInfo');
      expect(createArgs.data.contextIp).toBe('192.168.10.155');
      expect(createArgs.data.validationStatus).toBe('PENDING');
      expect(
        (createArgs.data.contextHeaders as Record<string, unknown>)
          .authorization,
      ).toBe('[REDACTED]');
    });
  });

  describe('markRawInvalid', () => {
    it('marks INVALID/FAILED and joins errors, without setting processedAt', async () => {
      await service.markRawInvalid('raw-1', ['DeviceID missing']);
      const [[updateArgs]] = prisma.cameraEventRaw.update.mock.calls as [
        [{ data: Record<string, unknown> }],
      ];
      expect(updateArgs.data.validationStatus).toBe('INVALID');
      expect(updateArgs.data.processingStatus).toBe('FAILED');
      expect(updateArgs.data.error).toBe('DeviceID missing');
      expect(updateArgs.data.processedAt).toBeUndefined();
    });
  });

  describe('process — DEVICE_HANDSHAKE', () => {
    it('marks the raw event VALID before processing', async () => {
      prisma.camera.findUnique.mockResolvedValue(null);
      await service.process(buildEvent());
      const [[validCall]] = prisma.cameraEventRaw.update.mock.calls as [
        [{ data: Record<string, unknown> }],
      ];
      expect(validCall.data).toEqual({ validationStatus: 'VALID' });
    });

    it('updates an existing camera and finalizes PROCESSED with processedAt', async () => {
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

      const result = await service.process(
        buildEvent({ metadata: { manufacturer: 'Dahua' } }),
      );

      expect(prisma.camera.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'cam-1' } }),
      );
      expect(prisma.camera.create).not.toHaveBeenCalled();
      expect(result).toEqual({ status: 'ok' });

      const lastUpdate = prisma.cameraEventRaw.update.mock.calls.at(-1) as [
        { data: Record<string, unknown> },
      ];
      expect(lastUpdate[0].data.processingStatus).toBe('PROCESSED');
      expect(lastUpdate[0].data.processedAt).toBeInstanceOf(Date);
      expect(lastUpdate[0].data.cameraId).toBe('cam-1');
      expect(lastUpdate[0].data.tenantId).toBe('tenant-a');
    });

    it('auto-registers an unknown camera as pending_review when the pilot flag is enabled', async () => {
      config.pilotAutoRegisterEnabled = true;
      prisma.camera.findUnique.mockResolvedValue(null);
      prisma.camera.create.mockResolvedValue({ id: 'cam-2', tenantId: null });

      await service.process(
        buildEvent({ externalDeviceId: 'device-2', rawEventId: 'raw-2' }),
      );

      const [createArgs] = prisma.camera.create.mock.calls[0] as [
        { data: Record<string, unknown> },
      ];
      expect(createArgs.data.deviceId).toBe('device-2');
      expect(createArgs.data.registrationStatus).toBe('pending_review');
    });

    it('silently discards an unknown device when auto-register is disabled, without setting processedAt', async () => {
      config.pilotAutoRegisterEnabled = false;
      prisma.camera.findUnique.mockResolvedValue(null);

      const result = await service.process(
        buildEvent({ externalDeviceId: 'device-3', rawEventId: 'raw-3' }),
      );

      expect(prisma.camera.create).not.toHaveBeenCalled();
      expect(result).toEqual({ status: 'ok' });

      const lastUpdate = prisma.cameraEventRaw.update.mock.calls.at(-1) as [
        { data: Record<string, unknown> },
      ];
      expect(lastUpdate[0].data.processingStatus).toBe('FAILED');
      expect(lastUpdate[0].data.processedAt).toBeUndefined();
    });
  });

  describe('process — HEARTBEAT', () => {
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

      const result = await service.process(
        buildEvent({ externalEventType: 'KeepAlive', eventType: 'HEARTBEAT' }),
      );

      const [updateArgs] = prisma.camera.update.mock.calls[0] as [
        { where: { id: string }; data: Record<string, unknown> },
      ];
      expect(updateArgs.where).toEqual({ id: 'cam-1' });
      expect(updateArgs.data.status).toBe('active');
      expect(updateArgs.data.lastSeenAt).toBeInstanceOf(Date);
      expect(result).toEqual({ status: 'ok' });

      const lastUpdate = prisma.cameraEventRaw.update.mock.calls.at(-1) as [
        { data: Record<string, unknown> },
      ];
      expect(lastUpdate[0].data.processingStatus).toBe('PROCESSED');
      expect(lastUpdate[0].data.cameraId).toBe('cam-1');
      expect(lastUpdate[0].data.tenantId).toBe('tenant-a');
    });

    it('never creates a Camera for an unknown device — silent discard, still acks ok', async () => {
      prisma.camera.findUnique.mockResolvedValue(null);

      const result = await service.process(
        buildEvent({
          externalDeviceId: 'device-unknown',
          externalEventType: 'KeepAlive',
          eventType: 'HEARTBEAT',
        }),
      );

      expect(prisma.camera.create).not.toHaveBeenCalled();
      expect(prisma.camera.update).not.toHaveBeenCalled();
      expect(result).toEqual({ status: 'ok' });

      const lastUpdate = prisma.cameraEventRaw.update.mock.calls.at(-1) as [
        { data: Record<string, unknown> },
      ];
      expect(lastUpdate[0].data.processingStatus).toBe('FAILED');
      expect(lastUpdate[0].data.processedAt).toBeUndefined();
    });
  });

  describe('process — OCCUPANCY_UPDATE', () => {
    const resolvedCamera = {
      id: 'cam-1',
      tenantId: 'tenant-a',
      cityId: 'city-a',
      zoneId: 'zone-1',
      deviceId: 'device-1',
    };

    function occupancyEvent(overrides: Partial<CanonicalCameraEvent> = {}) {
      return buildEvent({
        externalEventType: 'ParkingInfo',
        eventType: 'OCCUPANCY_UPDATE',
        externalStallCode: 'A004',
        parkingStatus: 'OCCUPIED',
        plate: { exists: false },
        metadata: {},
        ...overrides,
      });
    }

    it('discards the event when the camera is unresolved, without starting a transaction', async () => {
      prisma.camera.findUnique.mockResolvedValue(null);

      const result = await service.process(occupancyEvent());

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(result).toEqual({ status: 'ok' });
    });

    it('discards the event when the camera has no tenant/city assigned yet', async () => {
      prisma.camera.findUnique.mockResolvedValue({
        id: 'cam-1',
        tenantId: null,
        cityId: null,
      });

      await service.process(occupancyEvent());

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

      const result = await service.process(occupancyEvent());

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

    it('translates the canonical AVAILABLE status to the "available" ParkingSpace status', async () => {
      prisma.camera.findUnique.mockResolvedValue(resolvedCamera);
      prisma.parkingSpace.findUnique.mockResolvedValue({
        id: 'space-1',
        status: 'occupied',
        tenantId: 'tenant-a',
        cityId: 'city-a',
      });

      await service.process(occupancyEvent({ parkingStatus: 'AVAILABLE' }));

      const [updateArgs] = tx.parkingSpace.update.mock.calls[0] as [
        { data: { status: string } },
      ];
      expect(updateArgs.data.status).toBe('available');
    });

    it('does not touch ParkingSpace or history when the status is unchanged', async () => {
      prisma.camera.findUnique.mockResolvedValue(resolvedCamera);
      prisma.parkingSpace.findUnique.mockResolvedValue({
        id: 'space-1',
        status: 'occupied',
        tenantId: 'tenant-a',
        cityId: 'city-a',
      });

      await service.process(occupancyEvent());

      expect(tx.cameraEvent.create).toHaveBeenCalled();
      expect(tx.parkingSpace.update).not.toHaveBeenCalled();
      expect(tx.parkingSpaceStatusHistory.create).not.toHaveBeenCalled();
    });

    it('records an illegal-area event without resolving or touching any ParkingSpace', async () => {
      prisma.camera.findUnique.mockResolvedValue(resolvedCamera);

      await service.process(
        occupancyEvent({
          externalStallCode: undefined,
          parkingStatus: 'ILLEGAL',
          metadata: { illegalAreaName: 'Área de detección ilegal 0' },
        }),
      );

      expect(prisma.parkingSpace.findUnique).not.toHaveBeenCalled();
      const [createArgs] = tx.cameraEvent.create.mock.calls[0] as [
        { data: Record<string, unknown> },
      ];
      expect(createArgs.data.detectionScope).toBe('AREA_ILEGAL');
      expect(createArgs.data.parkingSpaceId).toBeNull();
      expect(tx.parkingSpace.update).not.toHaveBeenCalled();
    });

    it('creates the event without a space when the stall code does not resolve', async () => {
      prisma.camera.findUnique.mockResolvedValue(resolvedCamera);
      prisma.parkingSpace.findUnique.mockResolvedValue(null);

      await service.process(occupancyEvent());

      const [createArgs] = tx.cameraEvent.create.mock.calls[0] as [
        { data: Record<string, unknown> },
      ];
      expect(createArgs.data.parkingSpaceId).toBeNull();
      expect(tx.parkingSpace.update).not.toHaveBeenCalled();
    });

    it('treats a duplicate idempotencyKey as already processed (stored as PROCESSED), without rethrowing', async () => {
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

      const result = await service.process(occupancyEvent());

      expect(result).toEqual({ status: 'ok' });
      const lastUpdate = prisma.cameraEventRaw.update.mock.calls.at(-1) as [
        { data: Record<string, unknown> },
      ];
      expect(lastUpdate[0].data.processingStatus).toBe('PROCESSED');
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

      await expect(service.process(occupancyEvent())).rejects.toThrow('boom');
    });
  });
});
