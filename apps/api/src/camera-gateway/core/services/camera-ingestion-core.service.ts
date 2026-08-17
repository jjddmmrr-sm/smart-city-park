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
      case 'OCCUPANCY_SNAPSHOT':
        return this.processOccupancySnapshot(event);
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

  private async resolveProvider(providerCode: string) {
    return this.prisma.cameraProvider.findUnique({
      where: { code: providerCode },
    });
  }

  private async resolveCamera(providerId: string, externalDeviceId: string) {
    return this.prisma.camera.findUnique({
      where: {
        providerId_deviceId: { providerId, deviceId: externalDeviceId },
      },
    });
  }

  /**
   * Same "exactly one active gateway, else NULL" rule used by the
   * camera:backfill-provider domain command — never guess a gateway when
   * more than one (or none) is active for the provider.
   */
  private async resolveSoleActiveGateway(
    providerId: string,
  ): Promise<string | null> {
    const activeGateways = await this.prisma.cameraGateway.findMany({
      where: { providerId, active: true },
    });
    return activeGateways.length === 1 ? activeGateways[0].id : null;
  }

  private async processDeviceHandshake(
    event: CanonicalCameraEvent,
  ): Promise<IngestionAck> {
    const provider = await this.resolveProvider(event.providerCode);
    if (!provider) {
      await this.finalizeRaw(event.rawEventId, {
        status: 'FAILED',
        error: `providerCode desconocido: ${event.providerCode}`,
      });
      this.logger.warn(
        `DeviceInfo descartado: providerCode desconocido=${event.providerCode}`,
      );
      return { status: 'ok' };
    }

    const existingCamera = await this.resolveCamera(
      provider.id,
      event.externalDeviceId,
    );

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
      const gatewayId = await this.resolveSoleActiveGateway(provider.id);
      camera = await this.prisma.camera.create({
        data: {
          deviceId: event.externalDeviceId,
          providerId: provider.id,
          gatewayId,
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
    const provider = await this.resolveProvider(event.providerCode);
    const camera = provider
      ? await this.resolveCamera(provider.id, event.externalDeviceId)
      : null;

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

  /**
   * Resolves the CameraStallMapping for (cameraId, externalStallCode),
   * creating it as DISCOVERED on first sight — see
   * docs/architecture/iot-device-management-foundation.md §9. Never
   * updates ParkingSpace itself; that only happens once an operator (or
   * the temporary fallback below) sets the mapping to ACTIVE.
   *
   * TEMPORARY FALLBACK: if the reported code already matches a real
   * ParkingSpace.code in the camera's own zone — the old, pre-mapping
   * resolution rule this replaces — the mapping is created already
   * ACTIVE instead of DISCOVERED, so pilot cameras whose stall codes
   * happen to equal existing ParkingSpace codes (including
   * SIMULATOR-DAHUA-0001 and test/dahua/simulate.ts's fixtures) keep
   * working without a manual activation step. Remove this fallback once
   * every camera's stall codes are mapped explicitly from the
   * /admin/iot/mappings screen instead of relying on a naming
   * coincidence with ParkingSpace.code.
   */
  private async resolveOrCreateStallMapping(
    camera: {
      id: string;
      tenantId: string;
      cityId: string;
      zoneId: string | null;
    },
    externalStallCode: string,
  ) {
    const existing = await this.prisma.cameraStallMapping.findUnique({
      where: {
        cameraId_externalStallCode: {
          cameraId: camera.id,
          externalStallCode,
        },
      },
    });

    if (existing) {
      return this.prisma.cameraStallMapping.update({
        where: { id: existing.id },
        data: { lastReportedAt: new Date() },
      });
    }

    // CameraStallMapping.zoneId is mandatory — a camera not yet assigned
    // to a zone (tenant/city set, zone still pending) cannot have a
    // mapping row at all. The event still gets recorded via the raw log
    // and a spaceless CameraEvent; there is simply nothing to map yet.
    if (!camera.zoneId) {
      return null;
    }

    const legacySpace = await this.prisma.parkingSpace.findUnique({
      where: {
        zoneId_code: { zoneId: camera.zoneId, code: externalStallCode },
      },
    });

    try {
      return await this.prisma.cameraStallMapping.create({
        data: {
          tenantId: camera.tenantId,
          cityId: camera.cityId,
          zoneId: camera.zoneId,
          cameraId: camera.id,
          externalStallCode,
          parkingSpaceId: legacySpace?.id ?? null,
          mappingStatus: legacySpace ? 'ACTIVE' : 'DISCOVERED',
        },
      });
    } catch (error) {
      if (this.isUniqueConstraintViolation(error)) {
        return this.prisma.cameraStallMapping.findUnique({
          where: {
            cameraId_externalStallCode: {
              cameraId: camera.id,
              externalStallCode,
            },
          },
        });
      }
      throw error;
    }
  }

  private async processOccupancyUpdate(
    event: CanonicalCameraEvent,
  ): Promise<IngestionAck> {
    const provider = await this.resolveProvider(event.providerCode);
    const camera = provider
      ? await this.resolveCamera(provider.id, event.externalDeviceId)
      : null;

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

    if (event.externalStallCode) {
      const stallMapping = await this.resolveOrCreateStallMapping(
        { id: camera.id, tenantId, cityId, zoneId: camera.zoneId },
        event.externalStallCode,
      );

      if (
        stallMapping?.mappingStatus === 'ACTIVE' &&
        stallMapping.parkingSpaceId
      ) {
        parkingSpace = await this.prisma.parkingSpace.findUnique({
          where: { id: stallMapping.parkingSpaceId },
        });
      }
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
   * TimedParkingSpaceInfo (post-firmware-update Dahua cameras): the camera
   * resends every configured stall's state on each change, not just the
   * one that changed — see docs/architecture/iot-device-management-foundation.md
   * §5 and DAHUA_IMPLEMENTATION_PLAN.md. `event.spaces` is dynamic-length,
   * never assumed to have a maximum.
   *
   * Per stall: resolve/create its CameraStallMapping exactly like
   * ParkingInfo already does (reuses resolveOrCreateStallMapping
   * unchanged), then only create a CameraEvent + update ParkingSpace +
   * write history for stalls whose reported status actually differs from
   * the currently known ParkingSpace.status. Stalls with no active mapping
   * (DISCOVERED, no ParkingSpace yet) are counted but never touch
   * ParkingSpace — same "record RAW, nothing to compare yet" behavior as
   * an unmapped ParkingInfo stall.
   */
  private async processOccupancySnapshot(
    event: CanonicalCameraEvent,
  ): Promise<IngestionAck> {
    const provider = await this.resolveProvider(event.providerCode);
    const camera = provider
      ? await this.resolveCamera(provider.id, event.externalDeviceId)
      : null;

    if (!camera || !camera.tenantId || !camera.cityId) {
      await this.finalizeRaw(event.rawEventId, {
        status: 'FAILED',
        error: 'Cámara no resuelta o sin tenant/city asignado',
      });
      this.logger.warn(
        `TimedParkingSpaceInfo descartado: cámara no resuelta/activa deviceId=${event.externalDeviceId}`,
      );
      return { status: 'ok' };
    }

    const tenantId = camera.tenantId;
    const cityId = camera.cityId;
    const reported = event.spaces ?? [];

    if (reported.length === 0) {
      await this.finalizeRaw(event.rawEventId, {
        status: 'PROCESSED',
        cameraId: camera.id,
        tenantId,
      });
      this.logger.warn(
        `TimedParkingSpaceInfo sin plazas válidas deviceId=${event.externalDeviceId}`,
      );
      return { status: 'ok' };
    }

    // One mapping lookup/creation per reported stall, exactly like a
    // single ParkingInfo request already does — deliberately not batched
    // further (createMany can't report which rows already existed) since
    // new-mapping creation is a one-time cost per stall, not steady state.
    const mappingByCode = new Map<
      string,
      Awaited<ReturnType<typeof this.resolveOrCreateStallMapping>>
    >();
    for (const space of reported) {
      const mapping = await this.resolveOrCreateStallMapping(
        { id: camera.id, tenantId, cityId, zoneId: camera.zoneId },
        space.externalStallCode,
      );
      mappingByCode.set(space.externalStallCode, mapping);
    }

    // Batch-fetch every actively-mapped ParkingSpace in one query instead
    // of one round trip per stall — the actual comparison target for the
    // diff below.
    const activeSpaceIds = [...mappingByCode.values()]
      .filter(
        (m): m is NonNullable<typeof m> =>
          !!m && m.mappingStatus === 'ACTIVE' && !!m.parkingSpaceId,
      )
      .map((m) => m.parkingSpaceId!);

    const currentSpaces = activeSpaceIds.length
      ? await this.prisma.parkingSpace.findMany({
          where: { id: { in: activeSpaceIds } },
        })
      : [];
    const currentSpaceById = new Map(currentSpaces.map((s) => [s.id, s]));

    let changedCount = 0;
    let unchangedCount = 0;
    let unmappedCount = 0;
    let duplicateCount = 0;

    for (const space of reported) {
      const mapping = mappingByCode.get(space.externalStallCode);
      const newStatus =
        space.parkingStatus === 'OCCUPIED'
          ? 'occupied'
          : space.parkingStatus === 'AVAILABLE'
            ? 'available'
            : null;

      if (!mapping?.parkingSpaceId || mapping.mappingStatus !== 'ACTIVE') {
        unmappedCount++;
        continue;
      }
      const current = currentSpaceById.get(mapping.parkingSpaceId);
      if (!current || !newStatus || current.status === newStatus) {
        unchangedCount++;
        continue;
      }

      try {
        await this.prisma.$transaction(async (tx) => {
          const createdEvent = await tx.cameraEvent.create({
            data: {
              tenantId,
              cityId,
              cameraId: camera.id,
              eventType: 'TimedParkingSpaceInfo',
              occurredAt: event.occurredAt,
              detectionScope: 'PLAZA',
              idempotencyKey: space.idempotencyKey,
              rawEventId: event.rawEventId,
              parkingSpaceId: current.id,
              metadata: { externalStallCode: space.externalStallCode },
            },
          });

          await tx.parkingSpace.update({
            where: { id: current.id },
            data: { status: newStatus },
          });
          await tx.parkingSpaceStatusHistory.create({
            data: {
              tenantId: current.tenantId,
              cityId: current.cityId,
              spaceId: current.id,
              previousStatus: current.status,
              newStatus,
              source: 'CAMERA',
              sourceEventId: createdEvent.id,
            },
          });
        });
        // Keep the in-memory snapshot consistent in case the same stall
        // code appears more than once in the same batch (not expected from
        // real hardware, but keeps the diff correct either way).
        currentSpaceById.set(current.id, { ...current, status: newStatus });
        changedCount++;
      } catch (error) {
        if (this.isUniqueConstraintViolation(error)) {
          duplicateCount++;
          continue;
        }
        throw error;
      }
    }

    await this.finalizeRaw(event.rawEventId, {
      status: 'PROCESSED',
      cameraId: camera.id,
      tenantId,
    });

    this.logger.log(
      `[TimedParkingSpaceInfo] deviceId=${event.externalDeviceId} ` +
        `plazasRecibidas=${reported.length} plazasConCambio=${changedCount} ` +
        `plazasSinCambio=${unchangedCount} plazasSinMapear=${unmappedCount} ` +
        `duplicados=${duplicateCount}`,
    );

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
