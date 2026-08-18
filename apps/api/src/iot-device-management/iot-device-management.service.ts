import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { JwtPayload } from '../auth/types/jwt-payload.type';
import type { CreateCameraProviderDto } from './dto/create-camera-provider.dto';
import type { UpdateCameraProviderDto } from './dto/update-camera-provider.dto';
import type { CreateCameraGatewayDto } from './dto/create-camera-gateway.dto';
import type { UpdateCameraGatewayDto } from './dto/update-camera-gateway.dto';
import type { CreateCameraGroupDto } from './dto/create-camera-group.dto';
import type { UpdateCameraGroupDto } from './dto/update-camera-group.dto';
import type { UpdateCameraDto } from './dto/update-camera.dto';
import type { CreateCameraStallMappingDto } from './dto/create-camera-stall-mapping.dto';
import type { UpdateCameraStallMappingDto } from './dto/update-camera-stall-mapping.dto';
import { resolveOccupancyStatus } from '../camera-gateway/providers/dahua/normalizer';
import { translateOccupancyStatus } from '../camera-gateway/providers/dahua/dahua-provider.adapter';

export interface CameraFilters {
  q?: string;
  providerId?: string;
  gatewayId?: string;
  groupId?: string;
  zoneId?: string;
  registrationStatus?: string;
  online?: 'true' | 'false';
}

export interface MonitorFilters {
  cameraId?: string;
  providerId?: string;
  eventType?: string;
  validationStatus?: string;
  processingStatus?: string;
  from?: string;
  to?: string;
  limit?: number;
}

/**
 * A camera is considered online if it reported (DeviceInfo/KeepAlive/
 * ParkingInfo, any of which advance lastSeenAt) within this window — see
 * CameraIngestionCoreService. Placeholder heuristic for the Dashboard's
 * Online/Offline cards; not used anywhere else.
 */
const ONLINE_THRESHOLD_MINUTES = 5;

@Injectable()
export class IotDeviceManagementService {
  constructor(private readonly prisma: PrismaService) {}

  private isSuperAdmin(user: JwtPayload): boolean {
    return user.roles?.includes('SUPER_ADMIN') ?? false;
  }

  private tenantFilter(user: JwtPayload): { tenantId: string } | undefined {
    return this.isSuperAdmin(user) ? undefined : { tenantId: user.tenantId };
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

  private isForeignKeyViolation(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2003'
    );
  }

  private isUniqueConstraintViolation(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }

  /**
   * A camera without a tenant yet (unassigned, pending onboarding) is only
   * visible/manageable by SUPER_ADMIN — non-super-admins have no tenant to
   * match against a null tenantId.
   */
  private assertCameraAccess(
    user: JwtPayload,
    camera: { tenantId: string | null },
  ) {
    if (camera.tenantId) {
      this.assertTenantAccess(user, camera.tenantId, 'Camera not found');
    } else if (!this.isSuperAdmin(user)) {
      throw new NotFoundException('Camera not found');
    }
  }

  // ---------------------------------------------------------------------
  // Providers — platform-level catalog, not tenant-scoped (CameraProvider
  // has no tenantId in the schema).
  // ---------------------------------------------------------------------

  findProviders() {
    return this.prisma.cameraProvider.findMany({ orderBy: { name: 'asc' } });
  }

  async findProvider(id: string) {
    const provider = await this.prisma.cameraProvider.findUnique({
      where: { id },
    });
    if (!provider) {
      throw new NotFoundException('Camera provider not found');
    }
    return provider;
  }

  createProvider(dto: CreateCameraProviderDto) {
    return this.prisma.cameraProvider.create({
      data: {
        code: dto.code,
        name: dto.name,
        protocol: dto.protocol,
        capabilities: dto.capabilities,
        defaultAuthMode: dto.defaultAuthMode,
        endpointTemplates: dto.endpointTemplates,
        documentationUrl: dto.documentationUrl ?? null,
        supportUrl: dto.supportUrl ?? null,
        active: dto.active ?? true,
      },
    });
  }

  async updateProvider(id: string, dto: UpdateCameraProviderDto) {
    await this.findProvider(id);
    return this.prisma.cameraProvider.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.protocol !== undefined ? { protocol: dto.protocol } : {}),
        ...(dto.capabilities !== undefined
          ? { capabilities: dto.capabilities }
          : {}),
        ...(dto.defaultAuthMode !== undefined
          ? { defaultAuthMode: dto.defaultAuthMode }
          : {}),
        ...(dto.endpointTemplates !== undefined
          ? {
              endpointTemplates: dto.endpointTemplates,
            }
          : {}),
        ...(dto.documentationUrl !== undefined
          ? { documentationUrl: dto.documentationUrl }
          : {}),
        ...(dto.supportUrl !== undefined ? { supportUrl: dto.supportUrl } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
      },
    });
  }

  async deleteProvider(id: string) {
    await this.findProvider(id);
    try {
      await this.prisma.cameraProvider.delete({ where: { id } });
    } catch (error) {
      if (this.isForeignKeyViolation(error)) {
        throw new ConflictException(
          'Camera provider still has gateways or cameras attached',
        );
      }
      throw error;
    }
    return { id };
  }

  // ---------------------------------------------------------------------
  // Gateways — platform-level catalog, not tenant-scoped.
  // ---------------------------------------------------------------------

  findGateways() {
    return this.prisma.cameraGateway.findMany({
      include: { provider: true },
      orderBy: { name: 'asc' },
    });
  }

  async findGateway(id: string) {
    const gateway = await this.prisma.cameraGateway.findUnique({
      where: { id },
      include: { provider: true },
    });
    if (!gateway) {
      throw new NotFoundException('Camera gateway not found');
    }
    return gateway;
  }

  async createGateway(dto: CreateCameraGatewayDto) {
    const provider = await this.prisma.cameraProvider.findUnique({
      where: { id: dto.providerId },
    });
    if (!provider) {
      throw new BadRequestException(
        'providerId does not reference an existing CameraProvider',
      );
    }

    return this.prisma.cameraGateway.create({
      data: {
        providerId: dto.providerId,
        code: dto.code,
        name: dto.name,
        protocol: dto.protocol,
        publicBaseUrl: dto.publicBaseUrl,
        privateBaseUrl: dto.privateBaseUrl ?? null,
        basePath: dto.basePath,
        active: dto.active ?? true,
      },
      include: { provider: true },
    });
  }

  async updateGateway(id: string, dto: UpdateCameraGatewayDto) {
    await this.findGateway(id);

    if (dto.providerId !== undefined) {
      const provider = await this.prisma.cameraProvider.findUnique({
        where: { id: dto.providerId },
      });
      if (!provider) {
        throw new BadRequestException(
          'providerId does not reference an existing CameraProvider',
        );
      }
    }

    return this.prisma.cameraGateway.update({
      where: { id },
      data: {
        ...(dto.providerId !== undefined ? { providerId: dto.providerId } : {}),
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.protocol !== undefined ? { protocol: dto.protocol } : {}),
        ...(dto.publicBaseUrl !== undefined
          ? { publicBaseUrl: dto.publicBaseUrl }
          : {}),
        ...(dto.privateBaseUrl !== undefined
          ? { privateBaseUrl: dto.privateBaseUrl }
          : {}),
        ...(dto.basePath !== undefined ? { basePath: dto.basePath } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
      },
      include: { provider: true },
    });
  }

  async deleteGateway(id: string) {
    await this.findGateway(id);
    try {
      await this.prisma.cameraGateway.delete({ where: { id } });
    } catch (error) {
      if (this.isForeignKeyViolation(error)) {
        throw new ConflictException(
          'Camera gateway still has cameras or groups attached',
        );
      }
      throw error;
    }
    return { id };
  }

  // ---------------------------------------------------------------------
  // Groups — tenant-scoped (CameraGroup.tenantId/cityId).
  // ---------------------------------------------------------------------

  findGroups(user: JwtPayload) {
    return this.prisma.cameraGroup.findMany({
      where: this.tenantFilter(user),
      include: { zone: true, gateway: true },
      orderBy: { name: 'asc' },
    });
  }

  async findGroup(id: string, user: JwtPayload) {
    const group = await this.prisma.cameraGroup.findUnique({
      where: { id },
      include: { zone: true, gateway: true },
    });
    if (!group) {
      throw new NotFoundException('Camera group not found');
    }
    this.assertTenantAccess(user, group.tenantId, 'Camera group not found');
    return group;
  }

  createGroup(dto: CreateCameraGroupDto, user: JwtPayload) {
    if (!user.cityId) {
      throw new BadRequestException(
        'Authenticated user is not associated with a city',
      );
    }

    return this.prisma.cameraGroup.create({
      data: {
        tenantId: user.tenantId,
        cityId: user.cityId,
        name: dto.name,
        description: dto.description ?? null,
        zoneId: dto.zoneId ?? null,
        gatewayId: dto.gatewayId ?? null,
        active: dto.active ?? true,
      },
      include: { zone: true, gateway: true },
    });
  }

  async updateGroup(id: string, dto: UpdateCameraGroupDto, user: JwtPayload) {
    await this.findGroup(id, user);

    return this.prisma.cameraGroup.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
        ...(dto.zoneId !== undefined ? { zoneId: dto.zoneId } : {}),
        ...(dto.gatewayId !== undefined ? { gatewayId: dto.gatewayId } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
      },
      include: { zone: true, gateway: true },
    });
  }

  async deleteGroup(id: string, user: JwtPayload) {
    await this.findGroup(id, user);
    try {
      await this.prisma.cameraGroup.delete({ where: { id } });
    } catch (error) {
      if (this.isForeignKeyViolation(error)) {
        throw new ConflictException('Camera group still has cameras attached');
      }
      throw error;
    }
    return { id };
  }

  // ---------------------------------------------------------------------
  // Cameras — tenantId/cityId/zoneId/provider/gateway/group are
  // administered exclusively here. CameraIngestionCoreService never
  // accepts them from a provider event.
  // ---------------------------------------------------------------------

  findCameras(user: JwtPayload, filters: CameraFilters = {}) {
    const onlineSince = new Date(
      Date.now() - ONLINE_THRESHOLD_MINUTES * 60 * 1000,
    );
    const and: Prisma.CameraWhereInput[] = [];
    const tenantWhere = this.tenantFilter(user);
    if (tenantWhere) and.push(tenantWhere);
    if (filters.providerId) and.push({ providerId: filters.providerId });
    if (filters.gatewayId) and.push({ gatewayId: filters.gatewayId });
    if (filters.groupId) and.push({ groupId: filters.groupId });
    if (filters.zoneId) and.push({ zoneId: filters.zoneId });
    if (filters.registrationStatus) {
      and.push({ registrationStatus: filters.registrationStatus });
    }
    if (filters.online === 'true') {
      and.push({ lastSeenAt: { gte: onlineSince } });
    }
    if (filters.online === 'false') {
      and.push({
        OR: [{ lastSeenAt: null }, { lastSeenAt: { lt: onlineSince } }],
      });
    }
    if (filters.q) {
      and.push({
        OR: [
          { name: { contains: filters.q, mode: 'insensitive' } },
          { code: { contains: filters.q, mode: 'insensitive' } },
          { deviceId: { contains: filters.q, mode: 'insensitive' } },
          { ipAddress: { contains: filters.q, mode: 'insensitive' } },
        ],
      });
    }

    return this.prisma.camera.findMany({
      where: and.length > 0 ? { AND: and } : undefined,
      include: { provider: true, gateway: true, group: true, zone: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findCamera(id: string, user: JwtPayload) {
    const camera = await this.prisma.camera.findUnique({
      where: { id },
      include: {
        provider: true,
        gateway: true,
        group: true,
        zone: true,
        tenant: true,
        city: true,
      },
    });
    if (!camera) {
      throw new NotFoundException('Camera not found');
    }
    this.assertCameraAccess(user, camera);

    const recentRaw = await this.prisma.cameraEventRaw.findMany({
      where: { cameraId: id },
      orderBy: { receivedAt: 'desc' },
      take: 30,
      select: {
        eventType: true,
        receivedAt: true,
        processingStatus: true,
        validationStatus: true,
      },
    });
    const lastEventsByType = new Map<string, (typeof recentRaw)[number]>();
    for (const row of recentRaw) {
      if (!lastEventsByType.has(row.eventType)) {
        lastEventsByType.set(row.eventType, row);
      }
    }

    return {
      ...camera,
      lastEventsByType: Array.from(lastEventsByType.values()),
    };
  }

  async updateCamera(id: string, dto: UpdateCameraDto, user: JwtPayload) {
    const camera = await this.prisma.camera.findUnique({ where: { id } });
    if (!camera) {
      throw new NotFoundException('Camera not found');
    }
    this.assertCameraAccess(user, camera);

    if (dto.providerId) {
      const provider = await this.prisma.cameraProvider.findUnique({
        where: { id: dto.providerId },
      });
      if (!provider) {
        throw new BadRequestException(
          'providerId does not reference an existing CameraProvider',
        );
      }
    }
    if (dto.gatewayId) {
      const gateway = await this.prisma.cameraGateway.findUnique({
        where: { id: dto.gatewayId },
      });
      if (!gateway) {
        throw new BadRequestException(
          'gatewayId does not reference an existing CameraGateway',
        );
      }
    }
    if (dto.groupId) {
      const group = await this.prisma.cameraGroup.findUnique({
        where: { id: dto.groupId },
      });
      if (!group) {
        throw new BadRequestException(
          'groupId does not reference an existing CameraGroup',
        );
      }
    }
    if (dto.tenantId) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: dto.tenantId },
      });
      if (!tenant) {
        throw new BadRequestException(
          'tenantId does not reference an existing Tenant',
        );
      }
    }
    if (dto.cityId) {
      const city = await this.prisma.city.findUnique({
        where: { id: dto.cityId },
      });
      if (!city) {
        throw new BadRequestException(
          'cityId does not reference an existing City',
        );
      }
    }
    if (dto.zoneId) {
      const zone = await this.prisma.parkingZone.findUnique({
        where: { id: dto.zoneId },
      });
      if (!zone) {
        throw new BadRequestException(
          'zoneId does not reference an existing ParkingZone',
        );
      }
    }

    return this.prisma.camera.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.code !== undefined ? { code: dto.code } : {}),
        ...(dto.location !== undefined ? { location: dto.location } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.providerId !== undefined ? { providerId: dto.providerId } : {}),
        ...(dto.gatewayId !== undefined
          ? { gatewayId: dto.gatewayId || null }
          : {}),
        ...(dto.groupId !== undefined ? { groupId: dto.groupId || null } : {}),
        ...(dto.tenantId !== undefined
          ? { tenantId: dto.tenantId || null }
          : {}),
        ...(dto.cityId !== undefined ? { cityId: dto.cityId || null } : {}),
        ...(dto.zoneId !== undefined ? { zoneId: dto.zoneId || null } : {}),
      },
      include: { provider: true, gateway: true, group: true, zone: true },
    });
  }

  async approveCamera(id: string, user: JwtPayload) {
    const camera = await this.prisma.camera.findUnique({ where: { id } });
    if (!camera) {
      throw new NotFoundException('Camera not found');
    }
    this.assertCameraAccess(user, camera);

    return this.prisma.camera.update({
      where: { id },
      data: { registrationStatus: 'active' },
      include: { provider: true, gateway: true, group: true, zone: true },
    });
  }

  // ---------------------------------------------------------------------
  // Stall mappings — links a camera's externally-reported stall code
  // (externalStallCode) to a real ParkingSpace. Candidate spaces are
  // restricted to the camera's own tenant/city/zone. The DISCOVERED row
  // itself is created by CameraIngestionCoreService when an unknown code
  // arrives (see core/services/camera-ingestion-core.service.ts) — this
  // service only lets an operator promote/manage it afterward.
  // ---------------------------------------------------------------------

  findMappings(user: JwtPayload) {
    return this.prisma.cameraStallMapping.findMany({
      where: this.tenantFilter(user),
      include: { camera: true, parkingSpace: true, zone: true },
      orderBy: { lastReportedAt: 'desc' },
    });
  }

  async findMappingsByCamera(cameraId: string, user: JwtPayload) {
    const camera = await this.prisma.camera.findUnique({
      where: { id: cameraId },
    });
    if (!camera) {
      throw new NotFoundException('Camera not found');
    }
    this.assertCameraAccess(user, camera);

    return this.prisma.cameraStallMapping.findMany({
      where: { cameraId },
      include: { parkingSpace: true },
      orderBy: { lastReportedAt: 'desc' },
    });
  }

  async findParkingSpaceCandidates(cameraId: string, user: JwtPayload) {
    const camera = await this.prisma.camera.findUnique({
      where: { id: cameraId },
    });
    if (!camera) {
      throw new NotFoundException('Camera not found');
    }
    this.assertCameraAccess(user, camera);

    if (!camera.tenantId || !camera.cityId || !camera.zoneId) {
      return [];
    }

    return this.prisma.parkingSpace.findMany({
      where: {
        tenantId: camera.tenantId,
        cityId: camera.cityId,
        zoneId: camera.zoneId,
      },
      orderBy: { code: 'asc' },
    });
  }

  async createMapping(dto: CreateCameraStallMappingDto, user: JwtPayload) {
    const camera = await this.prisma.camera.findUnique({
      where: { id: dto.cameraId },
    });
    if (!camera) {
      throw new BadRequestException(
        'cameraId does not reference an existing Camera',
      );
    }
    this.assertCameraAccess(user, camera);

    if (!camera.tenantId || !camera.cityId || !camera.zoneId) {
      throw new BadRequestException(
        'Camera must have tenant/city/zone assigned before mapping stalls',
      );
    }

    let parkingSpaceId: string | null = null;
    if (dto.parkingSpaceId) {
      const space = await this.prisma.parkingSpace.findUnique({
        where: { id: dto.parkingSpaceId },
      });
      if (!space) {
        throw new BadRequestException(
          'parkingSpaceId does not reference an existing ParkingSpace',
        );
      }
      if (
        space.tenantId !== camera.tenantId ||
        space.cityId !== camera.cityId ||
        space.zoneId !== camera.zoneId
      ) {
        throw new BadRequestException(
          'parkingSpaceId must belong to the same tenant/city/zone as the camera',
        );
      }
      parkingSpaceId = space.id;
    }

    try {
      return await this.prisma.cameraStallMapping.create({
        data: {
          tenantId: camera.tenantId,
          cityId: camera.cityId,
          zoneId: camera.zoneId,
          cameraId: camera.id,
          externalStallCode: dto.externalStallCode,
          parkingSpaceId,
          mappingStatus: parkingSpaceId ? 'MAPPED' : 'DISCOVERED',
        },
        include: { parkingSpace: true },
      });
    } catch (error) {
      if (this.isUniqueConstraintViolation(error)) {
        throw new ConflictException(
          'A mapping for this externalStallCode already exists for this camera',
        );
      }
      throw error;
    }
  }

  async updateMapping(
    id: string,
    dto: UpdateCameraStallMappingDto,
    user: JwtPayload,
  ) {
    const mapping = await this.prisma.cameraStallMapping.findUnique({
      where: { id },
    });
    if (!mapping) {
      throw new NotFoundException('Camera stall mapping not found');
    }
    this.assertTenantAccess(
      user,
      mapping.tenantId,
      'Camera stall mapping not found',
    );

    let parkingSpaceId = mapping.parkingSpaceId;
    if (dto.parkingSpaceId !== undefined) {
      if (dto.parkingSpaceId) {
        const space = await this.prisma.parkingSpace.findUnique({
          where: { id: dto.parkingSpaceId },
        });
        if (!space) {
          throw new BadRequestException(
            'parkingSpaceId does not reference an existing ParkingSpace',
          );
        }
        if (
          space.tenantId !== mapping.tenantId ||
          space.cityId !== mapping.cityId ||
          space.zoneId !== mapping.zoneId
        ) {
          throw new BadRequestException(
            'parkingSpaceId must belong to the same tenant/city/zone as the mapping',
          );
        }
        parkingSpaceId = space.id;
      } else {
        parkingSpaceId = null;
      }
    }

    const nextStatus = dto.mappingStatus ?? mapping.mappingStatus;
    if (nextStatus === 'ACTIVE' && !parkingSpaceId) {
      throw new BadRequestException(
        'A mapping cannot be set to ACTIVE without a parkingSpaceId',
      );
    }

    try {
      return await this.prisma.cameraStallMapping.update({
        where: { id },
        data: {
          ...(dto.parkingSpaceId !== undefined ? { parkingSpaceId } : {}),
          ...(dto.mappingStatus !== undefined
            ? { mappingStatus: dto.mappingStatus }
            : {}),
          ...(dto.active !== undefined ? { active: dto.active } : {}),
        },
        include: { parkingSpace: true },
      });
    } catch (error) {
      if (this.isUniqueConstraintViolation(error)) {
        throw new ConflictException(
          'This ParkingSpace already has another ACTIVE mapping',
        );
      }
      throw error;
    }
  }

  // ---------------------------------------------------------------------
  // Dashboard — aggregated counts. Provider/Gateway are platform-level
  // (no tenantId in the schema); everything else is tenant-scoped.
  // ---------------------------------------------------------------------

  async getDashboard(user: JwtPayload) {
    const tenantWhere = this.tenantFilter(user);
    const onlineSince = new Date(
      Date.now() - ONLINE_THRESHOLD_MINUTES * 60 * 1000,
    );

    const [
      camerasTotal,
      camerasOnline,
      gatewaysCount,
      providersCount,
      spacesCount,
      eventsLast24h,
      lastSeenCamera,
      alertsOpen,
    ] = await Promise.all([
      this.prisma.camera.count({ where: tenantWhere }),
      this.prisma.camera.count({
        where: { ...tenantWhere, lastSeenAt: { gte: onlineSince } },
      }),
      this.prisma.cameraGateway.count({ where: { active: true } }),
      this.prisma.cameraProvider.count({ where: { active: true } }),
      this.prisma.parkingSpace.count({ where: tenantWhere }),
      this.prisma.cameraEvent.count({
        where: {
          ...tenantWhere,
          occurredAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      }),
      this.prisma.camera.findFirst({
        where: { ...tenantWhere, lastSeenAt: { not: null } },
        orderBy: { lastSeenAt: 'desc' },
        select: { lastSeenAt: true },
      }),
      this.prisma.alert.count({ where: { ...tenantWhere, status: 'OPEN' } }),
    ]);

    return {
      camerasOnline,
      camerasOffline: camerasTotal - camerasOnline,
      gatewaysCount,
      providersCount,
      spacesCount,
      eventsLast24h,
      lastKeepAliveAt: lastSeenCamera?.lastSeenAt ?? null,
      alertsOpen,
    };
  }

  // ---------------------------------------------------------------------
  // Monitor — real-time view over CameraEventRaw, the true event log
  // (includes FAILED/INVALID rows the Core never turns into a
  // CameraEvent). Never returns contextHeaders, even redacted.
  // ---------------------------------------------------------------------

  /**
   * DAHUA_ITSAPI is the only provider today — this maps its wire event
   * names to the canonical type for display purposes only. Monitor is
   * BackOffice observability, not Core; Core itself never hardcodes a
   * provider's vocabulary (see CameraIngestionCoreService). Move this to
   * CameraProvider metadata once a second provider actually exists.
   */
  private canonicalEventType(externalEventType: string): string {
    switch (externalEventType) {
      case 'DeviceInfo':
        return 'DEVICE_HANDSHAKE';
      case 'KeepAlive':
        return 'HEARTBEAT';
      case 'ParkingInfo':
        return 'OCCUPANCY_UPDATE';
      case 'TimedParkingSpaceInfo':
        return 'OCCUPANCY_SNAPSHOT';
      default:
        return 'UNCLASSIFIED';
    }
  }

  /**
   * Dahua's real wire shape nests the stall/status fields under
   * Picture.ParkingInfo (see
   * smartpark-dahua-reference/docs/payloads-reales.md and
   * test/dahua/payloads/ParkingInfo_*.json) — never at the payload root.
   * Monitor display only; CameraIngestionCoreService/DahuaProviderAdapter
   * already read this correctly for actual ingestion.
   */
  private extractParkingInfoBlock(
    payload: unknown,
  ): Record<string, unknown> | null {
    if (!payload || typeof payload !== 'object') {
      return null;
    }
    const picture = (payload as Record<string, unknown>).Picture;
    if (!picture || typeof picture !== 'object') {
      return null;
    }
    const parkingInfo = (picture as Record<string, unknown>).ParkingInfo;
    return parkingInfo && typeof parkingInfo === 'object'
      ? (parkingInfo as Record<string, unknown>)
      : null;
  }

  /**
   * TimedParkingSpaceInfo's SpaceModeInfo[] lives at the payload root
   * (never nested under Picture, unlike ParkingInfo) — see
   * dto/timed-parking-space-info.dto.ts. Monitor display only.
   */
  private extractSpaceModeInfo(payload: unknown): Array<{
    ParkNo?: unknown;
    Used?: unknown;
    SpaceType?: unknown;
  }> | null {
    if (!payload || typeof payload !== 'object') {
      return null;
    }
    const value = (payload as Record<string, unknown>).SpaceModeInfo;
    return Array.isArray(value)
      ? (value as Array<{
          ParkNo?: unknown;
          Used?: unknown;
          SpaceType?: unknown;
        }>)
      : null;
  }

  private extractExternalStallCode(payload: unknown): string | null {
    const block = this.extractParkingInfoBlock(payload);
    const value = block?.ParkingStallsNo;
    return typeof value === 'string' && value.length > 0 ? value : null;
  }

  private extractExternalParkingStatus(payload: unknown): number | null {
    const block = this.extractParkingInfoBlock(payload);
    const value = block?.ParkingStatus;
    return typeof value === 'number' ? value : null;
  }

  /**
   * Reuses the Dahua adapter's own code→status resolution
   * (resolveOccupancyStatus + translateOccupancyStatus) instead of
   * redefining the 0-4 mapping table here — single source of truth stays
   * in providers/dahua/normalizer.ts. Same "Monitor hardcodes Dahua
   * vocabulary for display" trade-off already documented on
   * canonicalEventType() above.
   */
  private normalizeParkingStatus(
    externalParkingStatus: number | null,
  ): string | null {
    if (externalParkingStatus === null) {
      return null;
    }
    return translateOccupancyStatus(
      resolveOccupancyStatus(externalParkingStatus),
    );
  }

  /**
   * Picture.NormalPic/VehiclePic/CutoutPic/CombinPic (see
   * dto/parking-info.dto.ts) carry a Base64 Content field — never sent to
   * the BackOffice. Keeps PicName/Width/Height, replaces Content with its
   * length only.
   */
  private redactMonitorPayload(payload: unknown): unknown {
    if (!payload || typeof payload !== 'object') {
      return payload;
    }
    let result = payload as Record<string, unknown>;

    const picture = result.Picture;
    if (picture && typeof picture === 'object') {
      const redactedPicture: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(
        picture as Record<string, unknown>,
      )) {
        if (
          value &&
          typeof value === 'object' &&
          'Content' in (value as Record<string, unknown>)
        ) {
          const block = value as Record<string, unknown>;
          redactedPicture[key] = {
            ...block,
            Content: undefined,
            contentBase64Length:
              typeof block.Content === 'string' ? block.Content.length : 0,
          };
        } else {
          redactedPicture[key] = value;
        }
      }
      result = { ...result, Picture: redactedPicture };
    }

    // TimedParkingSpaceInfo's ParkingSpacePic.Content lives at the payload
    // root (never nested under Picture) — see
    // dto/timed-parking-space-info.dto.ts. Replaced inline (not stripped)
    // so the redacted payload stays a self-describing, copiable JSON blob.
    const parkingSpacePic = result.ParkingSpacePic;
    if (
      parkingSpacePic &&
      typeof parkingSpacePic === 'object' &&
      'Content' in (parkingSpacePic as Record<string, unknown>)
    ) {
      const block = parkingSpacePic as Record<string, unknown>;
      const length =
        typeof block.Content === 'string' ? block.Content.length : 0;
      result = {
        ...result,
        ParkingSpacePic: {
          ...block,
          Content: `[BASE64 OMITIDO - ${length} caracteres]`,
        },
      };
    }

    return result;
  }

  async findMonitorEvents(user: JwtPayload, filters: MonitorFilters) {
    const and: Prisma.CameraEventRawWhereInput[] = [];
    const tenantWhere = this.tenantFilter(user);
    if (tenantWhere) and.push(tenantWhere);
    if (filters.cameraId) and.push({ cameraId: filters.cameraId });
    if (filters.providerId) {
      and.push({ camera: { providerId: filters.providerId } });
    }
    if (filters.eventType) and.push({ eventType: filters.eventType });
    if (filters.validationStatus) {
      and.push({ validationStatus: filters.validationStatus });
    }
    if (filters.processingStatus) {
      and.push({ processingStatus: filters.processingStatus });
    }
    if (filters.from) and.push({ receivedAt: { gte: new Date(filters.from) } });
    if (filters.to) and.push({ receivedAt: { lte: new Date(filters.to) } });

    const rows = await this.prisma.cameraEventRaw.findMany({
      where: and.length > 0 ? { AND: and } : undefined,
      include: {
        camera: { include: { provider: true } },
        events: { include: { parkingSpace: true } },
      },
      orderBy: { receivedAt: 'desc' },
      take:
        filters.limit && filters.limit > 0 ? Math.min(filters.limit, 200) : 50,
    });

    // Single batch lookup instead of one query per row: a raw event only
    // actually changed a ParkingSpace if its CameraEvent id is referenced
    // by a ParkingSpaceStatusHistory row (see processOccupancyUpdate /
    // processOccupancySnapshot — history is only written when the reported
    // status differs from the currently known ParkingSpace.status).
    // flatMap (not row.events[0]) because a TimedParkingSpaceInfo raw row
    // can carry 0..N CameraEvent rows — one per changed+mapped stall — not
    // just one.
    const occupancyEventIds = rows.flatMap((row) =>
      row.events.map((e) => e.id),
    );
    const changedEventIds = occupancyEventIds.length
      ? new Set(
          (
            await this.prisma.parkingSpaceStatusHistory.findMany({
              where: { sourceEventId: { in: occupancyEventIds } },
              select: { sourceEventId: true },
            })
          ).map((h) => h.sourceEventId),
        )
      : new Set<string | null>();

    // Batched CameraStallMapping lookup for every camera that reported a
    // TimedParkingSpaceInfo row in this page — used only to compute the
    // mapped/unmapped counts in each row's occupancySnapshot summary.
    const snapshotCameraIds = [
      ...new Set(
        rows
          .filter((row) => row.eventType === 'TimedParkingSpaceInfo')
          .map((row) => row.cameraId)
          .filter((id): id is string => !!id),
      ),
    ];
    const snapshotMappings = snapshotCameraIds.length
      ? await this.prisma.cameraStallMapping.findMany({
          where: { cameraId: { in: snapshotCameraIds } },
        })
      : [];
    const mappingByCameraCode = new Map(
      snapshotMappings.map((m) => [`${m.cameraId}|${m.externalStallCode}`, m]),
    );

    return rows.map((row) => {
      if (row.eventType === 'TimedParkingSpaceInfo') {
        return this.buildOccupancySnapshotRow(
          row,
          mappingByCameraCode,
          changedEventIds,
        );
      }

      const externalParkingStatus = this.extractExternalParkingStatus(
        row.payload,
      );
      const cameraEvent = row.events[0] ?? null;
      return {
        id: row.id,
        receivedAt: row.receivedAt,
        providerCode: row.camera?.provider?.code ?? null,
        cameraId: row.cameraId,
        cameraName: row.camera?.name ?? null,
        deviceIdRaw: row.deviceIdRaw,
        externalEventType: row.eventType,
        canonicalEventType: this.canonicalEventType(row.eventType),
        externalStallCode: this.extractExternalStallCode(row.payload),
        externalParkingStatus,
        normalizedParkingStatus: this.normalizeParkingStatus(
          externalParkingStatus,
        ),
        parkingSpace: cameraEvent?.parkingSpace
          ? {
              id: cameraEvent.parkingSpace.id,
              code: cameraEvent.parkingSpace.code,
            }
          : null,
        parkingSpaceCode: cameraEvent?.parkingSpace?.code ?? null,
        parkingSpaceCurrentStatus: cameraEvent?.parkingSpace?.status ?? null,
        statusChanged: cameraEvent
          ? changedEventIds.has(cameraEvent.id)
          : false,
        duplicate: row.processingStatus === 'DUPLICATE',
        validationStatus: row.validationStatus,
        processingStatus: row.processingStatus,
        error: row.error,
        contextIp: row.contextIp,
        idempotencyKey: cameraEvent?.idempotencyKey ?? null,
        occupancySnapshot: null,
      };
    });
  }

  /**
   * TimedParkingSpaceInfo carries N stalls per request — never one. This
   * builds the Monitor list row's aggregate summary (counts only; the
   * per-stall breakdown is only computed in findMonitorEvent's detail view,
   * see buildOccupancySnapshotDetail) instead of misreading the row as if
   * it were a single-stall ParkingInfo event.
   */
  private buildOccupancySnapshotRow(
    row: {
      id: string;
      receivedAt: Date;
      cameraId: string | null;
      camera: { name: string | null; provider: { code: string } | null } | null;
      deviceIdRaw: string;
      eventType: string;
      payload: unknown;
      validationStatus: string;
      processingStatus: string;
      error: string | null;
      contextIp: string;
      events: Array<{ id: string }>;
    },
    mappingByCameraCode: Map<
      string,
      { mappingStatus: string; parkingSpaceId: string | null }
    >,
    changedEventIds: Set<string | null>,
  ) {
    const spaceModeInfo = this.extractSpaceModeInfo(row.payload) ?? [];
    let mappedCount = 0;
    let occupiedReceived = 0;
    let freeReceived = 0;
    for (const item of spaceModeInfo) {
      const parkNo = typeof item?.ParkNo === 'string' ? item.ParkNo : null;
      const used = typeof item?.Used === 'boolean' ? item.Used : null;
      if (used === true) occupiedReceived++;
      else if (used === false) freeReceived++;
      const mapping =
        row.cameraId && parkNo
          ? mappingByCameraCode.get(`${row.cameraId}|${parkNo}`)
          : undefined;
      if (mapping?.mappingStatus === 'ACTIVE' && mapping.parkingSpaceId) {
        mappedCount++;
      }
    }
    const changedCount = row.events.filter((e) =>
      changedEventIds.has(e.id),
    ).length;

    return {
      id: row.id,
      receivedAt: row.receivedAt,
      providerCode: row.camera?.provider?.code ?? null,
      cameraId: row.cameraId,
      cameraName: row.camera?.name ?? null,
      deviceIdRaw: row.deviceIdRaw,
      externalEventType: row.eventType,
      canonicalEventType: this.canonicalEventType(row.eventType),
      externalStallCode: null,
      externalParkingStatus: null,
      normalizedParkingStatus: null,
      parkingSpace: null,
      parkingSpaceCode: null,
      parkingSpaceCurrentStatus: null,
      statusChanged: changedCount > 0,
      duplicate: false,
      validationStatus: row.validationStatus,
      processingStatus: row.processingStatus,
      error: row.error,
      contextIp: row.contextIp,
      idempotencyKey: null,
      occupancySnapshot: {
        totalSpaces: spaceModeInfo.length,
        mappedCount,
        unmappedCount: spaceModeInfo.length - mappedCount,
        occupiedReceived,
        freeReceived,
        changedCount,
      },
    };
  }

  async findMonitorEvent(id: string, user: JwtPayload) {
    const row = await this.prisma.cameraEventRaw.findUnique({
      where: { id },
      include: {
        camera: { include: { provider: true } },
        events: { include: { parkingSpace: true } },
      },
    });
    if (!row) {
      throw new NotFoundException('Event not found');
    }
    if (row.tenantId) {
      this.assertTenantAccess(user, row.tenantId, 'Event not found');
    } else if (!this.isSuperAdmin(user)) {
      throw new NotFoundException('Event not found');
    }

    if (row.eventType === 'TimedParkingSpaceInfo') {
      return this.buildOccupancySnapshotDetail(row);
    }

    const externalStallCode = this.extractExternalStallCode(row.payload);
    const externalParkingStatus = this.extractExternalParkingStatus(
      row.payload,
    );
    const cameraEvent = row.events[0] ?? null;

    const [mappingUsed, statusHistory] = await Promise.all([
      row.cameraId && externalStallCode
        ? this.prisma.cameraStallMapping.findFirst({
            where: { cameraId: row.cameraId, externalStallCode },
            include: { parkingSpace: true },
          })
        : Promise.resolve(null),
      cameraEvent
        ? this.prisma.parkingSpaceStatusHistory.findFirst({
            where: { sourceEventId: cameraEvent.id },
          })
        : Promise.resolve(null),
    ]);

    return {
      id: row.id,
      receivedAt: row.receivedAt,
      cameraId: row.cameraId,
      deviceIdRaw: row.deviceIdRaw,
      externalEventType: row.eventType,
      canonicalEventType: this.canonicalEventType(row.eventType),
      externalStallCode,
      externalParkingStatus,
      normalizedParkingStatus: this.normalizeParkingStatus(
        externalParkingStatus,
      ),
      parkingSpaceCode: cameraEvent?.parkingSpace?.code ?? null,
      parkingSpaceCurrentStatus: cameraEvent?.parkingSpace?.status ?? null,
      statusChanged: !!statusHistory,
      duplicate: row.processingStatus === 'DUPLICATE',
      validationStatus: row.validationStatus,
      processingStatus: row.processingStatus,
      error: row.error,
      contextIp: row.contextIp,
      payload: this.redactMonitorPayload(row.payload),
      normalizedEvent: cameraEvent,
      mappingUsed: mappingUsed
        ? {
            id: mappingUsed.id,
            externalStallCode: mappingUsed.externalStallCode,
            mappingStatus: mappingUsed.mappingStatus,
            parkingSpaceCode: mappingUsed.parkingSpace?.code ?? null,
          }
        : null,
      statusHistory: statusHistory
        ? {
            previousStatus: statusHistory.previousStatus,
            newStatus: statusHistory.newStatus,
            changedAt: statusHistory.changedAt,
          }
        : null,
      occupancySnapshot: null,
    };
  }

  /**
   * Per-stall breakdown for a TimedParkingSpaceInfo raw event — never picks
   * "the" ParkingSpace/mapping/status like the ParkingInfo branch does,
   * since a snapshot always carries N stalls. Each CameraEvent created by
   * processOccupancySnapshot carries its own stall code in
   * metadata.externalStallCode (see camera-ingestion-core.service.ts), used
   * here to line a SpaceModeInfo entry back up with the CameraEvent (if
   * any) and ParkingSpaceStatusHistory (if any) it produced.
   */
  private async buildOccupancySnapshotDetail(row: {
    id: string;
    receivedAt: Date;
    tenantId: string | null;
    cameraId: string | null;
    deviceIdRaw: string;
    eventType: string;
    payload: unknown;
    validationStatus: string;
    processingStatus: string;
    error: string | null;
    contextIp: string;
    events: Array<{
      id: string;
      metadata: Prisma.JsonValue;
      parkingSpace: { code: string; status: string } | null;
    }>;
  }) {
    const spaceModeInfo = this.extractSpaceModeInfo(row.payload) ?? [];
    const codes = spaceModeInfo
      .map((item) => (typeof item?.ParkNo === 'string' ? item.ParkNo : null))
      .filter((code): code is string => !!code);

    const mappings: Prisma.CameraStallMappingGetPayload<{
      include: { parkingSpace: true };
    }>[] =
      row.cameraId && codes.length
        ? await this.prisma.cameraStallMapping.findMany({
            where: {
              cameraId: row.cameraId,
              externalStallCode: { in: codes },
            },
            include: { parkingSpace: true },
          })
        : [];
    const statusHistories: Prisma.ParkingSpaceStatusHistoryGetPayload<object>[] =
      row.events.length
        ? await this.prisma.parkingSpaceStatusHistory.findMany({
            where: { sourceEventId: { in: row.events.map((e) => e.id) } },
          })
        : [];

    const mappingByCode = new Map(
      mappings.map((m) => [m.externalStallCode, m]),
    );
    const historyByEventId = new Map(
      statusHistories
        .filter((h) => h.sourceEventId)
        .map((h) => [h.sourceEventId as string, h]),
    );
    const eventByCode = new Map<string, (typeof row.events)[number]>();
    for (const event of row.events) {
      const meta = event.metadata as Record<string, unknown> | null;
      const code = meta?.externalStallCode;
      if (typeof code === 'string') {
        eventByCode.set(code, event);
      }
    }

    const spaces = spaceModeInfo.map((item) => {
      const parkNo = typeof item?.ParkNo === 'string' ? item.ParkNo : null;
      const used = typeof item?.Used === 'boolean' ? item.Used : null;
      const mapping = parkNo ? mappingByCode.get(parkNo) : undefined;
      const event = parkNo ? eventByCode.get(parkNo) : undefined;
      const history = event ? historyByEventId.get(event.id) : undefined;

      return {
        externalStallCode: parkNo,
        spaceType: typeof item?.SpaceType === 'number' ? item.SpaceType : null,
        receivedUsed: used,
        normalizedStatus:
          used === null ? null : used ? 'OCCUPIED' : 'AVAILABLE',
        parkingSpaceCode: mapping?.parkingSpace?.code ?? null,
        mappingStatus: mapping?.mappingStatus ?? null,
        previousStatus: history?.previousStatus ?? null,
        finalStatus:
          history?.newStatus ?? mapping?.parkingSpace?.status ?? null,
        changed: !!history,
      };
    });

    const mappedCount = spaces.filter((s) => s.parkingSpaceCode).length;
    const changedCount = spaces.filter((s) => s.changed).length;

    return {
      id: row.id,
      receivedAt: row.receivedAt,
      cameraId: row.cameraId,
      deviceIdRaw: row.deviceIdRaw,
      externalEventType: row.eventType,
      canonicalEventType: this.canonicalEventType(row.eventType),
      externalStallCode: null,
      externalParkingStatus: null,
      normalizedParkingStatus: null,
      parkingSpaceCode: null,
      parkingSpaceCurrentStatus: null,
      statusChanged: changedCount > 0,
      duplicate: false,
      validationStatus: row.validationStatus,
      processingStatus: row.processingStatus,
      error: row.error,
      contextIp: row.contextIp,
      payload: this.redactMonitorPayload(row.payload),
      normalizedEvent: row.events,
      mappingUsed: null,
      statusHistory: null,
      occupancySnapshot: {
        totalSpaces: spaces.length,
        mappedCount,
        unmappedCount: spaces.length - mappedCount,
        occupiedReceived: spaces.filter((s) => s.receivedUsed === true).length,
        freeReceived: spaces.filter((s) => s.receivedUsed === false).length,
        changedCount,
        spaces,
      },
    };
  }

  // ---------------------------------------------------------------------
  // Diagnostics — deterministic per-camera health checks. No AI/ML, just
  // threshold/rule evaluation over already-stored data.
  // ---------------------------------------------------------------------

  private externalEventTypeFor(
    provider: { endpointTemplates: unknown },
    canonicalType: string,
  ): string {
    const templates = provider.endpointTemplates as Record<
      string,
      string
    > | null;
    const path = templates?.[canonicalType];
    // Sentinel that can never match a real eventType — keeps the Prisma
    // filter active instead of silently degrading to "no filter" (which
    // is what an `undefined` value in a where-clause does).
    return path ? path.replace(/^\/+/, '') : '__unmapped_event_type__';
  }

  async getCameraDiagnostics(cameraId: string, user: JwtPayload) {
    const camera = await this.prisma.camera.findUnique({
      where: { id: cameraId },
      include: { provider: true, gateway: true },
    });
    if (!camera) {
      throw new NotFoundException('Camera not found');
    }
    this.assertCameraAccess(user, camera);

    const now = Date.now();
    const onlineSince = new Date(now - ONLINE_THRESHOLD_MINUTES * 60 * 1000);
    const since1h = new Date(now - 60 * 60 * 1000);
    const since24h = new Date(now - 24 * 60 * 60 * 1000);

    const deviceInfoType = this.externalEventTypeFor(
      camera.provider,
      'DEVICE_HANDSHAKE',
    );
    const occupancyType = this.externalEventTypeFor(
      camera.provider,
      'OCCUPANCY_UPDATE',
    );

    const [
      events1h,
      events24h,
      failed24h,
      invalid24h,
      lastDeviceInfo,
      lastParkingInfo,
      deviceInfoCount,
      occupancyProcessed24h,
      occupancyEventsCreated24h,
      unmappedCount,
      conflictCount,
      activeGatewaysForProvider,
    ] = await Promise.all([
      this.prisma.cameraEventRaw.count({
        where: { cameraId, receivedAt: { gte: since1h } },
      }),
      this.prisma.cameraEventRaw.count({
        where: { cameraId, receivedAt: { gte: since24h } },
      }),
      this.prisma.cameraEventRaw.count({
        where: {
          cameraId,
          receivedAt: { gte: since24h },
          processingStatus: 'FAILED',
        },
      }),
      this.prisma.cameraEventRaw.count({
        where: {
          cameraId,
          receivedAt: { gte: since24h },
          validationStatus: 'INVALID',
        },
      }),
      this.prisma.cameraEventRaw.findFirst({
        where: { cameraId, eventType: deviceInfoType },
        orderBy: { receivedAt: 'desc' },
      }),
      this.prisma.cameraEventRaw.findFirst({
        where: { cameraId, eventType: occupancyType },
        orderBy: { receivedAt: 'desc' },
      }),
      this.prisma.cameraEventRaw.count({
        where: { cameraId, eventType: deviceInfoType },
      }),
      this.prisma.cameraEventRaw.count({
        where: {
          cameraId,
          eventType: occupancyType,
          receivedAt: { gte: since24h },
          processingStatus: 'PROCESSED',
        },
      }),
      this.prisma.cameraEvent.count({
        where: { cameraId, occurredAt: { gte: since24h } },
      }),
      this.prisma.cameraStallMapping.count({
        where: { cameraId, mappingStatus: 'DISCOVERED' },
      }),
      this.prisma.cameraStallMapping.count({
        where: { cameraId, mappingStatus: 'CONFLICT' },
      }),
      this.prisma.cameraGateway.count({
        where: { providerId: camera.providerId, active: true },
      }),
    ]);

    const online = !!camera.lastSeenAt && camera.lastSeenAt >= onlineSince;
    const minutesSinceLastSeen = camera.lastSeenAt
      ? Math.round((now - camera.lastSeenAt.getTime()) / 60000)
      : null;
    // An OCCUPANCY_UPDATE raw row that ended PROCESSED but produced no
    // CameraEvent can only mean its idempotencyKey collided (P2002) — see
    // processOccupancyUpdate's isUniqueConstraintViolation branch, which
    // stores that outcome as PROCESSED without ever creating the event.
    const duplicates24h = Math.max(
      0,
      occupancyProcessed24h - occupancyEventsCreated24h,
    );
    const failedRate24h = events24h > 0 ? failed24h / events24h : 0;

    const rules = [
      {
        code: 'OFFLINE',
        severity: online ? 'ok' : 'critical',
        message: online ? 'Cámara online' : 'Sin KeepAlive dentro del umbral',
      },
      {
        code: 'NO_DEVICE_INFO',
        severity: deviceInfoCount > 0 ? 'ok' : 'warning',
        message:
          deviceInfoCount > 0
            ? 'DeviceInfo recibido'
            : 'Nunca se recibió un DeviceInfo',
      },
      {
        code: 'UNMAPPED_STALLS',
        severity: unmappedCount === 0 ? 'ok' : 'warning',
        message:
          unmappedCount === 0
            ? 'Sin códigos de plaza sin mapear'
            : `${unmappedCount} código(s) de plaza sin mapear (DISCOVERED)`,
      },
      {
        code: 'MAPPING_CONFLICT',
        severity: conflictCount === 0 ? 'ok' : 'critical',
        message:
          conflictCount === 0
            ? 'Sin mappings en conflicto'
            : `${conflictCount} mapping(s) en CONFLICT`,
      },
      {
        code: 'HIGH_FAILED_RATE',
        severity: events24h >= 5 && failedRate24h > 0.2 ? 'critical' : 'ok',
        message:
          events24h >= 5 && failedRate24h > 0.2
            ? `Tasa de FAILED alta: ${(failedRate24h * 100).toFixed(0)}% (24h)`
            : 'Tasa de FAILED normal',
      },
      {
        code: 'GATEWAY_INACTIVE',
        severity: camera.gateway && !camera.gateway.active ? 'critical' : 'ok',
        message:
          camera.gateway && !camera.gateway.active
            ? 'Gateway asignado está inactivo'
            : 'Gateway activo (o sin asignar)',
      },
      {
        code: 'PROVIDER_INACTIVE',
        severity: !camera.provider.active ? 'critical' : 'ok',
        message: !camera.provider.active
          ? 'Provider inactivo'
          : 'Provider activo',
      },
      {
        code: 'PENDING_APPROVAL',
        severity:
          camera.registrationStatus === 'pending_review' ? 'warning' : 'ok',
        message:
          camera.registrationStatus === 'pending_review'
            ? 'Cámara pendiente de aprobación'
            : 'Cámara aprobada',
      },
      {
        code: 'MULTIPLE_ACTIVE_GATEWAYS',
        severity: activeGatewaysForProvider > 1 ? 'warning' : 'ok',
        message:
          activeGatewaysForProvider > 1
            ? `${activeGatewaysForProvider} gateways activos para este provider (ambiguo)`
            : 'Gateway del provider sin ambigüedad',
      },
      {
        code: 'NO_ACTIVE_GATEWAY',
        severity: activeGatewaysForProvider === 0 ? 'critical' : 'ok',
        message:
          activeGatewaysForProvider === 0
            ? 'Ningún gateway activo para este provider'
            : 'Al menos un gateway activo',
      },
    ];

    return {
      camera: {
        id: camera.id,
        name: camera.name,
        code: camera.code,
        deviceId: camera.deviceId,
        ipAddress: camera.ipAddress,
        registrationStatus: camera.registrationStatus,
        status: camera.status,
        provider: {
          code: camera.provider.code,
          active: camera.provider.active,
        },
        gateway: camera.gateway
          ? { code: camera.gateway.code, active: camera.gateway.active }
          : null,
      },
      online,
      lastSeenAt: camera.lastSeenAt,
      minutesSinceLastSeen,
      lastDeviceInfoAt: lastDeviceInfo?.receivedAt ?? null,
      lastParkingInfoAt: lastParkingInfo?.receivedAt ?? null,
      events1h,
      events24h,
      failed24h,
      invalid24h,
      duplicates24h,
      unmappedStallCodes: unmappedCount,
      conflictingMappings: conflictCount,
      rules,
    };
  }
}
