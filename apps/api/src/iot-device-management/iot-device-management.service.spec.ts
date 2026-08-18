import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { IotDeviceManagementService } from './iot-device-management.service';
import { PrismaService } from '../prisma/prisma.service';
import type { JwtPayload } from '../auth/types/jwt-payload.type';

const superAdmin: JwtPayload = {
  sub: 'user-super',
  email: 'super@smartparking.com',
  tenantId: 'tenant-a',
  cityId: 'city-a',
  roles: ['SUPER_ADMIN'],
};

const tenantAAdmin: JwtPayload = {
  sub: 'user-a',
  email: 'admin@tenant-a.com',
  tenantId: 'tenant-a',
  cityId: 'city-a',
  roles: ['ADMIN'],
};

function fkViolation() {
  return new Prisma.PrismaClientKnownRequestError('FK violation', {
    code: 'P2003',
    clientVersion: '7.8.0',
  });
}

describe('IotDeviceManagementService', () => {
  let service: IotDeviceManagementService;
  let prisma: {
    cameraProvider: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      count: jest.Mock;
    };
    cameraGateway: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      count: jest.Mock;
    };
    cameraGroup: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    camera: {
      findMany: jest.Mock;
      count: jest.Mock;
      findFirst: jest.Mock;
    };
    cameraStallMapping: { findMany: jest.Mock; findFirst: jest.Mock };
    parkingSpace: { count: jest.Mock };
    cameraEvent: { count: jest.Mock };
    cameraEventRaw: { findMany: jest.Mock; findUnique: jest.Mock };
    parkingSpaceStatusHistory: { findMany: jest.Mock; findFirst: jest.Mock };
    alert: { count: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      cameraProvider: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      cameraGateway: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      cameraGroup: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      camera: {
        findMany: jest.fn(),
        count: jest.fn(),
        findFirst: jest.fn(),
      },
      cameraStallMapping: { findMany: jest.fn(), findFirst: jest.fn() },
      parkingSpace: { count: jest.fn() },
      cameraEvent: { count: jest.fn() },
      cameraEventRaw: { findMany: jest.fn(), findUnique: jest.fn() },
      parkingSpaceStatusHistory: { findMany: jest.fn(), findFirst: jest.fn() },
      alert: { count: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IotDeviceManagementService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<IotDeviceManagementService>(
      IotDeviceManagementService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('providers', () => {
    it('creates a provider with active defaulting to true', async () => {
      prisma.cameraProvider.create.mockResolvedValue({ id: 'prov-1' });

      await service.createProvider({
        code: 'AXIS_VAPIX',
        name: 'Axis VAPIX',
        protocol: 'VAPIX',
        capabilities: ['OCCUPANCY_UPDATE'],
        defaultAuthMode: 'ip_allowlist',
        endpointTemplates: { OCCUPANCY_UPDATE: '/status' },
      });

      const [createArgs] = prisma.cameraProvider.create.mock.calls[0] as [
        { data: Record<string, unknown> },
      ];
      expect(createArgs.data.active).toBe(true);
      expect(createArgs.data.code).toBe('AXIS_VAPIX');
    });

    it('throws NotFoundException when updating a missing provider', async () => {
      prisma.cameraProvider.findUnique.mockResolvedValue(null);

      await expect(
        service.updateProvider('missing', { name: 'x' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('translates a foreign key violation on delete into ConflictException', async () => {
      prisma.cameraProvider.findUnique.mockResolvedValue({ id: 'prov-1' });
      prisma.cameraProvider.delete.mockRejectedValue(fkViolation());

      await expect(service.deleteProvider('prov-1')).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('gateways', () => {
    it('rejects creation when providerId does not reference an existing provider', async () => {
      prisma.cameraProvider.findUnique.mockResolvedValue(null);

      await expect(
        service.createGateway({
          providerId: 'missing-provider',
          code: 'GW-1',
          name: 'Gateway 1',
          protocol: 'ITSAPI',
          publicBaseUrl: 'http://localhost:3000',
          basePath: '/integrations/dahua/NotificationInfo',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.cameraGateway.create).not.toHaveBeenCalled();
    });

    it('creates a gateway once the provider is resolved', async () => {
      prisma.cameraProvider.findUnique.mockResolvedValue({ id: 'prov-1' });
      prisma.cameraGateway.create.mockResolvedValue({ id: 'gw-1' });

      await service.createGateway({
        providerId: 'prov-1',
        code: 'GW-1',
        name: 'Gateway 1',
        protocol: 'ITSAPI',
        publicBaseUrl: 'http://localhost:3000',
        basePath: '/integrations/dahua/NotificationInfo',
      });

      expect(prisma.cameraGateway.create).toHaveBeenCalled();
    });
  });

  describe('groups', () => {
    it('does not filter by tenant for SUPER_ADMIN', async () => {
      prisma.cameraGroup.findMany.mockResolvedValue([]);
      await service.findGroups(superAdmin);
      const [args] = prisma.cameraGroup.findMany.mock.calls[0] as [
        { where?: Record<string, unknown> },
      ];
      expect(args.where).toBeUndefined();
    });

    it('filters by tenantId for a non-SUPER_ADMIN user', async () => {
      prisma.cameraGroup.findMany.mockResolvedValue([]);
      await service.findGroups(tenantAAdmin);
      const [args] = prisma.cameraGroup.findMany.mock.calls[0] as [
        { where?: Record<string, unknown> },
      ];
      expect(args.where).toEqual({ tenantId: 'tenant-a' });
    });

    it('rejects creating a group when the user has no cityId', () => {
      expect(() =>
        service.createGroup(
          { name: 'Grupo 1' },
          { ...tenantAAdmin, cityId: null },
        ),
      ).toThrow(BadRequestException);
    });

    it('throws NotFoundException when updating a group belonging to another tenant', async () => {
      prisma.cameraGroup.findUnique.mockResolvedValue({
        id: 'group-1',
        tenantId: 'tenant-b',
      });

      await expect(
        service.updateGroup('group-1', { name: 'x' }, tenantAAdmin),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('cameras and mappings', () => {
    it('scopes findCameras by tenant for a non-SUPER_ADMIN user', async () => {
      prisma.camera.findMany.mockResolvedValue([]);
      await service.findCameras(tenantAAdmin);
      const [args] = prisma.camera.findMany.mock.calls[0] as [
        { where?: { AND?: Record<string, unknown>[] } },
      ];
      expect(args.where?.AND).toContainEqual({ tenantId: 'tenant-a' });
    });

    it('scopes findMappings by tenant for a non-SUPER_ADMIN user', async () => {
      prisma.cameraStallMapping.findMany.mockResolvedValue([]);
      await service.findMappings(tenantAAdmin);
      const [args] = prisma.cameraStallMapping.findMany.mock.calls[0] as [
        { where?: Record<string, unknown> },
      ];
      expect(args.where).toEqual({ tenantId: 'tenant-a' });
    });
  });

  describe('dashboard', () => {
    it('computes camerasOffline as the gap between total and online', async () => {
      prisma.camera.count
        .mockResolvedValueOnce(10) // camerasTotal
        .mockResolvedValueOnce(6); // camerasOnline
      prisma.cameraGateway.count.mockResolvedValue(2);
      prisma.cameraProvider.count.mockResolvedValue(1);
      prisma.parkingSpace.count.mockResolvedValue(100);
      prisma.cameraEvent.count.mockResolvedValue(42);
      prisma.camera.findFirst.mockResolvedValue({
        lastSeenAt: new Date('2026-08-02T21:50:00Z'),
      });
      prisma.alert.count.mockResolvedValue(3);

      const result = await service.getDashboard(tenantAAdmin);

      expect(result).toEqual({
        camerasOnline: 6,
        camerasOffline: 4,
        gatewaysCount: 2,
        providersCount: 1,
        spacesCount: 100,
        eventsLast24h: 42,
        lastKeepAliveAt: new Date('2026-08-02T21:50:00Z'),
        alertsOpen: 3,
      });
    });
  });

  describe('monitor', () => {
    const parkingInfoPayload = {
      Picture: {
        NormalPic: {
          Content: 'QUJDREVGRw==REALLYLONGBASE64STRING',
          PicName: 'noplate-20260803.jpg',
          Width: 2688,
          Height: 1584,
        },
        ParkingInfo: {
          DeviceID: '1a85820a-9edf-406a-8338-170689f6099e',
          ParkingStallsNo: 'A001',
          ParkingStatus: 0,
        },
      },
    };

    function parkingInfoRow(overrides: Record<string, unknown> = {}) {
      return {
        id: 'raw-1',
        tenantId: 'tenant-a',
        cameraId: 'camera-1',
        deviceIdRaw: '1a85820a-9edf-406a-8338-170689f6099e',
        eventType: 'ParkingInfo',
        payload: parkingInfoPayload,
        validationStatus: 'VALID',
        processingStatus: 'PROCESSED',
        error: null,
        contextIp: '191.100.93.71',
        receivedAt: new Date('2026-08-04T02:05:00.716Z'),
        camera: { name: 'Cámara Piloto', provider: { code: 'DAHUA_ITSAPI' } },
        events: [
          {
            id: 'event-1',
            idempotencyKey: 'key-1',
            parkingSpace: {
              id: 'space-1',
              code: 'CENTRO-006',
              status: 'occupied',
            },
          },
        ],
        ...overrides,
      };
    }

    it('extracts stall/status from Picture.ParkingInfo (never the payload root) and flags a real status change', async () => {
      prisma.cameraEventRaw.findMany.mockResolvedValue([parkingInfoRow()]);
      prisma.parkingSpaceStatusHistory.findMany.mockResolvedValue([
        { sourceEventId: 'event-1' },
      ]);

      const [result] = await service.findMonitorEvents(tenantAAdmin, {});

      expect(result.externalStallCode).toBe('A001');
      expect(result.externalParkingStatus).toBe(0);
      expect(result.normalizedParkingStatus).toBe('OCCUPIED');
      expect(result.parkingSpaceCode).toBe('CENTRO-006');
      expect(result.parkingSpaceCurrentStatus).toBe('occupied');
      expect(result.statusChanged).toBe(true);
      expect(result.duplicate).toBe(false);
    });

    it('reports statusChanged=false when no ParkingSpaceStatusHistory references this event (idempotent no-op)', async () => {
      prisma.cameraEventRaw.findMany.mockResolvedValue([parkingInfoRow()]);
      prisma.parkingSpaceStatusHistory.findMany.mockResolvedValue([]);

      const [result] = await service.findMonitorEvents(tenantAAdmin, {});

      expect(result.statusChanged).toBe(false);
    });

    it('flags duplicate when processingStatus is DUPLICATE', async () => {
      prisma.cameraEventRaw.findMany.mockResolvedValue([
        parkingInfoRow({ processingStatus: 'DUPLICATE' }),
      ]);
      prisma.parkingSpaceStatusHistory.findMany.mockResolvedValue([]);

      const [result] = await service.findMonitorEvents(tenantAAdmin, {});

      expect(result.duplicate).toBe(true);
    });

    it('returns nulls/false for non-ParkingInfo events (e.g. KeepAlive) instead of misreading the payload', async () => {
      prisma.cameraEventRaw.findMany.mockResolvedValue([
        parkingInfoRow({
          eventType: 'KeepAlive',
          payload: { DeviceID: '1a85820a-9edf-406a-8338-170689f6099e' },
          events: [],
        }),
      ]);
      prisma.parkingSpaceStatusHistory.findMany.mockResolvedValue([]);

      const [result] = await service.findMonitorEvents(tenantAAdmin, {});

      expect(result.externalStallCode).toBeNull();
      expect(result.externalParkingStatus).toBeNull();
      expect(result.normalizedParkingStatus).toBeNull();
      expect(result.parkingSpaceCode).toBeNull();
      expect(result.statusChanged).toBe(false);
    });

    it('findMonitorEvent redacts Picture.NormalPic.Content but keeps PicName/Width/Height, and includes mapping + history', async () => {
      prisma.cameraEventRaw.findUnique.mockResolvedValue(parkingInfoRow());
      prisma.cameraStallMapping.findFirst.mockResolvedValue({
        id: 'mapping-1',
        externalStallCode: 'A001',
        mappingStatus: 'ACTIVE',
        parkingSpace: { code: 'CENTRO-006' },
      });
      prisma.parkingSpaceStatusHistory.findFirst.mockResolvedValue({
        previousStatus: 'available',
        newStatus: 'occupied',
        changedAt: new Date('2026-08-04T02:05:00.778Z'),
      });

      const result = await service.findMonitorEvent('raw-1', tenantAAdmin);

      const picture = (
        result.payload as { Picture: { NormalPic: Record<string, unknown> } }
      ).Picture;
      expect(picture.NormalPic.Content).toBeUndefined();
      expect(picture.NormalPic.contentBase64Length).toBe(
        parkingInfoPayload.Picture.NormalPic.Content.length,
      );
      expect(picture.NormalPic.PicName).toBe('noplate-20260803.jpg');
      expect(picture.NormalPic.Width).toBe(2688);
      expect(picture.NormalPic.Height).toBe(1584);

      expect(result.mappingUsed).toEqual({
        id: 'mapping-1',
        externalStallCode: 'A001',
        mappingStatus: 'ACTIVE',
        parkingSpaceCode: 'CENTRO-006',
      });
      expect(result.statusHistory).toEqual({
        previousStatus: 'available',
        newStatus: 'occupied',
        changedAt: new Date('2026-08-04T02:05:00.778Z'),
      });
      expect(result.statusChanged).toBe(true);
    });

    const timedParkingSpaceInfoPayload = {
      DeviceID: '1a85820a-9edf-406a-8338-170689f6099e',
      Time: '2026-08-10 10:00:00',
      SpaceModeInfo: [
        { ParkNo: 'C01', Used: true, SpaceType: 0 },
        { ParkNo: 'C02', Used: false, SpaceType: 0 },
        { ParkNo: 'C03', Used: true, SpaceType: 0 },
      ],
      ParkingSpacePic: {
        Content: 'QUJDREVGRw==REALLYLONGBASE64STRING',
        PicName: 'snap-20260810.jpg',
      },
    };

    function timedParkingSpaceInfoRow(overrides: Record<string, unknown> = {}) {
      return {
        id: 'raw-tps-1',
        tenantId: 'tenant-a',
        cameraId: 'camera-1',
        deviceIdRaw: '1a85820a-9edf-406a-8338-170689f6099e',
        eventType: 'TimedParkingSpaceInfo',
        payload: timedParkingSpaceInfoPayload,
        validationStatus: 'VALID',
        processingStatus: 'PROCESSED',
        error: null,
        contextIp: '191.100.93.71',
        receivedAt: new Date('2026-08-10T10:00:05.000Z'),
        camera: { name: 'Cámara Piloto', provider: { code: 'DAHUA_ITSAPI' } },
        events: [
          {
            id: 'event-tps-1',
            idempotencyKey: 'key-tps-1',
            metadata: { externalStallCode: 'C01' },
            parkingSpace: {
              id: 'space-c01',
              code: 'CENTRO-020',
              status: 'occupied',
            },
          },
        ],
        ...overrides,
      };
    }

    it('classifies TimedParkingSpaceInfo as OCCUPANCY_SNAPSHOT (not UNCLASSIFIED) and summarizes N stalls without picking one arbitrarily', async () => {
      prisma.cameraEventRaw.findMany.mockResolvedValue([
        timedParkingSpaceInfoRow(),
      ]);
      prisma.parkingSpaceStatusHistory.findMany.mockResolvedValue([
        { sourceEventId: 'event-tps-1' },
      ]);
      prisma.cameraStallMapping.findMany.mockResolvedValue([
        {
          cameraId: 'camera-1',
          externalStallCode: 'C01',
          mappingStatus: 'ACTIVE',
          parkingSpaceId: 'space-c01',
        },
        {
          cameraId: 'camera-1',
          externalStallCode: 'C02',
          mappingStatus: 'ACTIVE',
          parkingSpaceId: 'space-c02',
        },
      ]);

      const [result] = await service.findMonitorEvents(tenantAAdmin, {});

      expect(result.canonicalEventType).toBe('OCCUPANCY_SNAPSHOT');
      expect(result.externalStallCode).toBeNull();
      expect(result.parkingSpaceCode).toBeNull();
      expect(result.occupancySnapshot).toEqual({
        totalSpaces: 3,
        mappedCount: 2,
        unmappedCount: 1,
        occupiedReceived: 2,
        freeReceived: 1,
        changedCount: 1,
      });
      expect(result.statusChanged).toBe(true);
    });

    it('findMonitorEvent returns a per-stall breakdown for TimedParkingSpaceInfo, never a single ParkingSpace/mapping like ParkingInfo', async () => {
      prisma.cameraEventRaw.findUnique.mockResolvedValue(
        timedParkingSpaceInfoRow(),
      );
      prisma.cameraStallMapping.findMany.mockResolvedValue([
        {
          externalStallCode: 'C01',
          mappingStatus: 'ACTIVE',
          parkingSpace: { code: 'CENTRO-020', status: 'occupied' },
        },
      ]);
      prisma.parkingSpaceStatusHistory.findMany.mockResolvedValue([
        {
          sourceEventId: 'event-tps-1',
          previousStatus: 'available',
          newStatus: 'occupied',
        },
      ]);

      const result = await service.findMonitorEvent('raw-tps-1', tenantAAdmin);

      expect(result.canonicalEventType).toBe('OCCUPANCY_SNAPSHOT');
      expect(result.mappingUsed).toBeNull();
      expect(result.occupancySnapshot).not.toBeNull();
      expect(result.occupancySnapshot?.totalSpaces).toBe(3);
      expect(result.occupancySnapshot?.mappedCount).toBe(1);
      expect(result.occupancySnapshot?.changedCount).toBe(1);
      expect(result.occupancySnapshot?.spaces).toEqual([
        {
          externalStallCode: 'C01',
          spaceType: 0,
          receivedUsed: true,
          normalizedStatus: 'OCCUPIED',
          parkingSpaceCode: 'CENTRO-020',
          mappingStatus: 'ACTIVE',
          previousStatus: 'available',
          finalStatus: 'occupied',
          changed: true,
        },
        {
          externalStallCode: 'C02',
          spaceType: 0,
          receivedUsed: false,
          normalizedStatus: 'AVAILABLE',
          parkingSpaceCode: null,
          mappingStatus: null,
          previousStatus: null,
          finalStatus: null,
          changed: false,
        },
        {
          externalStallCode: 'C03',
          spaceType: 0,
          receivedUsed: true,
          normalizedStatus: 'OCCUPIED',
          parkingSpaceCode: null,
          mappingStatus: null,
          previousStatus: null,
          finalStatus: null,
          changed: false,
        },
      ]);

      const parkingSpacePic = (
        result.payload as { ParkingSpacePic: Record<string, unknown> }
      ).ParkingSpacePic;
      expect(parkingSpacePic.Content).toBe(
        `[BASE64 OMITIDO - ${timedParkingSpaceInfoPayload.ParkingSpacePic.Content.length} caracteres]`,
      );
      expect(parkingSpacePic.PicName).toBe('snap-20260810.jpg');
    });
  });
});
