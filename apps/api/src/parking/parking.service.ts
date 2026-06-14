import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ParkingService {
  constructor(private readonly prisma: PrismaService) {}

  findZones() {
    return this.prisma.parkingZone.findMany({ include: { spaces: true } });
  }

  createZone(data: { tenantId: string; cityId: string; name: string; code: string }) {
    return this.prisma.parkingZone.create({ data });
  }

  findSpaces() {
    return this.prisma.parkingSpace.findMany({ include: { zone: true, sessions: true } });
  }

  createSpace(data: {
    tenantId: string;
    cityId: string;
    zoneId: string;
    code: string;
    label?: string;
    type?: string;
    status?: string;
    latitude?: number;
    longitude?: number;
  }) {
    return this.prisma.parkingSpace.create({ data });
  }

  findVehicles() {
    return this.prisma.vehicle.findMany({ orderBy: { createdAt: 'desc' } });
  }

  createVehicle(data: {
    tenantId: string;
    cityId: string;
    plateNumber: string;
    ownerName?: string;
    ownerPhone?: string;
    ownerEmail?: string;
  }) {
    return this.prisma.vehicle.upsert({
      where: {
        tenantId_plateNumber: {
          tenantId: data.tenantId,
          plateNumber: data.plateNumber.toUpperCase(),
        },
      },
      update: {
        ownerName: data.ownerName,
        ownerPhone: data.ownerPhone,
        ownerEmail: data.ownerEmail,
        status: 'active',
      },
      create: {
        ...data,
        plateNumber: data.plateNumber.toUpperCase(),
      },
    });
  }

  findRates() {
    return this.prisma.parkingRate.findMany({ orderBy: { createdAt: 'desc' } });
  }

  createRate(data: {
    tenantId: string;
    cityId: string;
    name: string;
    code: string;
    currency?: string;
    pricePerMinute: number;
    minimumMinutes?: number;
  }) {
    return this.prisma.parkingRate.upsert({
      where: {
        cityId_code: {
          cityId: data.cityId,
          code: data.code,
        },
      },
      update: data,
      create: data,
    });
  }

  findSessions() {
    return this.prisma.parkingSession.findMany({
      include: {
        vehicle: true,
        space: true,
        city: true,
      },
      orderBy: { startedAt: 'desc' },
    });
  }

  async startSession(data: {
    tenantId: string;
    cityId: string;
    spaceId: string;
    vehicleId: string;
  }) {
    const activeSession = await this.prisma.parkingSession.findFirst({
      where: {
        spaceId: data.spaceId,
        status: 'active',
      },
    });

    if (activeSession) {
      throw new BadRequestException('Parking space already has an active session');
    }

    await this.prisma.parkingSpace.update({
      where: { id: data.spaceId },
      data: { status: 'occupied' },
    });

    return this.prisma.parkingSession.create({
      data: {
        tenantId: data.tenantId,
        cityId: data.cityId,
        spaceId: data.spaceId,
        vehicleId: data.vehicleId,
        status: 'active',
      },
      include: {
        vehicle: true,
        space: true,
      },
    });
  }

  async endSession(sessionId: string) {
    const session = await this.prisma.parkingSession.findUnique({
      where: { id: sessionId },
      include: { city: true },
    });

    if (!session) {
      throw new NotFoundException('Parking session not found');
    }

    if (session.status !== 'active') {
      throw new BadRequestException('Parking session is not active');
    }

    const rate = await this.prisma.parkingRate.findFirst({
      where: {
        cityId: session.cityId,
        status: 'active',
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!rate) {
      throw new BadRequestException('No active parking rate configured');
    }

    const endedAt = new Date();
    const minutes = Math.max(
      rate.minimumMinutes,
      Math.ceil((endedAt.getTime() - session.startedAt.getTime()) / 60000),
    );

    const amount = Number((minutes * rate.pricePerMinute).toFixed(2));

    await this.prisma.parkingSpace.update({
      where: { id: session.spaceId },
      data: { status: 'available' },
    });

    return this.prisma.parkingSession.update({
      where: { id: sessionId },
      data: {
        endedAt,
        status: 'completed',
        amount,
      },
      include: {
        vehicle: true,
        space: true,
      },
    });
  }
}
