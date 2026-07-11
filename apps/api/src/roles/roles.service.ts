import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  findRoles() {
    return this.prisma.role.findMany({
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
        userRoles: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  createRole(dto: CreateRoleDto) {
    return this.prisma.role.create({
      data: dto,
    });
  }

  async updateRole(id: string, dto: UpdateRoleDto) {
    const role = await this.prisma.role.findUnique({ where: { id } });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    return this.prisma.role.update({
      where: { id },
      data: dto,
    });
  }

  async getRolePermissions(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    return {
      roleId: role.id,
      roleCode: role.code,
      permissions: role.rolePermissions.map((rp) => rp.permission),
      permissionCodes: role.rolePermissions.map((rp) => rp.permission.code),
    };
  }

  async updateRolePermissions(id: string, permissionCodes: string[]) {
    const role = await this.prisma.role.findUnique({ where: { id } });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    const permissions = await this.prisma.permission.findMany({
      where: {
        code: {
          in: permissionCodes,
        },
      },
    });

    await this.prisma.rolePermission.deleteMany({
      where: { roleId: id },
    });

    await this.prisma.rolePermission.createMany({
      data: permissions.map((permission) => ({
        roleId: id,
        permissionId: permission.id,
      })),
      skipDuplicates: true,
    });

    return this.getRolePermissions(id);
  }

  findPermissions() {
    return this.prisma.permission.findMany({
      include: {
        rolePermissions: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  createPermission(dto: CreatePermissionDto) {
    return this.prisma.permission.create({
      data: dto,
    });
  }

  async updatePermission(id: string, dto: UpdatePermissionDto) {
    const permission = await this.prisma.permission.findUnique({
      where: { id },
    });

    if (!permission) {
      throw new NotFoundException('Permission not found');
    }

    return this.prisma.permission.update({
      where: { id },
      data: dto,
    });
  }
}
