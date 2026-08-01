import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ParkingService } from './parking.service';
import { PrismaService } from '../prisma/prisma.service';
import type { JwtPayload } from '../auth/types/jwt-payload.type';

const tenantAUser: JwtPayload = {
  sub: 'user-a',
  email: 'admin@tenant-a.com',
  tenantId: 'tenant-a',
  cityId: 'city-a',
  roles: ['ADMIN'],
};

const tenantBZone = { id: 'zone-b', tenantId: 'tenant-b', cityId: 'city-b' };

describe('ParkingService', () => {
  let service: ParkingService;
  let prisma: {
    parkingZone: {
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    parkingSpace: { findUnique: jest.Mock; update: jest.Mock };
    vehicle: { findMany: jest.Mock; findUnique: jest.Mock };
    parkingSession: { findFirst: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      parkingZone: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      parkingSpace: { findUnique: jest.fn(), update: jest.fn() },
      vehicle: { findMany: jest.fn(), findUnique: jest.fn() },
      parkingSession: { findFirst: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ParkingService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<ParkingService>(ParkingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createZone', () => {
    it('attributes the new zone to the caller tenant/city, not a hardcoded admin', async () => {
      prisma.parkingZone.create.mockResolvedValue({ id: 'zone-1' });

      await service.createZone({ name: 'Centro', code: 'ctr' }, tenantAUser);

      const [[callArgs]] = prisma.parkingZone.create.mock.calls as [
        [{ data: { tenantId: string; cityId: string } }],
      ];

      expect(callArgs.data.tenantId).toBe('tenant-a');
      expect(callArgs.data.cityId).toBe('city-a');
    });

    it('rejects when the caller has no assigned city', async () => {
      const userWithoutCity: JwtPayload = { ...tenantAUser, cityId: null };

      await expect(
        service.createZone({ name: 'Centro', code: 'ctr' }, userWithoutCity),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.parkingZone.create).not.toHaveBeenCalled();
    });
  });

  describe('updateZone', () => {
    it('returns not found when the zone belongs to another tenant', async () => {
      prisma.parkingZone.findUnique.mockResolvedValue(tenantBZone);

      await expect(
        service.updateZone('zone-b', { name: 'x' }, tenantAUser),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.parkingZone.update).not.toHaveBeenCalled();
    });

    it('allows SUPER_ADMIN to update a zone from any tenant', async () => {
      prisma.parkingZone.findUnique.mockResolvedValue(tenantBZone);
      prisma.parkingZone.update.mockResolvedValue({ id: 'zone-b' });

      const superAdmin: JwtPayload = { ...tenantAUser, roles: ['SUPER_ADMIN'] };

      await service.updateZone('zone-b', { name: 'x' }, superAdmin);

      expect(prisma.parkingZone.update).toHaveBeenCalled();
    });
  });

  describe('createSpace', () => {
    it('rejects creating a space in a zone owned by another tenant', async () => {
      prisma.parkingZone.findUnique.mockResolvedValue(tenantBZone);

      await expect(
        service.createSpace({ zoneId: 'zone-b', code: 'A1' }, tenantAUser),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('findVehicles', () => {
    it('scopes by tenantId for non SUPER_ADMIN callers', async () => {
      prisma.vehicle.findMany.mockResolvedValue([]);

      await service.findVehicles(tenantAUser);

      expect(prisma.vehicle.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenantId: 'tenant-a' } }),
      );
    });

    it('does not filter by tenant for SUPER_ADMIN callers', async () => {
      prisma.vehicle.findMany.mockResolvedValue([]);
      const superAdmin: JwtPayload = { ...tenantAUser, roles: ['SUPER_ADMIN'] };

      await service.findVehicles(superAdmin);

      expect(prisma.vehicle.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: undefined }),
      );
    });
  });

  describe('startSession', () => {
    it('rejects starting a session on a space owned by another tenant', async () => {
      prisma.parkingSpace.findUnique.mockResolvedValue({
        id: 'space-b',
        tenantId: 'tenant-b',
        cityId: 'city-b',
      });

      await expect(
        service.startSession(
          { spaceId: 'space-b', vehicleId: 'vehicle-1' },
          tenantAUser,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.vehicle.findUnique).not.toHaveBeenCalled();
    });

    it('rejects starting a session with a vehicle owned by another tenant', async () => {
      prisma.parkingSpace.findUnique.mockResolvedValue({
        id: 'space-a',
        tenantId: 'tenant-a',
        cityId: 'city-a',
      });
      prisma.vehicle.findUnique.mockResolvedValue({
        id: 'vehicle-b',
        tenantId: 'tenant-b',
      });

      await expect(
        service.startSession(
          { spaceId: 'space-a', vehicleId: 'vehicle-b' },
          tenantAUser,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
