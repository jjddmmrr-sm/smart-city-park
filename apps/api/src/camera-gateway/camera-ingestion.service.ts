import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CameraGatewayConfigService } from './config/camera-gateway.config';
import { CameraGatewayLogger } from './logging/camera-gateway-logger.service';
import { DeviceInfoDto } from './dahua/dto/device-info.dto';
import { KeepAliveDto } from './dahua/dto/keep-alive.dto';
import { ParkingInfoDto } from './dahua/dto/parking-info.dto';
import {
  normalizeParkingInfo,
  parseSnapTime,
  resolveDetectionScope,
} from './dahua/normalizer';

function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}

export interface IngestionAck {
  status: 'ok';
}

/**
 * RAW-first ingestion for Dahua ITSAPI events. Scope of this commit:
 * DeviceInfo only — see DAHUA_IMPLEMENTATION_PLAN.md §16, commit 3.
 * Always acknowledges with 200 once the raw payload is persisted; never
 * throws for a structurally valid-but-unresolvable device, to avoid
 * provoking undocumented firmware retry behavior (§2, step 14).
 */
@Injectable()
export class CameraIngestionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: CameraGatewayConfigService,
    private readonly logger: CameraGatewayLogger,
  ) {}

  async handleDeviceInfo(
    rawBody: Record<string, unknown>,
    ip: string,
    headers: Record<string, unknown>,
  ): Promise<IngestionAck> {
    const deviceIdRaw =
      typeof rawBody?.DeviceID === 'string' ? rawBody.DeviceID : '';

    const rawEvent = await this.prisma.cameraEventRaw.create({
      data: {
        deviceIdRaw,
        eventType: 'DeviceInfo',
        payload: rawBody as Prisma.InputJsonValue,
        contextIp: ip,
        contextHeaders: CameraGatewayLogger.redactHeaders(
          headers,
        ) as Prisma.InputJsonValue,
        validationStatus: 'PENDING',
      },
    });

    const dto = plainToInstance(DeviceInfoDto, rawBody);
    const errors = await validate(dto);

    if (errors.length > 0 || !dto.DeviceID) {
      await this.prisma.cameraEventRaw.update({
        where: { id: rawEvent.id },
        data: {
          validationStatus: 'INVALID',
          processingStatus: 'FAILED',
          error:
            errors
              .map((e) => Object.values(e.constraints ?? {}).join(', '))
              .join('; ') || 'DeviceID missing',
        },
      });
      this.logger.warn(
        `DeviceInfo inválido desde ip=${ip}: ${errors.length} error(es) de validación`,
      );
      return { status: 'ok' };
    }

    await this.prisma.cameraEventRaw.update({
      where: { id: rawEvent.id },
      data: { validationStatus: 'VALID' },
    });

    const existingCamera = await this.prisma.camera.findUnique({
      where: { deviceId: dto.DeviceID },
    });

    let camera: { id: string; tenantId: string | null };

    if (existingCamera) {
      camera = await this.prisma.camera.update({
        where: { id: existingCamera.id },
        data: {
          lastSeenAt: new Date(),
          ipAddress: dto.IPAddress ?? existingCamera.ipAddress,
          macAddress: dto.MACAddress ?? existingCamera.macAddress,
          manufacturer: dto.Manufacturer ?? existingCamera.manufacturer,
          model: dto.DeviceModel ?? existingCamera.model,
        },
      });
      this.logger.log(
        `DeviceInfo: cámara conocida actualizada deviceId=${dto.DeviceID} cameraId=${camera.id}`,
      );
    } else if (!this.config.pilotAutoRegisterEnabled) {
      await this.prisma.cameraEventRaw.update({
        where: { id: rawEvent.id },
        data: {
          processingStatus: 'FAILED',
          error:
            'Auto-registro de piloto deshabilitado; deviceId desconocido descartado',
        },
      });
      this.logger.warn(
        `DeviceInfo de dispositivo desconocido descartado (auto-registro off) deviceId=${dto.DeviceID} ip=${ip}`,
      );
      return { status: 'ok' };
    } else {
      camera = await this.prisma.camera.create({
        data: {
          deviceId: dto.DeviceID,
          ipAddress: dto.IPAddress,
          macAddress: dto.MACAddress,
          manufacturer: dto.Manufacturer,
          model: dto.DeviceModel,
          registrationStatus: 'pending_review',
          lastSeenAt: new Date(),
        },
      });
      this.logger.log(
        `Cámara nueva registrada en pending_review deviceId=${dto.DeviceID} cameraId=${camera.id}`,
      );
    }

    await this.prisma.cameraEventRaw.update({
      where: { id: rawEvent.id },
      data: {
        cameraId: camera.id,
        tenantId: camera.tenantId,
        processingStatus: 'PROCESSED',
        processedAt: new Date(),
      },
    });

    return { status: 'ok' };
  }

  /**
   * Heartbeat only: refreshes Camera.lastSeenAt/status for a known device.
   * Never registers a camera — unlike DeviceInfo, an unknown deviceId is
   * discarded silently (RAW stays FAILED) so a stray or unapproved device
   * cannot bootstrap itself into existence through KeepAlive traffic.
   */
  async handleKeepAlive(
    rawBody: Record<string, unknown>,
    ip: string,
    headers: Record<string, unknown>,
  ): Promise<IngestionAck> {
    const deviceIdRaw =
      typeof rawBody?.DeviceID === 'string' ? rawBody.DeviceID : '';

    const rawEvent = await this.prisma.cameraEventRaw.create({
      data: {
        deviceIdRaw,
        eventType: 'KeepAlive',
        payload: rawBody as Prisma.InputJsonValue,
        contextIp: ip,
        contextHeaders: CameraGatewayLogger.redactHeaders(
          headers,
        ) as Prisma.InputJsonValue,
        validationStatus: 'PENDING',
      },
    });

    const dto = plainToInstance(KeepAliveDto, rawBody);
    const errors = await validate(dto);

    if (errors.length > 0 || !dto.DeviceID) {
      await this.prisma.cameraEventRaw.update({
        where: { id: rawEvent.id },
        data: {
          validationStatus: 'INVALID',
          processingStatus: 'FAILED',
          error:
            errors
              .map((e) => Object.values(e.constraints ?? {}).join(', '))
              .join('; ') || 'DeviceID missing',
        },
      });
      this.logger.warn(
        `KeepAlive inválido desde ip=${ip}: ${errors.length} error(es) de validación`,
      );
      return { status: 'ok' };
    }

    await this.prisma.cameraEventRaw.update({
      where: { id: rawEvent.id },
      data: { validationStatus: 'VALID' },
    });

    const camera = await this.prisma.camera.findUnique({
      where: { deviceId: dto.DeviceID },
    });

    if (!camera) {
      await this.prisma.cameraEventRaw.update({
        where: { id: rawEvent.id },
        data: {
          processingStatus: 'FAILED',
          error: 'Heartbeat de dispositivo desconocido descartado',
        },
      });
      this.logger.warn(
        `Heartbeat descartado: deviceId desconocido=${dto.DeviceID} ip=${ip}`,
      );
      return { status: 'ok' };
    }

    const updated = await this.prisma.camera.update({
      where: { id: camera.id },
      data: { lastSeenAt: new Date(), status: 'active' },
    });

    await this.prisma.cameraEventRaw.update({
      where: { id: rawEvent.id },
      data: {
        cameraId: updated.id,
        tenantId: updated.tenantId,
        processingStatus: 'PROCESSED',
        processedAt: new Date(),
      },
    });

    this.logger.log(
      `Heartbeat recibido deviceId=${dto.DeviceID} cameraId=${updated.id}`,
    );

    return { status: 'ok' };
  }

  /**
   * Occupancy events. Scope of this commit: persist RAW, normalize, resolve
   * device + ParkingSpace, apply idempotency, update ParkingSpace + write
   * history. Images and alerts are explicitly out of scope — see
   * DAHUA_IMPLEMENTATION_PLAN.md §16.
   */
  async handleParkingInfo(
    rawBody: Record<string, unknown>,
    ip: string,
    headers: Record<string, unknown>,
  ): Promise<IngestionAck> {
    const picture = (rawBody?.Picture ?? {}) as Record<string, unknown>;
    const parkingInfoBlock = (picture?.ParkingInfo ?? {}) as Record<
      string,
      unknown
    >;
    const deviceIdRaw =
      typeof parkingInfoBlock?.DeviceID === 'string'
        ? parkingInfoBlock.DeviceID
        : '';

    const rawEvent = await this.prisma.cameraEventRaw.create({
      data: {
        deviceIdRaw,
        eventType: 'ParkingInfo',
        payload: rawBody as Prisma.InputJsonValue,
        contextIp: ip,
        contextHeaders: CameraGatewayLogger.redactHeaders(
          headers,
        ) as Prisma.InputJsonValue,
        validationStatus: 'PENDING',
      },
    });

    const dto = plainToInstance(ParkingInfoDto, rawBody);
    const errors = await validate(dto);
    const block = dto.Picture?.ParkingInfo;

    if (
      errors.length > 0 ||
      !block?.DeviceID ||
      block.ParkingStatus === undefined ||
      block.ParkingStatus === null
    ) {
      await this.prisma.cameraEventRaw.update({
        where: { id: rawEvent.id },
        data: {
          validationStatus: 'INVALID',
          processingStatus: 'FAILED',
          error:
            errors
              .map((e) => Object.values(e.constraints ?? {}).join(', '))
              .join('; ') || 'DeviceID or ParkingStatus missing',
        },
      });
      this.logger.warn(
        `ParkingInfo inválido desde ip=${ip}: ${errors.length} error(es) de validación`,
      );
      return { status: 'ok' };
    }

    await this.prisma.cameraEventRaw.update({
      where: { id: rawEvent.id },
      data: { validationStatus: 'VALID' },
    });

    const camera = await this.prisma.camera.findUnique({
      where: { deviceId: block.DeviceID },
    });

    if (!camera || !camera.tenantId || !camera.cityId) {
      await this.prisma.cameraEventRaw.update({
        where: { id: rawEvent.id },
        data: {
          processingStatus: 'FAILED',
          error: 'Cámara no resuelta o sin tenant/city asignado',
        },
      });
      this.logger.warn(
        `ParkingInfo descartado: cámara no resuelta/activa deviceId=${block.DeviceID} ip=${ip}`,
      );
      return { status: 'ok' };
    }

    const event = normalizeParkingInfo(
      dto,
      {
        id: camera.id,
        tenantId: camera.tenantId,
        cityId: camera.cityId,
        deviceId: camera.deviceId,
        channel: camera.channel,
      },
      rawEvent.id,
      rawBody,
    );

    const detectionScope = resolveDetectionScope(block.ParkingStallsNo);

    let parkingSpace: {
      id: string;
      status: string;
      tenantId: string;
      cityId: string;
    } | null = null;

    if (detectionScope === 'PARKING_SPACE' && camera.zoneId) {
      parkingSpace = await this.prisma.parkingSpace.findUnique({
        where: {
          zoneId_code: { zoneId: camera.zoneId, code: block.ParkingStallsNo! },
        },
      });
    }

    const newSpaceStatus =
      event.occupancyStatus === 'OCCUPIED'
        ? 'occupied'
        : event.occupancyStatus === 'FREE'
          ? 'available'
          : null;

    try {
      await this.prisma.$transaction(async (tx) => {
        const createdEvent = await tx.cameraEvent.create({
          data: {
            tenantId: event.tenantId,
            cityId: event.cityId,
            cameraId: event.cameraId,
            plateNumber: event.plate?.number ?? null,
            eventType: 'ParkingInfo',
            confidence: event.plate?.confidence ?? null,
            occurredAt: parseSnapTime(event.detectedAt),
            detectionScope:
              detectionScope === 'PARKING_SPACE' ? 'PLAZA' : 'AREA_ILEGAL',
            idempotencyKey: event.idempotencyKey,
            rawEventId: event.rawEventId,
            parkingSpaceId: parkingSpace?.id ?? null,
            metadata: {
              illegalAreaName: event.illegalAreaName ?? null,
              channel: event.channel ?? null,
              vehicleType: event.vehicle?.type ?? null,
              allowedUser: event.allowedUser ?? null,
            },
          },
        });

        if (
          parkingSpace &&
          newSpaceStatus &&
          newSpaceStatus !== parkingSpace.status
        ) {
          await tx.parkingSpace.update({
            where: { id: parkingSpace.id },
            data: { status: newSpaceStatus },
          });
          await tx.parkingSpaceStatusHistory.create({
            data: {
              tenantId: parkingSpace.tenantId,
              cityId: parkingSpace.cityId,
              spaceId: parkingSpace.id,
              previousStatus: parkingSpace.status,
              newStatus: newSpaceStatus,
              source: 'CAMERA',
              sourceEventId: createdEvent.id,
            },
          });
        }
      });
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        await this.prisma.cameraEventRaw.update({
          where: { id: rawEvent.id },
          data: {
            cameraId: camera.id,
            tenantId: camera.tenantId,
            processingStatus: 'PROCESSED',
            processedAt: new Date(),
          },
        });
        this.logger.log(
          `ParkingInfo duplicado (idempotente) ignorado idempotencyKey=${event.idempotencyKey}`,
        );
        return { status: 'ok' };
      }
      throw error;
    }

    await this.prisma.cameraEventRaw.update({
      where: { id: rawEvent.id },
      data: {
        cameraId: camera.id,
        tenantId: camera.tenantId,
        processingStatus: 'PROCESSED',
        processedAt: new Date(),
      },
    });

    if (detectionScope === 'ILLEGAL_AREA') {
      this.logger.log(
        `Área ilegal detectada (sin alerta todavía) deviceId=${block.DeviceID} area=${block.DetectRegionName ?? ''}`,
      );
    } else if (!parkingSpace) {
      this.logger.warn(
        `ParkingInfo: plaza no resuelta code=${block.ParkingStallsNo ?? ''} deviceId=${block.DeviceID} (evento registrado sin plaza)`,
      );
    } else if (newSpaceStatus && newSpaceStatus !== parkingSpace.status) {
      this.logger.log(
        `ParkingSpace actualizada spaceId=${parkingSpace.id} ${parkingSpace.status}→${newSpaceStatus} deviceId=${block.DeviceID}`,
      );
    } else {
      this.logger.log(
        `ParkingInfo procesado sin cambio de estado spaceId=${parkingSpace.id} status=${event.occupancyStatus} deviceId=${block.DeviceID}`,
      );
    }

    return { status: 'ok' };
  }
}
