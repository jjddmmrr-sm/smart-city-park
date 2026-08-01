import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { FrontendService } from './frontend.service';
import { PrismaService } from '../prisma/prisma.service';
import type { JwtPayload } from '../auth/types/jwt-payload.type';

const tenantAUser: JwtPayload = {
  sub: 'user-a',
  email: 'admin@tenant-a.com',
  tenantId: 'tenant-a',
  cityId: 'city-a',
  roles: ['ADMIN'],
};

describe('FrontendService', () => {
  let service: FrontendService;
  let prisma: {
    parkingSpace: { count: jest.Mock; findMany: jest.Mock };
    parkingSession: {
      count: jest.Mock;
      aggregate: jest.Mock;
      findMany: jest.Mock;
    };
    vehicle: { count: jest.Mock };
    fine: { aggregate: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
    enforcementCase: {
      count: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      parkingSpace: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn(),
      },
      parkingSession: {
        count: jest.fn().mockResolvedValue(0),
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 } }),
        findMany: jest.fn(),
      },
      vehicle: { count: jest.fn().mockResolvedValue(0) },
      fine: {
        aggregate: jest
          .fn()
          .mockResolvedValue({ _sum: { amount: 0 }, _count: { id: 0 } }),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      enforcementCase: {
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FrontendService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<FrontendService>(FrontendService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getOverview', () => {
    it('scopes every count query by tenantId for non SUPER_ADMIN callers', async () => {
      await service.getOverview(tenantAUser);

      expect(prisma.parkingSpace.count).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenantId: 'tenant-a' } }),
      );
      expect(prisma.vehicle.count).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenantId: 'tenant-a' } }),
      );
      expect(prisma.fine.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenantId: 'tenant-a' } }),
      );
    });
  });

  describe('updateFineStatus', () => {
    it('rejects updating a fine owned by another tenant', async () => {
      prisma.fine.findUnique.mockResolvedValue({
        id: 'fine-b',
        tenantId: 'tenant-b',
      });

      await expect(
        service.updateFineStatus('fine-b', 'paid', tenantAUser),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.fine.update).not.toHaveBeenCalled();
    });
  });

  describe('updateEnforcementStatus', () => {
    it('rejects updating an enforcement case owned by another tenant', async () => {
      prisma.enforcementCase.findUnique.mockResolvedValue({
        id: 'case-b',
        tenantId: 'tenant-b',
      });

      await expect(
        service.updateEnforcementStatus('case-b', 'resolved', tenantAUser),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.enforcementCase.update).not.toHaveBeenCalled();
    });
  });
});
