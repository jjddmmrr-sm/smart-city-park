import { Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const users = await this.prisma.user.findMany({
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      status: u.status,
      tenantId: u.tenantId,
      cityId: u.cityId,
      roles: u.userRoles.map((ur) => ur.role.code),
      createdAt: u.createdAt,
    }));
  }

  async create(dto: CreateUserDto) {
    const admin = await this.prisma.user.findFirst({
      where: { email: 'admin@smartparking.com' },
    });

    if (!admin) {
      throw new NotFoundException('Base admin user not found');
    }

    const password = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        tenantId: admin.tenantId,
        cityId: admin.cityId,
        email: dto.email,
        name: dto.name,
        password,
        status: dto.status ?? 'active',
      },
    });

    if (dto.roleCode) {
      const role = await this.prisma.role.findUnique({
        where: { code: dto.roleCode },
      });

      if (role) {
        await this.prisma.userRole.create({
          data: {
            userId: user.id,
            roleId: role.id,
          },
        });
      }
    }

    return this.findOneSafe(user.id);
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const data: {
      name?: string;
      email?: string;
      status?: string;
      password?: string;
    } = {};

    if (dto.name !== undefined) data.name = dto.name;
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.password !== undefined && dto.password.trim().length > 0) {
      data.password = await bcrypt.hash(dto.password, 10);
    }

    await this.prisma.user.update({
      where: { id },
      data,
    });

    if (dto.roleCode) {
      const role = await this.prisma.role.findUnique({
        where: { code: dto.roleCode },
      });

      if (role) {
        await this.prisma.userRole.deleteMany({
          where: { userId: id },
        });

        await this.prisma.userRole.create({
          data: {
            userId: id,
            roleId: role.id,
          },
        });
      }
    }

    return this.findOneSafe(id);
  }

  async getUserZones(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        zoneAccess: {
          include: {
            zone: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      userId: user.id,
      zones: user.zoneAccess.map((za) => za.zone),
      zoneIds: user.zoneAccess.map((za) => za.zoneId),
    };
  }

  async updateUserZones(id: string, zoneIds: string[]) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.userZoneAccess.deleteMany({
      where: { userId: id },
    });

    if (zoneIds.length > 0) {
      await this.prisma.userZoneAccess.createMany({
        data: zoneIds.map((zoneId) => ({
          userId: id,
          zoneId,
        })),
        skipDuplicates: true,
      });
    }

    return this.getUserZones(id);
  }

  private async findOneSafe(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      status: user.status,
      tenantId: user.tenantId,
      cityId: user.cityId,
      roles: user.userRoles.map((ur) => ur.role.code),
      createdAt: user.createdAt,
    };
  }
}
