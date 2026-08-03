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
    cameraStallMapping: { findMany: jest.Mock };
    parkingSpace: { count: jest.Mock };
    cameraEvent: { count: jest.Mock };
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
      cameraStallMapping: { findMany: jest.fn() },
      parkingSpace: { count: jest.fn() },
      cameraEvent: { count: jest.fn() },
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
});
