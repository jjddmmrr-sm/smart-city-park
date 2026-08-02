import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { CameraGatewayConfigService } from '../../config/camera-gateway.config';
import { CameraGatewayLogger } from '../../logging/camera-gateway-logger.service';
import type { CanonicalCameraEvent } from '../contracts/canonical-camera-event';

export interface IngestionAck {
  status: 'ok';
}

export interface CaptureRawEventInput {
  deviceIdRaw: string;
  eventType: string;
  payload: unknown;
  contextIp: string;
  contextHeaders: Record<string, unknown>;
}

type RawEventOutcomeStatus = 'PROCESSED' | 'FAILED' | 'DUPLICATE';

interface FinalizeRawInput {
  status: RawEventOutcomeStatus;
  cameraId?: string;
  tenantId?: string;
  error?: string;
}

/**
 * Provider-agnostic ingestion core — see
 * docs/architecture/iot-device-management-foundation.md §5.
 *
 * Never imports a DTO, a normalizer, a controller, or anything from
 * camera-gateway/providers/**. process() is the only method that touches
 * business logic, and it consumes exclusively CanonicalCameraEvent —
 * device/tenant/city resolution happens here, server-side, from
 * event.externalDeviceId, never from a payload.
 *
 * captureRawEvent()/markRawInvalid() exist here (not in a separate
 * service) so CameraIngestionService never needs Prisma access at
 * all — see docs/architecture/iot-device-management-foundation.md §5
 * for the scope decision keeping RAW persistence inside this class for
 * now.
 */
@Injectable()
export class CameraIngestionCoreService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: CameraGatewayConfigService,
    private readonly logger: CameraGatewayLogger,
  ) {}

  async captureRawEvent(input: CaptureRawEventInput): Promise<{ id: string }> {
    const raw = await this.prisma.cameraEventRaw.create({
      data: {
        deviceIdRaw: input.deviceIdRaw,
        eventType: input.eventType,
        payload: input.payload as Prisma.InputJsonValue,
        contextIp: input.contextIp,
        contextHeaders: CameraGatewayLogger.redactHeaders(
          input.contextHeaders,
        ) as Prisma.InputJsonValue,
        validationStatus: 'PENDING',
      },
    });
    return { id: raw.id };
  }

  async markRawInvalid(rawEventId: string, errors: string[]): Promise<void> {
    await this.prisma.cameraEventRaw.update({
      where: { id: rawEventId },
      data: {
        validationStatus: 'INVALID',
        processingStatus: 'FAILED',
        error: errors.join('; ') || undefined,
      },
    });
    this.logger.warn(
      `Evento inválido rawEventId=${rawEventId}: ${errors.length} error(es) de validación`,
    );
  }

  async process(event: CanonicalCameraEvent): Promise<IngestionAck> {
    await this.markValid(event.rawEventId);

    switch (event.eventType) {
      case 'DEVICE_HANDSHAKE':
        return this.processDeviceHandshake(event);
      case 'HEARTBEAT':
        return this.processHeartbeat(event);
      case 'OCCUPANCY_UPDATE':
        return this.processOccupancyUpdate(event);
      default:
        await this.finalizeRaw(event.rawEventId, { status: 'PROCESSED' });
        return { status: 'ok' };
    }
  }

  private async markValid(rawEventId: string): Promise<void> {
    await this.prisma.cameraEventRaw.update({
      where: { id: rawEventId },
      data: { validationStatus: 'VALID' },
    });
  }

  private async processDeviceHandshake(
    event: CanonicalCameraEvent,
  ): Promise<IngestionAck> {
    const existingCamera = await this.prisma.camera.findUnique({
      where: { deviceId: event.externalDeviceId },
    });

    const ipAddress = (event.metadata.ipAddress as string | null) ?? null;
    const macAddress = (event.metadata.macAddress as string | null) ?? null;
    const manufacturer = (event.metadata.manufacturer as string | null) ?? null;
    const model = (event.metadata.model as string | null) ?? null;

    let camera: { id: string; tenantId: string | null };

    if (existingCamera) {
      camera = await this.prisma.camera.update({
        where: { id: existingCamera.id },
        data: {
          lastSeenAt: new Date(),
          ipAddress: ipAddress ?? existingCamera.ipAddress,
          macAddress: macAddress ?? existingCamera.macAddress,
          manufacturer: manufacturer ?? existingCamera.manufacturer,
          model: model ?? existingCamera.model,
        },
      });
      this.logger.log(
        `DeviceInfo: cámara conocida actualizada deviceId=${event.externalDeviceId} cameraId=${camera.id}`,
      );
    } else if (!this.config.pilotAutoRegisterEnabled) {
      await this.finalizeRaw(event.rawEventId, {
        status: 'FAILED',
        error:
          'Auto-registro de piloto deshabilitado; deviceId desconocido descartado',
      });
      this.logger.warn(
        `DeviceInfo de dispositivo desconocido descartado (auto-registro off) deviceId=${event.externalDeviceId}`,
      );
      return { status: 'ok' };
    } else {
      camera = await this.prisma.camera.create({
        data: {
          deviceId: event.externalDeviceId,
          ipAddress,
          macAddress,
          manufacturer,
          model,
          registrationStatus: 'pending_review',
          lastSeenAt: new Date(),
        },
      });
      this.logger.log(
        `Cámara nueva registrada en pending_review deviceId=${event.externalDeviceId} cameraId=${camera.id}`,
      );
    }

    await this.finalizeRaw(event.rawEventId, {
      status: 'PROCESSED',
      cameraId: camera.id,
      tenantId: camera.tenantId ?? undefined,
    });
    return { status: 'ok' };
  }

  private async processHeartbeat(
    event: CanonicalCameraEvent,
  ): Promise<IngestionAck> {
    const camera = await this.prisma.camera.findUnique({
      where: { deviceId: event.externalDeviceId },
    });

    if (!camera) {
      await this.finalizeRaw(event.rawEventId, {
        status: 'FAILED',
        error: 'Heartbeat de dispositivo desconocido descartado',
      });
      this.logger.warn(
        `Heartbeat descartado: deviceId desconocido=${event.externalDeviceId}`,
      );
      return { status: 'ok' };
    }

    const updated = await this.prisma.camera.update({
      where: { id: camera.id },
      data: { lastSeenAt: new Date(), status: 'active' },
    });

    await this.finalizeRaw(event.rawEventId, {
      status: 'PROCESSED',
      cameraId: updated.id,
      tenantId: updated.tenantId ?? undefined,
    });
    this.logger.log(
      `Heartbeat recibido deviceId=${event.externalDeviceId} cameraId=${updated.id}`,
    );
    return { status: 'ok' };
  }

  private async processOccupancyUpdate(
    event: CanonicalCameraEvent,
  ): Promise<IngestionAck> {
    const camera = await this.prisma.camera.findUnique({
      where: { deviceId: event.externalDeviceId },
    });

    if (!camera || !camera.tenantId || !camera.cityId) {
      await this.finalizeRaw(event.rawEventId, {
        status: 'FAILED',
        error: 'Cámara no resuelta o sin tenant/city asignado',
      });
      this.logger.warn(
        `ParkingInfo descartado: cámara no resuelta/activa deviceId=${event.externalDeviceId}`,
      );
      return { status: 'ok' };
    }

    const tenantId = camera.tenantId;
    const cityId = camera.cityId;

    let parkingSpace: {
      id: string;
      status: string;
      tenantId: string;
      cityId: string;
    } | null = null;

    if (event.externalStallCode && camera.zoneId) {
      parkingSpace = await this.prisma.parkingSpace.findUnique({
        where: {
          zoneId_code: { zoneId: camera.zoneId, code: event.externalStallCode },
        },
      });
    }

    const newSpaceStatus =
      event.parkingStatus === 'OCCUPIED'
        ? 'occupied'
        : event.parkingStatus === 'AVAILABLE'
          ? 'available'
          : null;

    const detectionScope = event.externalStallCode ? 'PLAZA' : 'AREA_ILEGAL';

    try {
      await this.prisma.$transaction(async (tx) => {
        const createdEvent = await tx.cameraEvent.create({
          data: {
            tenantId,
            cityId,
            cameraId: camera.id,
            plateNumber: event.plate?.number ?? null,
            eventType: 'ParkingInfo',
            confidence: event.plate?.confidence ?? null,
            occurredAt: event.occurredAt,
            detectionScope,
            idempotencyKey: event.idempotencyKey,
            rawEventId: event.rawEventId,
            parkingSpaceId: parkingSpace?.id ?? null,
            metadata: {
              illegalAreaName:
                (event.metadata.illegalAreaName as string | null) ?? null,
              channel: event.channel ?? null,
              vehicleType: event.vehicle?.type ?? null,
              allowedUser:
                (event.metadata.allowedUser as boolean | null) ?? null,
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
      if (this.isUniqueConstraintViolation(error)) {
        await this.finalizeRaw(event.rawEventId, {
          status: 'DUPLICATE',
          cameraId: camera.id,
          tenantId,
        });
        this.logger.log(
          `ParkingInfo duplicado (idempotente) ignorado idempotencyKey=${event.idempotencyKey}`,
        );
        return { status: 'ok' };
      }
      throw error;
    }

    await this.finalizeRaw(event.rawEventId, {
      status: 'PROCESSED',
      cameraId: camera.id,
      tenantId,
    });

    if (detectionScope === 'AREA_ILEGAL') {
      this.logger.log(
        `Área ilegal detectada (sin alerta todavía) deviceId=${event.externalDeviceId} area=${(event.metadata.illegalAreaName as string) ?? ''}`,
      );
    } else if (!parkingSpace) {
      this.logger.warn(
        `ParkingInfo: plaza no resuelta code=${event.externalStallCode ?? ''} deviceId=${event.externalDeviceId} (evento registrado sin plaza)`,
      );
    } else if (newSpaceStatus && newSpaceStatus !== parkingSpace.status) {
      this.logger.log(
        `ParkingSpace actualizada spaceId=${parkingSpace.id} ${parkingSpace.status}→${newSpaceStatus} deviceId=${event.externalDeviceId}`,
      );
    } else {
      this.logger.log(
        `ParkingInfo procesado sin cambio de estado spaceId=${parkingSpace.id} status=${event.parkingStatus} deviceId=${event.externalDeviceId}`,
      );
    }

    return { status: 'ok' };
  }

  /**
   * processedAt is set only when the outcome is PROCESSED (including a
   * DUPLICATE, which is stored as PROCESSED) — never for FAILED, matching
   * the exact behavior of the pre-refactor CameraIngestionService.
   */
  private async finalizeRaw(
    rawEventId: string,
    outcome: FinalizeRawInput,
  ): Promise<void> {
    const processingStatus =
      outcome.status === 'DUPLICATE' ? 'PROCESSED' : outcome.status;
    await this.prisma.cameraEventRaw.update({
      where: { id: rawEventId },
      data: {
        processingStatus,
        processedAt: processingStatus === 'PROCESSED' ? new Date() : undefined,
        cameraId: outcome.cameraId,
        tenantId: outcome.tenantId,
        error: outcome.error,
      },
    });
  }

  private isUniqueConstraintViolation(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
