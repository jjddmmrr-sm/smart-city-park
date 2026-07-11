import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        tenant: true,
        city: true,
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
        zoneAccess: {
          include: {
            zone: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const roles = user.userRoles.map((ur) => ur.role.code);
    const permissions = Array.from(
      new Set(
        user.userRoles.flatMap((ur) =>
          ur.role.rolePermissions.map((rp) => rp.permission.code),
        ),
      ),
    );

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      status: user.status,
      tenant: user.tenant,
      city: user.city,
      roles,
      permissions,
      zones: user.zoneAccess.map((za) => ({
        id: za.zone.id,
        code: za.zone.code,
        name: za.zone.name,
        status: za.zone.status,
      })),
    };
  }

  async login(dto: LoginDto, meta?: { ipAddress?: string; userAgent?: string }) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: {
        tenant: true,
        city: true,
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user) {
      await this.prisma.auditLog.create({
        data: {
          action: 'LOGIN_FAILED',
          entity: 'User',
          entityId: dto.email,
          afterData: {
            email: dto.email,
            reason: 'USER_NOT_FOUND',
          },
          ipAddress: meta?.ipAddress,
          userAgent: meta?.userAgent,
        },
      }).catch(() => undefined);

      throw new UnauthorizedException('Invalid credentials');
    }

    const isValid = await bcrypt.compare(dto.password, user.password);

    if (!isValid) {
      await this.prisma.auditLog.create({
        data: {
          tenantId: user.tenantId,
          userId: user.id,
          action: 'LOGIN_FAILED',
          entity: 'User',
          entityId: user.id,
          afterData: {
            email: user.email,
            reason: 'INVALID_PASSWORD',
          },
          ipAddress: meta?.ipAddress,
          userAgent: meta?.userAgent,
        },
      }).catch(() => undefined);

      throw new UnauthorizedException('Invalid credentials');
    }

    const roles = user.userRoles.map((ur) => ur.role.code);

    await this.prisma.auditLog.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        action: 'LOGIN_SUCCESS',
        entity: 'User',
        entityId: user.id,
        afterData: {
          email: user.email,
          roles,
        },
        ipAddress: meta?.ipAddress,
        userAgent: meta?.userAgent,
      },
    }).catch(() => undefined);

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      tenantId: user.tenantId,
      cityId: user.cityId,
      roles,
    });

    return {
      accessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        tenant: user.tenant,
        city: user.city,
        roles,
      },
    };
  }
}
