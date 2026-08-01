import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { JwtPayload } from '../auth/types/jwt-payload.type';

@Injectable()
export class ParkingService {
  constructor(private readonly prisma: PrismaService) {}

  private isSuperAdmin(user: JwtPayload): boolean {
    return user.roles?.includes('SUPER_ADMIN') ?? false;
  }

  private assertTenantAccess(
    user: JwtPayload,
    resourceTenantId: string,
    notFoundMessage: string,
  ) {
    if (!this.isSuperAdmin(user) && user.tenantId !== resourceTenantId) {
      throw new NotFoundException(notFoundMessage);
    }
  }

  async findZones(user: JwtPayload) {
    if (this.isSuperAdmin(user)) {
      return this.prisma.parkingZone.findMany({
        include: { spaces: true },
        orderBy: { name: 'asc' },
      });
    }

    const zoneAccess = await this.prisma.userZoneAccess.findMany({
      where: { userId: user.sub },
      select: { zoneId: true },
    });

    const zoneIds = zoneAccess.map((z) => z.zoneId);

    if (zoneIds.length === 0) {
      return [];
    }

    return this.prisma.parkingZone.findMany({
      where: { id: { in: zoneIds }, tenantId: user.tenantId },
      include: { spaces: true },
      orderBy: { name: 'asc' },
    });
  }

  async createZone(
    data: { name: string; code: string; status?: string },
    user: JwtPayload,
  ) {
    if (!user.cityId) {
      throw new BadRequestException(
        'Authenticated user is not associated with a city',
      );
    }

    return this.prisma.parkingZone.create({
      data: {
        tenantId: user.tenantId,
        cityId: user.cityId,
        name: data.name,
        code: data.code.toUpperCase(),
        status: data.status ?? 'active',
      },
      include: { spaces: true },
    });
  }

  async updateZone(
    id: string,
    data: { name?: string; code?: string; status?: string },
    user: JwtPayload,
  ) {
    const zone = await this.prisma.parkingZone.findUnique({ where: { id } });

    if (!zone) {
      throw new NotFoundException('Parking zone not found');
    }

    this.assertTenantAccess(user, zone.tenantId, 'Parking zone not found');

    return this.prisma.parkingZone.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.code !== undefined ? { code: data.code.toUpperCase() } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
      },
      include: { spaces: true },
    });
  }

  async findSpaces(user: JwtPayload) {
    if (this.isSuperAdmin(user)) {
      return this.prisma.parkingSpace.findMany({
        include: { zone: true, sessions: true },
        orderBy: { code: 'asc' },
      });
    }

    const zoneAccess = await this.prisma.userZoneAccess.findMany({
      where: { userId: user.sub },
      select: { zoneId: true },
    });

    const zoneIds = zoneAccess.map((z) => z.zoneId);

    if (zoneIds.length === 0) {
      return [];
    }

    return this.prisma.parkingSpace.findMany({
      where: {
        zoneId: { in: zoneIds },
        tenantId: user.tenantId,
      },
      include: { zone: true, sessions: true },
      orderBy: { code: 'asc' },
    });
  }

  async createSpace(
    data: {
      zoneId: string;
      code: string;
      label?: string;
      type?: string;
      status?: string;
      latitude?: number;
      longitude?: number;
    },
    user: JwtPayload,
  ) {
    const zone = await this.prisma.parkingZone.findUnique({
      where: { id: data.zoneId },
    });

    if (!zone) {
      throw new NotFoundException('Parking zone not found');
    }

    this.assertTenantAccess(user, zone.tenantId, 'Parking zone not found');

    return this.prisma.parkingSpace.create({
      data: {
        tenantId: zone.tenantId,
        cityId: zone.cityId,
        zoneId: data.zoneId,
        code: data.code.toUpperCase(),
        label: data.label,
        type: data.type ?? 'vehicle',
        status: data.status ?? 'available',
        latitude: data.latitude !== undefined ? Number(data.latitude) : null,
        longitude: data.longitude !== undefined ? Number(data.longitude) : null,
      },
      include: { zone: true },
    });
  }

  async updateSpace(
    id: string,
    data: {
      zoneId?: string;
      code?: string;
      label?: string;
      type?: string;
      status?: string;
      latitude?: number;
      longitude?: number;
    },
    user: JwtPayload,
  ) {
    const space = await this.prisma.parkingSpace.findUnique({ where: { id } });

    if (!space) {
      throw new NotFoundException('Parking space not found');
    }

    this.assertTenantAccess(user, space.tenantId, 'Parking space not found');

    if (data.zoneId !== undefined) {
      const zone = await this.prisma.parkingZone.findUnique({
        where: { id: data.zoneId },
      });

      if (!zone) {
        throw new NotFoundException('Parking zone not found');
      }

      this.assertTenantAccess(user, zone.tenantId, 'Parking zone not found');
    }

    return this.prisma.parkingSpace.update({
      where: { id },
      data: {
        ...(data.zoneId !== undefined ? { zoneId: data.zoneId } : {}),
        ...(data.code !== undefined ? { code: data.code.toUpperCase() } : {}),
        ...(data.label !== undefined ? { label: data.label } : {}),
        ...(data.type !== undefined ? { type: data.type } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.latitude !== undefined
          ? { latitude: Number(data.latitude) }
          : {}),
        ...(data.longitude !== undefined
          ? { longitude: Number(data.longitude) }
          : {}),
      },
      include: { zone: true },
    });
  }

  async findControllers(user: JwtPayload) {
    if (this.isSuperAdmin(user)) {
      return this.prisma.inspector.findMany({
        include: { assignedZone: true },
        orderBy: { createdAt: 'desc' },
      });
    }

    const zoneAccess = await this.prisma.userZoneAccess.findMany({
      where: { userId: user.sub },
      select: { zoneId: true },
    });

    const zoneIds = zoneAccess.map((z) => z.zoneId);

    if (zoneIds.length === 0) {
      return [];
    }

    return this.prisma.inspector.findMany({
      where: {
        assignedZoneId: { in: zoneIds },
        tenantId: user.tenantId,
      },
      include: { assignedZone: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createController(
    data: {
      name: string;
      email?: string;
      phone?: string;
      assignedZoneId?: string;
      deviceId?: string;
      shift?: string;
      status?: string;
    },
    user: JwtPayload,
  ) {
    if (!user.cityId) {
      throw new BadRequestException(
        'Authenticated user is not associated with a city',
      );
    }

    if (data.assignedZoneId) {
      const zone = await this.prisma.parkingZone.findUnique({
        where: { id: data.assignedZoneId },
      });

      if (!zone) {
        throw new NotFoundException('Parking zone not found');
      }

      this.assertTenantAccess(user, zone.tenantId, 'Parking zone not found');
    }

    return this.prisma.inspector.create({
      data: {
        tenantId: user.tenantId,
        cityId: user.cityId,
        name: data.name,
        email: data.email,
        phone: data.phone,
        assignedZoneId: data.assignedZoneId || null,
        deviceId: data.deviceId,
        shift: data.shift ?? 'mixto',
        status: data.status ?? 'active',
      },
      include: { assignedZone: true },
    });
  }

  async updateController(
    id: string,
    data: {
      name?: string;
      email?: string;
      phone?: string;
      assignedZoneId?: string;
      deviceId?: string;
      shift?: string;
      status?: string;
    },
    user: JwtPayload,
  ) {
    const inspector = await this.prisma.inspector.findUnique({ where: { id } });

    if (!inspector) {
      throw new NotFoundException('Controller not found');
    }

    this.assertTenantAccess(user, inspector.tenantId, 'Controller not found');

    if (data.assignedZoneId !== undefined && data.assignedZoneId) {
      const zone = await this.prisma.parkingZone.findUnique({
        where: { id: data.assignedZoneId },
      });

      if (!zone) {
        throw new NotFoundException('Parking zone not found');
      }

      this.assertTenantAccess(user, zone.tenantId, 'Parking zone not found');
    }

    return this.prisma.inspector.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.email !== undefined ? { email: data.email } : {}),
        ...(data.phone !== undefined ? { phone: data.phone } : {}),
        ...(data.assignedZoneId !== undefined
          ? { assignedZoneId: data.assignedZoneId || null }
          : {}),
        ...(data.deviceId !== undefined ? { deviceId: data.deviceId } : {}),
        ...(data.shift !== undefined ? { shift: data.shift } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
      },
      include: { assignedZone: true },
    });
  }

  findVehicles(user: JwtPayload) {
    return this.prisma.vehicle.findMany({
      where: this.isSuperAdmin(user) ? undefined : { tenantId: user.tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createVehicle(
    data: {
      cityId: string;
      plateNumber: string;
      ownerName?: string;
      ownerPhone?: string;
      ownerEmail?: string;
    },
    user: JwtPayload,
  ) {
    const city = await this.prisma.city.findUnique({
      where: { id: data.cityId },
    });

    if (!city || city.tenantId !== user.tenantId) {
      throw new BadRequestException('Invalid city for the current tenant');
    }

    const plateNumber = data.plateNumber.toUpperCase();

    return this.prisma.vehicle.upsert({
      where: {
        tenantId_plateNumber: {
          tenantId: user.tenantId,
          plateNumber,
        },
      },
      update: {
        ownerName: data.ownerName,
        ownerPhone: data.ownerPhone,
        ownerEmail: data.ownerEmail,
        status: 'active',
      },
      create: {
        tenantId: user.tenantId,
        cityId: data.cityId,
        plateNumber,
        ownerName: data.ownerName,
        ownerPhone: data.ownerPhone,
        ownerEmail: data.ownerEmail,
      },
    });
  }

  findFineTypes(user: JwtPayload) {
    return this.prisma.fineType.findMany({
      where: this.isSuperAdmin(user) ? undefined : { tenantId: user.tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createFineType(
    data: {
      code: string;
      name: string;
      description?: string;
      amount: number;
      status?: string;
    },
    user: JwtPayload,
  ) {
    const code = data.code.toUpperCase();

    return this.prisma.fineType.upsert({
      where: {
        tenantId_code: {
          tenantId: user.tenantId,
          code,
        },
      },
      update: {
        name: data.name,
        description: data.description,
        amount: Number(data.amount),
        status: data.status ?? 'active',
      },
      create: {
        tenantId: user.tenantId,
        code,
        name: data.name,
        description: data.description,
        amount: Number(data.amount),
        status: data.status ?? 'active',
      },
    });
  }

  async updateFineType(
    id: string,
    data: {
      code?: string;
      name?: string;
      description?: string;
      amount?: number;
      status?: string;
    },
    user: JwtPayload,
  ) {
    const fineType = await this.prisma.fineType.findUnique({ where: { id } });

    if (!fineType) {
      throw new NotFoundException('Fine type not found');
    }

    this.assertTenantAccess(user, fineType.tenantId, 'Fine type not found');

    return this.prisma.fineType.update({
      where: { id },
      data: {
        ...(data.code !== undefined ? { code: data.code.toUpperCase() } : {}),
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined
          ? { description: data.description }
          : {}),
        ...(data.amount !== undefined ? { amount: Number(data.amount) } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
      },
    });
  }

  findPaymentMethods(user: JwtPayload) {
    return this.prisma.paymentMethod.findMany({
      where: this.isSuperAdmin(user) ? undefined : { tenantId: user.tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createPaymentMethod(
    data: {
      code: string;
      name: string;
      description?: string;
      status?: string;
    },
    user: JwtPayload,
  ) {
    const code = data.code.toUpperCase();

    return this.prisma.paymentMethod.upsert({
      where: {
        tenantId_code: {
          tenantId: user.tenantId,
          code,
        },
      },
      update: {
        name: data.name,
        description: data.description,
        status: data.status ?? 'active',
      },
      create: {
        tenantId: user.tenantId,
        code,
        name: data.name,
        description: data.description,
        status: data.status ?? 'active',
      },
    });
  }

  async updatePaymentMethod(
    id: string,
    data: {
      code?: string;
      name?: string;
      description?: string;
      status?: string;
    },
    user: JwtPayload,
  ) {
    const method = await this.prisma.paymentMethod.findUnique({
      where: { id },
    });

    if (!method) {
      throw new NotFoundException('Payment method not found');
    }

    this.assertTenantAccess(user, method.tenantId, 'Payment method not found');

    return this.prisma.paymentMethod.update({
      where: { id },
      data: {
        ...(data.code !== undefined ? { code: data.code.toUpperCase() } : {}),
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined
          ? { description: data.description }
          : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
      },
    });
  }

  findRates(user: JwtPayload) {
    return this.prisma.parkingRate.findMany({
      where: this.isSuperAdmin(user) ? undefined : { tenantId: user.tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createRate(
    data: {
      name: string;
      code: string;
      currency?: string;
      pricePerMinute: number;
      minimumMinutes?: number;
      status?: string;
    },
    user: JwtPayload,
  ) {
    if (!user.cityId) {
      throw new BadRequestException(
        'Authenticated user is not associated with a city',
      );
    }

    const code = data.code.toUpperCase();

    return this.prisma.parkingRate.upsert({
      where: {
        cityId_code: {
          cityId: user.cityId,
          code,
        },
      },
      update: {
        name: data.name,
        currency: data.currency ?? 'USD',
        pricePerMinute: Number(data.pricePerMinute),
        minimumMinutes: data.minimumMinutes ?? 15,
        status: data.status ?? 'active',
      },
      create: {
        tenantId: user.tenantId,
        cityId: user.cityId,
        name: data.name,
        code,
        currency: data.currency ?? 'USD',
        pricePerMinute: Number(data.pricePerMinute),
        minimumMinutes: data.minimumMinutes ?? 15,
        status: data.status ?? 'active',
      },
    });
  }

  async updateRate(
    id: string,
    data: {
      name?: string;
      code?: string;
      currency?: string;
      pricePerMinute?: number;
      minimumMinutes?: number;
      status?: string;
    },
    user: JwtPayload,
  ) {
    const rate = await this.prisma.parkingRate.findUnique({ where: { id } });

    if (!rate) {
      throw new NotFoundException('Parking rate not found');
    }

    this.assertTenantAccess(user, rate.tenantId, 'Parking rate not found');

    return this.prisma.parkingRate.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.code !== undefined ? { code: data.code.toUpperCase() } : {}),
        ...(data.currency !== undefined ? { currency: data.currency } : {}),
        ...(data.pricePerMinute !== undefined
          ? { pricePerMinute: Number(data.pricePerMinute) }
          : {}),
        ...(data.minimumMinutes !== undefined
          ? { minimumMinutes: Number(data.minimumMinutes) }
          : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
      },
    });
  }

  findSessions(user: JwtPayload) {
    return this.prisma.parkingSession.findMany({
      where: this.isSuperAdmin(user) ? undefined : { tenantId: user.tenantId },
      include: {
        vehicle: true,
        space: true,
        city: true,
      },
      orderBy: { startedAt: 'desc' },
    });
  }

  async startSession(
    data: { spaceId: string; vehicleId: string },
    user: JwtPayload,
  ) {
    const space = await this.prisma.parkingSpace.findUnique({
      where: { id: data.spaceId },
    });

    if (!space) {
      throw new NotFoundException('Parking space not found');
    }

    this.assertTenantAccess(user, space.tenantId, 'Parking space not found');

    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: data.vehicleId },
    });

    if (!vehicle) {
      throw new NotFoundException('Vehicle not found');
    }

    this.assertTenantAccess(user, vehicle.tenantId, 'Vehicle not found');

    const activeSession = await this.prisma.parkingSession.findFirst({
      where: {
        spaceId: data.spaceId,
        status: 'active',
      },
    });

    if (activeSession) {
      throw new BadRequestException(
        'Parking space already has an active session',
      );
    }

    await this.prisma.parkingSpace.update({
      where: { id: data.spaceId },
      data: { status: 'occupied' },
    });

    return this.prisma.parkingSession.create({
      data: {
        tenantId: space.tenantId,
        cityId: space.cityId,
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

  async endSession(sessionId: string, user: JwtPayload) {
    const session = await this.prisma.parkingSession.findUnique({
      where: { id: sessionId },
      include: { city: true },
    });

    if (!session) {
      throw new NotFoundException('Parking session not found');
    }

    this.assertTenantAccess(
      user,
      session.tenantId,
      'Parking session not found',
    );

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
