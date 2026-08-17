/**
 * Fase 0.9 — Simulador de eventos Dahua ITSAPI.
 *
 * Ejercita los mismos endpoints HTTP reales que usará la cámara física
 * (POST /integrations/dahua/NotificationInfo/*), contra un servidor ya
 * corriendo (npm run start:dev) — sin mocks, sin capas salteadas.
 *
 * Uso:
 *   npm run test:dahua
 *
 * Configuración: ver docs/integrations/dahua/SIMULATOR.md — todo por
 * variables de entorno, nada hardcodeado (host/puerto/rutas/credenciales).
 */
import 'dotenv/config';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// ---------------------------------------------------------------------------
// Configuración — todo desde el entorno, defaults acordados en Fase 0.9.
// ---------------------------------------------------------------------------

const config = {
  baseUrl: process.env.DAHUA_SIM_BASE_URL ?? 'http://localhost:3000',
  autoApprove: process.env.DAHUA_SIM_AUTO_APPROVE === 'true',
  reportDir: process.env.DAHUA_SIM_REPORT_DIR
    ? path.resolve(process.env.DAHUA_SIM_REPORT_DIR)
    : path.resolve(__dirname, '..', '..', 'test-results'),
  serverLogPath: process.env.DAHUA_SIM_SERVER_LOG,
  deviceId: process.env.DAHUA_SIM_DEVICE_ID ?? 'SIMULATOR-DAHUA-0001',
  unknownDeviceId:
    process.env.DAHUA_SIM_UNKNOWN_DEVICE_ID ?? 'SIMULATOR-DAHUA-UNKNOWN',
  providerCode: process.env.DAHUA_SIM_PROVIDER_CODE ?? 'DAHUA_ITSAPI',
  parkingSpaceCode: process.env.DAHUA_SIM_PARKING_SPACE_CODE ?? 'CENTRO-005',
  tenantCode: process.env.DAHUA_SIM_TENANT_CODE ?? 'MUNI_DEMO',
  cityCode: process.env.DAHUA_SIM_CITY_CODE ?? 'SMART_CITY',
  zoneCode: process.env.DAHUA_SIM_ZONE_CODE ?? 'CENTRO',
};

const payloadsDir = path.join(__dirname, 'payloads');

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

// ---------------------------------------------------------------------------
// Reporte y checks
// ---------------------------------------------------------------------------

interface CheckResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'MANUAL';
  detail: string;
}

const checks: CheckResult[] = [];

function check(name: string, condition: boolean, detail: string): boolean {
  checks.push({ name, status: condition ? 'PASS' : 'FAIL', detail });
  console.log(`[${condition ? '✓' : '✗'}] ${name} — ${detail}`);
  return condition;
}

function manualCheck(name: string, detail: string): void {
  checks.push({ name, status: 'MANUAL', detail });
  console.log(`[?] ${name} — ${detail}`);
}

// ---------------------------------------------------------------------------
// Formas de payload — suficiente para lo que el simulador lee/escribe; el
// resto de los campos reales (Plate, Vehicle, NormalPic, ...) viajan tal
// cual gracias a la firma indexada, sin necesidad de modelarlos todos.
// ---------------------------------------------------------------------------

interface DeviceInfoPayload {
  DeviceID: string;
  [key: string]: unknown;
}

interface ParkingInfoBlock {
  DeviceID: string;
  ParkingStallsNo?: string;
  ParkingStatus: number;
  DetectRegionName?: string;
  SnapTime?: string;
  [key: string]: unknown;
}

interface ParkingInfoPayload {
  Picture: {
    ParkingInfo: ParkingInfoBlock;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface SpaceModeInfoItem {
  ParkNo?: string;
  SpaceType?: number;
  Used?: boolean;
  [key: string]: unknown;
}

interface TimedParkingSpaceInfoPayload {
  DeviceID: string;
  Time?: string;
  EventID?: number;
  SpaceModeInfo: SpaceModeInfoItem[];
  ParkingSpacePic?: { Content?: string; PicName?: string };
  [key: string]: unknown;
}

// Identificadores exclusivos de esta suite — nunca colisionan con datos
// reales (que usan códigos catastrales tipo CENTRO-0XX/A0XX) ni con los
// fixtures de ParkingInfo (CENTRO-005). Todo lo creado bajo estos
// prefijos/códigos es propiedad del simulador y se limpia al final de
// runTimedParkingSpaceInfoTests(), corra como corra el resto de la suite.
const SIM_TPS_SPACE_CODE = 'SIM-TPS-C04';
const SIM_TPS_UNKNOWN_CODE = 'SIM-TPS-UNKNOWN-999';
const SIM_TPS_BULK_PREFIX = 'SIM-TPS-BULK-';
const SIM_TPS_STALL_CODES = [
  'C01',
  'C02',
  'C03',
  'C04',
  'C05',
  'C06',
  'C07',
  'C08',
  'C09',
];

// ---------------------------------------------------------------------------
// Helpers de payload / HTTP
// ---------------------------------------------------------------------------

function loadPayload<T>(fileName: string): T {
  const raw = fs.readFileSync(path.join(payloadsDir, fileName), 'utf-8');
  return JSON.parse(raw) as T;
}

function formatSnapTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

/** Sobrescribe SnapTime con el instante real de ejecución — ver §"Problema"
 * del diseño aprobado: un SnapTime estático rompería la repetibilidad del
 * simulador al chocar con la clave de idempotencia en runs sucesivos. */
function injectSnapTime(payload: ParkingInfoPayload): ParkingInfoPayload {
  payload.Picture.ParkingInfo.SnapTime = formatSnapTime(new Date());
  return payload;
}

/**
 * Deep-clones a TimedParkingSpaceInfo fixture and overrides exactly one
 * stall's `Used` — never mutates the object passed in, so callers can keep
 * reusing a `base` payload across cases. `freshTime` mirrors
 * injectSnapTime()'s rationale: a genuine state change needs an advancing
 * Time so its idempotencyKey differs from the previous request; an
 * idempotency case deliberately reuses the exact same in-memory object
 * instead of calling this at all (see Caso T2/T4 below).
 */
function withStallUsed(
  base: TimedParkingSpaceInfoPayload,
  parkNo: string,
  used: boolean,
  freshTime: boolean,
): TimedParkingSpaceInfoPayload {
  const clone = JSON.parse(
    JSON.stringify(base),
  ) as TimedParkingSpaceInfoPayload;
  const item = clone.SpaceModeInfo.find((i) => i.ParkNo === parkNo);
  if (item) item.Used = used;
  if (freshTime) clone.Time = formatSnapTime(new Date());
  return clone;
}

async function postEvent(
  eventPath: string,
  body: unknown,
): Promise<{ status: number; ok: boolean; body: unknown }> {
  const res = await fetch(
    `${config.baseUrl}/integrations/dahua/NotificationInfo/${eventPath}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    // algunas respuestas pueden venir vacías — no es un error del simulador
  }
  return { status: res.status, ok: res.ok, body: json };
}

async function fingerprint() {
  const [
    tenants,
    cities,
    users,
    parkingSpaces,
    cameras,
    cameraEvents,
    cameraEventsRaw,
    cameraSnapshots,
    parkingSpaceStatusHistory,
    alerts,
    auditLogs,
  ] = await Promise.all([
    prisma.tenant.count(),
    prisma.city.count(),
    prisma.user.count(),
    prisma.parkingSpace.count(),
    prisma.camera.count(),
    prisma.cameraEvent.count(),
    prisma.cameraEventRaw.count(),
    prisma.cameraSnapshot.count(),
    prisma.parkingSpaceStatusHistory.count(),
    prisma.alert.count(),
    prisma.auditLog.count(),
  ]);
  return {
    tenants,
    cities,
    users,
    parkingSpaces,
    cameras,
    cameraEvents,
    cameraEventsRaw,
    cameraSnapshots,
    parkingSpaceStatusHistory,
    alerts,
    auditLogs,
  };
}

async function writeReportAndExit(
  report: Record<string, unknown>,
  startedAt: Date,
  exitOverride?: number,
): Promise<never> {
  const finishedAt = new Date();
  const passed = checks.filter((c) => c.status === 'PASS').length;
  const failed = checks.filter((c) => c.status === 'FAIL').length;
  const manual = checks.filter((c) => c.status === 'MANUAL').length;

  report.finishedAt = finishedAt.toISOString();
  report.durationMs = finishedAt.getTime() - startedAt.getTime();
  report.result = {
    pass: failed === 0,
    totalChecks: checks.length,
    passedChecks: passed,
    failedChecks: failed,
    manualChecks: manual,
    checks,
  };

  fs.mkdirSync(config.reportDir, { recursive: true });
  const reportPath = path.join(config.reportDir, 'simulation-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log('');
  console.log(
    `RESULTADO: ${(report.result as { pass: boolean }).pass ? 'PASS' : 'FAIL'} ` +
      `(${passed}/${checks.length} PASS, ${manual} manual, ${failed} FAIL)`,
  );
  console.log(`Reporte: ${reportPath}`);

  await prisma.$disconnect();
  process.exit(
    exitOverride ?? ((report.result as { pass: boolean }).pass ? 0 : 1),
  );
}

// ---------------------------------------------------------------------------
// TimedParkingSpaceInfo — Occupancy Snapshot
//
// Post-firmware-update source of truth para ocupación (ver
// DAHUA_IMPLEMENTATION_PLAN.md §17). Auto-contenida: prepara y limpia su
// propio ParkingSpace/CameraStallMapping bajo códigos exclusivos del
// simulador (SIM_TPS_*), nunca asume C01-C09/CENTRO-008 dejados por una
// prueba manual anterior, y nunca toca CENTRO-005 (fixture de ParkingInfo)
// ni ninguna cámara/mapping real. Corre después de que el flujo original de
// DeviceInfo/KeepAlive/ParkingInfo ya haya calculado sus propios fingerprints
// — mantiene esos deltas exactamente como estaban antes de esta extensión.
// ---------------------------------------------------------------------------

async function setupTpsFixture(camera: {
  id: string;
  tenantId: string;
  cityId: string;
  zoneId: string;
}) {
  // Limpieza defensiva de un run anterior interrumpido (crash/Ctrl+C) antes
  // de crear — deja la suite determinística sin depender de que el run
  // previo haya llegado a su propio cleanup.
  const leftoverSpace = await prisma.parkingSpace.findUnique({
    where: { zoneId_code: { zoneId: camera.zoneId, code: SIM_TPS_SPACE_CODE } },
  });
  if (leftoverSpace) {
    await prisma.parkingSpaceStatusHistory.deleteMany({
      where: { spaceId: leftoverSpace.id },
    });
    await prisma.cameraEvent.deleteMany({
      where: { parkingSpaceId: leftoverSpace.id },
    });
    await prisma.cameraStallMapping.updateMany({
      where: { parkingSpaceId: leftoverSpace.id },
      data: { parkingSpaceId: null, mappingStatus: 'DISCOVERED' },
    });
    await prisma.parkingSpace.delete({ where: { id: leftoverSpace.id } });
  }
  await prisma.cameraStallMapping.deleteMany({
    where: {
      cameraId: camera.id,
      OR: [
        { externalStallCode: { in: SIM_TPS_STALL_CODES } },
        { externalStallCode: SIM_TPS_UNKNOWN_CODE },
        { externalStallCode: { startsWith: SIM_TPS_BULK_PREFIX } },
      ],
    },
  });

  const space = await prisma.parkingSpace.create({
    data: {
      tenantId: camera.tenantId,
      cityId: camera.cityId,
      zoneId: camera.zoneId,
      code: SIM_TPS_SPACE_CODE,
      label: 'Simulador — TimedParkingSpaceInfo C04',
      type: 'vehicle',
      status: 'available',
    },
  });
  const mapping = await prisma.cameraStallMapping.create({
    data: {
      tenantId: camera.tenantId,
      cityId: camera.cityId,
      zoneId: camera.zoneId,
      cameraId: camera.id,
      externalStallCode: 'C04',
      parkingSpaceId: space.id,
      mappingStatus: 'ACTIVE',
    },
  });
  return { space, mapping };
}

async function cleanupTpsFixture(camera: { id: string }, spaceId: string) {
  await prisma.parkingSpaceStatusHistory.deleteMany({ where: { spaceId } });
  await prisma.cameraEvent.deleteMany({ where: { parkingSpaceId: spaceId } });
  await prisma.cameraStallMapping.deleteMany({
    where: {
      cameraId: camera.id,
      OR: [
        { externalStallCode: { in: SIM_TPS_STALL_CODES } },
        { externalStallCode: SIM_TPS_UNKNOWN_CODE },
        { externalStallCode: { startsWith: SIM_TPS_BULK_PREFIX } },
      ],
    },
  });
  await prisma.parkingSpace.delete({ where: { id: spaceId } });
}

async function runTimedParkingSpaceInfoTests(
  camera: { id: string; tenantId: string; cityId: string; zoneId: string },
  report: Record<string, unknown>,
) {
  console.log('');
  console.log('=== TimedParkingSpaceInfo — Occupancy Snapshot ===');

  const tps: Record<string, unknown> = {};
  report.timedParkingSpaceInfo = tps;

  const { space: tpsSpace } = await setupTpsFixture(camera);
  tps.setup = {
    parkingSpaceId: tpsSpace.id,
    parkingSpaceCode: tpsSpace.code,
    initialStatus: tpsSpace.status,
  };

  const basePayload = loadPayload<TimedParkingSpaceInfoPayload>(
    'TimedParkingSpaceInfo_Initial.json',
  );
  basePayload.DeviceID = config.deviceId;
  basePayload.Time = formatSnapTime(new Date());

  try {
    // --- T1: snapshot de 9 plazas, C04 Used=false (coincide con el default
    // 'available' del ParkingSpace recién creado) -----------------------------
    const t1Payload = withStallUsed(basePayload, 'C04', false, false);
    const historyCountBeforeT1 = await prisma.parkingSpaceStatusHistory.count({
      where: { spaceId: tpsSpace.id },
    });
    const rawCountBeforeT1 = await prisma.cameraEventRaw.count();

    const t1Res = await postEvent('TimedParkingSpaceInfo', t1Payload);
    const t1Ack = t1Res.body as {
      Result?: boolean;
      Message?: string;
      DeviceID?: string;
    } | null;

    const spaceAfterT1 = await prisma.parkingSpace.findUnique({
      where: { id: tpsSpace.id },
    });
    const eventsAfterT1 = await prisma.cameraEvent.count({
      where: { parkingSpaceId: tpsSpace.id },
    });
    const historyAfterT1 = await prisma.parkingSpaceStatusHistory.count({
      where: { spaceId: tpsSpace.id },
    });
    const rawCountAfterT1 = await prisma.cameraEventRaw.count();
    const otherMappingsAfterT1 = await prisma.cameraStallMapping.findMany({
      where: {
        cameraId: camera.id,
        externalStallCode: {
          in: SIM_TPS_STALL_CODES.filter((c) => c !== 'C04'),
        },
      },
    });
    const latestRawT1 = await prisma.cameraEventRaw.findFirst({
      where: { cameraId: camera.id, eventType: 'TimedParkingSpaceInfo' },
      orderBy: { receivedAt: 'desc' },
    });

    check('T1: HTTP 200', t1Res.status === 200, `status=${t1Res.status}`);
    check(
      'T1: ACK Result=true con DeviceID correcto',
      t1Ack?.Result === true && t1Ack?.DeviceID === config.deviceId,
      `ack=${JSON.stringify(t1Ack)}`,
    );
    check(
      'T1: CameraEventRaw nuevo queda PROCESSED',
      rawCountAfterT1 === rawCountBeforeT1 + 1 &&
        latestRawT1?.processingStatus === 'PROCESSED',
      `rawAntes=${rawCountBeforeT1} rawDespués=${rawCountAfterT1} processingStatus=${latestRawT1?.processingStatus}`,
    );
    check(
      'T1: ParkingSpace de C04 sigue AVAILABLE',
      spaceAfterT1?.status === 'available',
      `status=${spaceAfterT1?.status}`,
    );
    check(
      'T1: no se crea CameraEvent para C04 (estado reportado == estado actual)',
      eventsAfterT1 === 0,
      `CameraEvent count=${eventsAfterT1}`,
    );
    check(
      'T1: no se crea ParkingSpaceStatusHistory para C04',
      historyAfterT1 === historyCountBeforeT1,
      `antes=${historyCountBeforeT1} después=${historyAfterT1}`,
    );
    check(
      'T1: C01-C03/C05-C09 quedan DISCOVERED sin ParkingSpace',
      otherMappingsAfterT1.length === 8 &&
        otherMappingsAfterT1.every(
          (m) => m.mappingStatus === 'DISCOVERED' && m.parkingSpaceId === null,
        ),
      `mappings=${JSON.stringify(otherMappingsAfterT1.map((m) => ({ code: m.externalStallCode, status: m.mappingStatus })))}`,
    );
    const t1Pass = check(
      'TimedParkingSpaceInfo initial snapshot accepted',
      t1Res.status === 200 &&
        eventsAfterT1 === 0 &&
        spaceAfterT1?.status === 'available',
      'snapshot inicial de 9 plazas aceptado, C04 reconocida sin cambio real',
    );
    tps.t1 = {
      httpStatus: t1Res.status,
      ack: t1Ack,
      spaceStatus: spaceAfterT1?.status,
      cameraEventCreated: eventsAfterT1 > 0,
      historyCreated: historyAfterT1 > historyCountBeforeT1,
      unmappedStallCount: otherMappingsAfterT1.length,
      pass: t1Pass,
    };

    // --- T2: idempotencia — mismo objeto en memoria, sin releer disco --------
    const eventsBeforeT2 = eventsAfterT1;
    const historyBeforeT2 = historyAfterT1;

    const t2Res = await postEvent('TimedParkingSpaceInfo', t1Payload);
    const t2Ack = t2Res.body as { Result?: boolean } | null;

    const spaceAfterT2 = await prisma.parkingSpace.findUnique({
      where: { id: tpsSpace.id },
    });
    const eventsAfterT2 = await prisma.cameraEvent.count({
      where: { parkingSpaceId: tpsSpace.id },
    });
    const historyAfterT2 = await prisma.parkingSpaceStatusHistory.count({
      where: { spaceId: tpsSpace.id },
    });

    check('T2: HTTP 200', t2Res.status === 200, `status=${t2Res.status}`);
    check(
      'T2: ACK Result=true',
      t2Ack?.Result === true,
      `ack=${JSON.stringify(t2Ack)}`,
    );
    check(
      'T2: ParkingSpace sigue AVAILABLE',
      spaceAfterT2?.status === 'available',
      `status=${spaceAfterT2?.status}`,
    );
    check(
      'T2: 0 CameraEvent nuevos',
      eventsAfterT2 === eventsBeforeT2,
      `antes=${eventsBeforeT2} después=${eventsAfterT2}`,
    );
    check(
      'T2: 0 ParkingSpaceStatusHistory nuevos',
      historyAfterT2 === historyBeforeT2,
      `antes=${historyBeforeT2} después=${historyAfterT2}`,
    );
    const t2Pass = check(
      'TimedParkingSpaceInfo identical snapshot is idempotent',
      t2Res.status === 200 &&
        eventsAfterT2 === eventsBeforeT2 &&
        historyAfterT2 === historyBeforeT2,
      'reenvío exacto del mismo snapshot sin mutación funcional',
    );
    tps.t2 = {
      httpStatus: t2Res.status,
      cameraEventDelta: eventsAfterT2 - eventsBeforeT2,
      historyDelta: historyAfterT2 - historyBeforeT2,
      pass: t2Pass,
    };

    // --- T3: cambio real, únicamente C04 false→true --------------------------
    const t3Payload = withStallUsed(basePayload, 'C04', true, true);
    const eventsBeforeT3 = eventsAfterT2;
    const historyBeforeT3 = historyAfterT2;

    const t3Res = await postEvent('TimedParkingSpaceInfo', t3Payload);
    const t3Ack = t3Res.body as { Result?: boolean } | null;

    const spaceAfterT3 = await prisma.parkingSpace.findUnique({
      where: { id: tpsSpace.id },
    });
    const eventsRowsAfterT3 = await prisma.cameraEvent.findMany({
      where: { parkingSpaceId: tpsSpace.id },
      orderBy: { createdAt: 'asc' },
    });
    const historyRowsAfterT3 = await prisma.parkingSpaceStatusHistory.findMany({
      where: { spaceId: tpsSpace.id },
      orderBy: { changedAt: 'asc' },
    });
    const newEventT3 = eventsRowsAfterT3[eventsRowsAfterT3.length - 1];
    const newHistoryT3 = historyRowsAfterT3[historyRowsAfterT3.length - 1];

    check('T3: HTTP 200', t3Res.status === 200, `status=${t3Res.status}`);
    check(
      'T3: ACK Result=true',
      t3Ack?.Result === true,
      `ack=${JSON.stringify(t3Ack)}`,
    );
    check(
      'T3: ParkingSpace pasa a OCCUPIED',
      spaceAfterT3?.status === 'occupied',
      `antes=available después=${spaceAfterT3?.status}`,
    );
    check(
      'T3: exactamente 1 CameraEvent nuevo (eventType/detectionScope/metadata correctos)',
      eventsRowsAfterT3.length === eventsBeforeT3 + 1 &&
        newEventT3?.eventType === 'TimedParkingSpaceInfo' &&
        newEventT3?.detectionScope === 'PLAZA' &&
        (newEventT3?.metadata as Record<string, unknown> | null)
          ?.externalStallCode === 'C04',
      `count=${eventsRowsAfterT3.length} eventType=${newEventT3?.eventType} detectionScope=${newEventT3?.detectionScope} metadata=${JSON.stringify(newEventT3?.metadata)}`,
    );
    check(
      'T3: exactamente 1 ParkingSpaceStatusHistory nuevo (available→occupied, source=CAMERA)',
      historyRowsAfterT3.length === historyBeforeT3 + 1 &&
        newHistoryT3?.previousStatus === 'available' &&
        newHistoryT3?.newStatus === 'occupied' &&
        newHistoryT3?.source === 'CAMERA' &&
        newHistoryT3?.sourceEventId === newEventT3?.id,
      `count=${historyRowsAfterT3.length} previousStatus=${newHistoryT3?.previousStatus} newStatus=${newHistoryT3?.newStatus} source=${newHistoryT3?.source} sourceEventId=${newHistoryT3?.sourceEventId} eventId=${newEventT3?.id}`,
    );
    const t3Pass = check(
      'TimedParkingSpaceInfo updates only changed mapped stall',
      spaceAfterT3?.status === 'occupied' &&
        eventsRowsAfterT3.length === eventsBeforeT3 + 1 &&
        historyRowsAfterT3.length === historyBeforeT3 + 1,
      'solo C04 generó CameraEvent + historial; C01-C03/C05-C09 sin mapping no generaron nada',
    );
    tps.t3 = {
      httpStatus: t3Res.status,
      spaceStatus: spaceAfterT3?.status,
      cameraEvent: newEventT3
        ? {
            id: newEventT3.id,
            eventType: newEventT3.eventType,
            detectionScope: newEventT3.detectionScope,
            idempotencyKey: newEventT3.idempotencyKey,
            metadata: newEventT3.metadata,
          }
        : null,
      history: newHistoryT3
        ? {
            previousStatus: newHistoryT3.previousStatus,
            newStatus: newHistoryT3.newStatus,
            source: newHistoryT3.source,
          }
        : null,
      pass: t3Pass,
    };

    // --- T4: mismo snapshot ocupado reenviado — sin nuevo historial ----------
    const eventsBeforeT4 = eventsRowsAfterT3.length;
    const historyBeforeT4 = historyRowsAfterT3.length;

    const t4Res = await postEvent('TimedParkingSpaceInfo', t3Payload);
    const t4Ack = t4Res.body as { Result?: boolean } | null;

    const spaceAfterT4 = await prisma.parkingSpace.findUnique({
      where: { id: tpsSpace.id },
    });
    const eventsAfterT4 = await prisma.cameraEvent.count({
      where: { parkingSpaceId: tpsSpace.id },
    });
    const historyAfterT4 = await prisma.parkingSpaceStatusHistory.count({
      where: { spaceId: tpsSpace.id },
    });

    check('T4: HTTP 200', t4Res.status === 200, `status=${t4Res.status}`);
    check(
      'T4: ACK Result=true',
      t4Ack?.Result === true,
      `ack=${JSON.stringify(t4Ack)}`,
    );
    check(
      'T4: ParkingSpace sigue OCCUPIED',
      spaceAfterT4?.status === 'occupied',
      `status=${spaceAfterT4?.status}`,
    );
    check(
      'T4: 0 CameraEvent nuevos',
      eventsAfterT4 === eventsBeforeT4,
      `antes=${eventsBeforeT4} después=${eventsAfterT4}`,
    );
    check(
      'T4: 0 ParkingSpaceStatusHistory nuevos',
      historyAfterT4 === historyBeforeT4,
      `antes=${historyBeforeT4} después=${historyAfterT4}`,
    );
    const t4Pass = check(
      'TimedParkingSpaceInfo occupied duplicate does not create history',
      eventsAfterT4 === eventsBeforeT4 && historyAfterT4 === historyBeforeT4,
      'reenvío de C04=true ya ocupado no generó eventos ni historial adicional',
    );
    tps.t4 = {
      httpStatus: t4Res.status,
      cameraEventDelta: eventsAfterT4 - eventsBeforeT4,
      historyDelta: historyAfterT4 - historyBeforeT4,
      pass: t4Pass,
    };

    // --- T5: cambio inverso, únicamente C04 true→false -----------------------
    const t5Payload = withStallUsed(basePayload, 'C04', false, true);
    const eventsBeforeT5 = eventsAfterT4;
    const historyBeforeT5 = historyAfterT4;

    const t5Res = await postEvent('TimedParkingSpaceInfo', t5Payload);
    const t5Ack = t5Res.body as { Result?: boolean } | null;

    const spaceAfterT5 = await prisma.parkingSpace.findUnique({
      where: { id: tpsSpace.id },
    });
    const eventsRowsAfterT5 = await prisma.cameraEvent.findMany({
      where: { parkingSpaceId: tpsSpace.id },
      orderBy: { createdAt: 'asc' },
    });
    const historyRowsAfterT5 = await prisma.parkingSpaceStatusHistory.findMany({
      where: { spaceId: tpsSpace.id },
      orderBy: { changedAt: 'asc' },
    });
    const newHistoryT5 = historyRowsAfterT5[historyRowsAfterT5.length - 1];

    check('T5: HTTP 200', t5Res.status === 200, `status=${t5Res.status}`);
    check(
      'T5: ACK Result=true',
      t5Ack?.Result === true,
      `ack=${JSON.stringify(t5Ack)}`,
    );
    check(
      'T5: ParkingSpace vuelve a AVAILABLE',
      spaceAfterT5?.status === 'available',
      `status=${spaceAfterT5?.status}`,
    );
    check(
      'T5: exactamente 1 CameraEvent adicional',
      eventsRowsAfterT5.length === eventsBeforeT5 + 1,
      `antes=${eventsBeforeT5} después=${eventsRowsAfterT5.length}`,
    );
    check(
      'T5: exactamente 1 ParkingSpaceStatusHistory adicional (occupied→available, source=CAMERA)',
      historyRowsAfterT5.length === historyBeforeT5 + 1 &&
        newHistoryT5?.previousStatus === 'occupied' &&
        newHistoryT5?.newStatus === 'available' &&
        newHistoryT5?.source === 'CAMERA',
      `count=${historyRowsAfterT5.length} previousStatus=${newHistoryT5?.previousStatus} newStatus=${newHistoryT5?.newStatus} source=${newHistoryT5?.source}`,
    );
    const t5Pass = check(
      'TimedParkingSpaceInfo handles occupied-to-available transition',
      spaceAfterT5?.status === 'available' &&
        historyRowsAfterT5.length === historyBeforeT5 + 1,
      'transición inversa occupied→available registrada correctamente',
    );
    tps.t5 = {
      httpStatus: t5Res.status,
      spaceStatus: spaceAfterT5?.status,
      history: newHistoryT5
        ? {
            previousStatus: newHistoryT5.previousStatus,
            newStatus: newHistoryT5.newStatus,
            source: newHistoryT5.source,
          }
        : null,
      pass: t5Pass,
    };

    // --- T6: cantidad dinámica de plazas (50, sin límite hardcodeado) --------
    const bulkCount = 50;
    const t6Payload: TimedParkingSpaceInfoPayload = {
      DeviceID: config.deviceId,
      Time: formatSnapTime(new Date()),
      SpaceModeInfo: Array.from({ length: bulkCount }, (_, i) => ({
        ParkNo: `${SIM_TPS_BULK_PREFIX}${i + 1}`,
        SpaceType: 0,
        Used: i % 2 === 0,
      })),
    };

    const t6Res = await postEvent('TimedParkingSpaceInfo', t6Payload);
    const t6Ack = t6Res.body as { Result?: boolean } | null;

    const bulkMappings = await prisma.cameraStallMapping.findMany({
      where: {
        cameraId: camera.id,
        externalStallCode: { startsWith: SIM_TPS_BULK_PREFIX },
      },
    });
    const bulkSpacesAutoCreated = await prisma.parkingSpace.count({
      where: { code: { startsWith: SIM_TPS_BULK_PREFIX } },
    });

    check(
      'T6: HTTP 200 sin excepción con 50 plazas',
      t6Res.status === 200,
      `status=${t6Res.status}`,
    );
    check(
      'T6: ACK Result=true',
      t6Ack?.Result === true,
      `ack=${JSON.stringify(t6Ack)}`,
    );
    check(
      `T6: las ${bulkCount} plazas quedan DISCOVERED sin ParkingSpace`,
      bulkMappings.length === bulkCount &&
        bulkMappings.every(
          (m) => m.mappingStatus === 'DISCOVERED' && m.parkingSpaceId === null,
        ),
      `mappings creados=${bulkMappings.length}/${bulkCount}`,
    );
    check(
      'T6: no se crea ningún ParkingSpace automáticamente',
      bulkSpacesAutoCreated === 0,
      `ParkingSpace con prefijo bulk=${bulkSpacesAutoCreated}`,
    );
    const t6Pass = check(
      'TimedParkingSpaceInfo supports dynamic stall count',
      t6Res.status === 200 && bulkMappings.length === bulkCount,
      `procesó ${bulkCount} plazas en un solo request sin límite de 6/9 hardcodeado`,
    );
    tps.t6 = {
      httpStatus: t6Res.status,
      stallsSent: bulkCount,
      mappingsCreated: bulkMappings.length,
      pass: t6Pass,
    };

    // --- T7: ParkNo desconocido no rompe el resto del batch -------------------
    const t7Payload = withStallUsed(basePayload, 'C04', false, true);
    t7Payload.SpaceModeInfo.push({
      ParkNo: SIM_TPS_UNKNOWN_CODE,
      SpaceType: 0,
      Used: true,
    });
    const eventsBeforeT7 = eventsRowsAfterT5.length;

    const t7Res = await postEvent('TimedParkingSpaceInfo', t7Payload);
    const t7Ack = t7Res.body as { Result?: boolean } | null;

    const spaceAfterT7 = await prisma.parkingSpace.findUnique({
      where: { id: tpsSpace.id },
    });
    const eventsAfterT7 = await prisma.cameraEvent.count({
      where: { parkingSpaceId: tpsSpace.id },
    });
    const unknownMapping = await prisma.cameraStallMapping.findUnique({
      where: {
        cameraId_externalStallCode: {
          cameraId: camera.id,
          externalStallCode: SIM_TPS_UNKNOWN_CODE,
        },
      },
    });

    check(
      'T7: HTTP 200 (no tumba el batch)',
      t7Res.status === 200,
      `status=${t7Res.status}`,
    );
    check(
      'T7: ACK Result=true',
      t7Ack?.Result === true,
      `ack=${JSON.stringify(t7Ack)}`,
    );
    check(
      'T7: C04 sin cambio (mismo estado ya conocido) — el resto del batch se procesó',
      spaceAfterT7?.status === 'available' && eventsAfterT7 === eventsBeforeT7,
      `status=${spaceAfterT7?.status} eventCount=${eventsAfterT7}`,
    );
    check(
      'T7: ParkNo desconocido queda DISCOVERED sin ParkingSpace, sin CameraEvent de ocupación',
      unknownMapping?.mappingStatus === 'DISCOVERED' &&
        unknownMapping.parkingSpaceId === null,
      `mapping=${JSON.stringify(unknownMapping)}`,
    );
    const t7Pass = check(
      'TimedParkingSpaceInfo tolerates unknown stall',
      t7Res.status === 200 && unknownMapping?.mappingStatus === 'DISCOVERED',
      `${SIM_TPS_UNKNOWN_CODE} no rompió el resto del batch`,
    );
    tps.t7 = {
      httpStatus: t7Res.status,
      unknownStallMapped: false,
      pass: t7Pass,
    };

    // --- T8: item malformado (sin ParkNo) — tolerancia real del adapter ------
    const t8Payload = withStallUsed(basePayload, 'C04', false, true);
    t8Payload.SpaceModeInfo.push({ SpaceType: 0, Used: true });
    const eventsBeforeT8 = eventsAfterT7;

    const t8Res = await postEvent('TimedParkingSpaceInfo', t8Payload);
    const t8Ack = t8Res.body as { Result?: boolean } | null;

    const spaceAfterT8 = await prisma.parkingSpace.findUnique({
      where: { id: tpsSpace.id },
    });
    const eventsAfterT8 = await prisma.cameraEvent.count({
      where: { parkingSpaceId: tpsSpace.id },
    });

    check(
      'T8: HTTP 200 pese al item sin ParkNo (tolerado por el adapter, no rechaza el batch)',
      t8Res.status === 200,
      `status=${t8Res.status}`,
    );
    check(
      'T8: ACK Result=true',
      t8Ack?.Result === true,
      `ack=${JSON.stringify(t8Ack)}`,
    );
    check(
      'T8: C04 y el resto del batch procesan normalmente pese al item malformado',
      spaceAfterT8?.status === 'available' && eventsAfterT8 === eventsBeforeT8,
      `status=${spaceAfterT8?.status} eventCount=${eventsAfterT8}`,
    );
    const t8Pass = check(
      'TimedParkingSpaceInfo tolerates malformed SpaceModeInfo item',
      t8Res.status === 200,
      'item sin ParkNo descartado silenciosamente por normalize(), según el contrato ya implementado — no se inventó una expectativa distinta',
    );
    tps.t8 = { httpStatus: t8Res.status, pass: t8Pass };

    // --- T9: evidencia Base64 grande — aceptada y nunca expuesta -------------
    const largeBase64 = 'A'.repeat(600 * 1024); // ~600KB, orden de magnitud real observado
    const t9Payload = withStallUsed(basePayload, 'C04', false, true);
    t9Payload.ParkingSpacePic = {
      Content: largeBase64,
      PicName: 'sim-evidence.jpg',
    };

    const t9Res = await postEvent('TimedParkingSpaceInfo', t9Payload);
    const t9Ack = t9Res.body as { Result?: boolean } | null;

    check(
      'T9: HTTP 200 con payload de evidencia grande (no falla por body limit)',
      t9Res.status === 200,
      `status=${t9Res.status} contentLength≈${largeBase64.length} bytes`,
    );
    check(
      'T9: ACK Result=true',
      t9Ack?.Result === true,
      `ack=${JSON.stringify(t9Ack)}`,
    );
    const t9Pass = check(
      'TimedParkingSpaceInfo accepts evidence payload safely',
      t9Res.status === 200,
      // Deliberado: nunca se imprime largeBase64 ni t9Res.body completo con
      // el Content — solo su longitud, igual que CameraGatewayLogger.summarizeBase64.
      `evidencia de ~${Math.round(largeBase64.length / 1024)}KB aceptada, Content nunca impreso en este reporte`,
    );
    tps.t9 = {
      httpStatus: t9Res.status,
      base64LengthBytes: largeBase64.length,
      pass: t9Pass,
    };
  } finally {
    await cleanupTpsFixture(camera, tpsSpace.id);
    const spaceStillExists = await prisma.parkingSpace.findUnique({
      where: { id: tpsSpace.id },
    });
    const leftoverMappings = await prisma.cameraStallMapping.count({
      where: {
        cameraId: camera.id,
        OR: [
          { externalStallCode: { in: SIM_TPS_STALL_CODES } },
          { externalStallCode: SIM_TPS_UNKNOWN_CODE },
          { externalStallCode: { startsWith: SIM_TPS_BULK_PREFIX } },
        ],
      },
    });
    check(
      'TimedParkingSpaceInfo cleanup leaves no simulator-owned rows behind',
      spaceStillExists === null && leftoverMappings === 0,
      `ParkingSpace eliminado=${spaceStillExists === null} mappings restantes=${leftoverMappings}`,
    );
    tps.cleanup = {
      parkingSpaceDeleted: spaceStillExists === null,
      leftoverMappings,
    };
  }
}

// ---------------------------------------------------------------------------
// Flujo principal
// ---------------------------------------------------------------------------

async function main() {
  const executionId = randomUUID();
  const startedAt = new Date();

  console.log('=== Fase 0.9 — Simulador Dahua ===');
  console.log(
    `executionId=${executionId} baseUrl=${config.baseUrl} autoApprove=${config.autoApprove}`,
  );

  const report: Record<string, unknown> = {
    executionId,
    startedAt: startedAt.toISOString(),
    finishedAt: null,
    durationMs: null,
    camera: {},
    deviceInfo: {},
    keepAlive: {},
    parkingOccupied: {},
    parkingDuplicate: {},
    parkingFree: {},
    parkingIllegal: {},
    parkingInvalidDevice: {},
    database: {},
    history: [],
    timedParkingSpaceInfo: {},
    logs: {},
    result: {},
  };

  // --- Preflight -------------------------------------------------------------
  let health: Response;
  try {
    health = await fetch(`${config.baseUrl}/api/v1/health`);
  } catch (err) {
    console.error(
      `No se pudo contactar ${config.baseUrl}/api/v1/health. ` +
        '¿Está el servidor corriendo (npm run start:dev)?',
    );
    throw err;
  }
  check(
    'Preflight: servidor accesible',
    health.ok,
    `GET /api/v1/health → ${health.status}`,
  );

  const fingerprintBefore = await fingerprint();

  // --- 1. DeviceInfo -----------------------------------------------------
  const deviceInfoPayload = loadPayload<DeviceInfoPayload>('DeviceInfo.json');
  deviceInfoPayload.DeviceID = config.deviceId;
  const deviceInfoRes = await postEvent('DeviceInfo', deviceInfoPayload);

  const dahuaProvider = await prisma.cameraProvider.findUnique({
    where: { code: config.providerCode },
  });
  const cameraAfterDeviceInfo = dahuaProvider
    ? await prisma.camera.findUnique({
        where: {
          providerId_deviceId: {
            providerId: dahuaProvider.id,
            deviceId: config.deviceId,
          },
        },
      })
    : null;

  check(
    'DeviceInfo → 200',
    deviceInfoRes.status === 200,
    `status=${deviceInfoRes.status}`,
  );
  check(
    'DeviceInfo → Camera creada',
    cameraAfterDeviceInfo !== null,
    cameraAfterDeviceInfo
      ? `id=${cameraAfterDeviceInfo.id} registrationStatus=${cameraAfterDeviceInfo.registrationStatus}`
      : 'no se encontró la cámara',
  );

  report.deviceInfo = {
    httpStatus: deviceInfoRes.status,
    ok: deviceInfoRes.ok,
    cameraId: cameraAfterDeviceInfo?.id ?? null,
    registrationStatus: cameraAfterDeviceInfo?.registrationStatus ?? null,
  };

  if (!cameraAfterDeviceInfo) {
    await writeReportAndExit(report, startedAt, 1);
  }

  // --- Paso 0: aprobación de cámara (SQL directo, fuera de los endpoints) ---
  let cameraApproved = cameraAfterDeviceInfo!;

  if (config.autoApprove) {
    const tenant = await prisma.tenant.findUnique({
      where: { code: config.tenantCode },
    });
    if (!tenant) {
      throw new Error(
        `Tenant con code='${config.tenantCode}' no existe — corré el seed primero.`,
      );
    }
    const city = await prisma.city.findUnique({
      where: { tenantId_code: { tenantId: tenant.id, code: config.cityCode } },
    });
    if (!city) {
      throw new Error(
        `City con code='${config.cityCode}' no existe en el tenant.`,
      );
    }
    const zone = await prisma.parkingZone.findUnique({
      where: { cityId_code: { cityId: city.id, code: config.zoneCode } },
    });
    if (!zone) {
      throw new Error(
        `ParkingZone con code='${config.zoneCode}' no existe en la ciudad.`,
      );
    }

    cameraApproved = await prisma.camera.update({
      where: { id: cameraAfterDeviceInfo!.id },
      data: {
        tenantId: tenant.id,
        cityId: city.id,
        zoneId: zone.id,
        registrationStatus: 'active',
      },
    });

    check(
      'Paso 0 → Camera aprobada (SQL directo, DAHUA_SIM_AUTO_APPROVE=true)',
      cameraApproved.registrationStatus === 'active' &&
        cameraApproved.zoneId === zone.id,
      `tenantId=${tenant.id} cityId=${city.id} zoneId=${zone.id}`,
    );
  } else {
    const isApproved =
      cameraAfterDeviceInfo!.registrationStatus === 'active' &&
      !!cameraAfterDeviceInfo!.tenantId &&
      !!cameraAfterDeviceInfo!.cityId &&
      !!cameraAfterDeviceInfo!.zoneId;

    const approvedOk = check(
      'Paso 0 → Camera ya aprobada (DAHUA_SIM_AUTO_APPROVE=false)',
      isApproved,
      isApproved
        ? 'registrationStatus=active, tenant/city/zone asignados'
        : 'la cámara NO está aprobada y DAHUA_SIM_AUTO_APPROVE=false',
    );

    if (!approvedOk) {
      console.error(
        '\nDAHUA_SIM_AUTO_APPROVE=false y la cámara no está aprobada. ' +
          'Aprobala manualmente (ver DAHUA_TESTING_CHECKLIST.md §1) o ' +
          'corré con DAHUA_SIM_AUTO_APPROVE=true.',
      );
      await writeReportAndExit(report, startedAt, 1);
    }
  }

  report.camera = {
    deviceId: config.deviceId,
    approved: true,
    autoApprove: config.autoApprove,
    tenantId: cameraApproved.tenantId,
    cityId: cameraApproved.cityId,
    zoneId: cameraApproved.zoneId,
    registrationStatus: cameraApproved.registrationStatus,
  };

  // --- 2. KeepAlive --------------------------------------------------------
  const lastSeenBefore = cameraApproved.lastSeenAt;
  const keepAlivePayload = loadPayload<DeviceInfoPayload>('KeepAlive.json');
  keepAlivePayload.DeviceID = config.deviceId;
  const keepAliveRes = await postEvent('KeepAlive', keepAlivePayload);
  const cameraAfterKeepAlive = await prisma.camera.findUnique({
    where: { id: cameraApproved.id },
  });

  check(
    'KeepAlive → 200',
    keepAliveRes.status === 200,
    `status=${keepAliveRes.status}`,
  );
  check(
    'KeepAlive → lastSeenAt avanzó',
    !!cameraAfterKeepAlive?.lastSeenAt &&
      (!lastSeenBefore || cameraAfterKeepAlive.lastSeenAt > lastSeenBefore),
    `lastSeenAt=${cameraAfterKeepAlive?.lastSeenAt?.toISOString() ?? 'null'}`,
  );

  report.keepAlive = {
    httpStatus: keepAliveRes.status,
    ok: keepAliveRes.ok,
    lastSeenAtBefore: lastSeenBefore?.toISOString() ?? null,
    lastSeenAtAfter: cameraAfterKeepAlive?.lastSeenAt?.toISOString() ?? null,
    status: cameraAfterKeepAlive?.status ?? null,
  };

  // --- Resolver el ParkingSpace de referencia -------------------------------
  const spaceBefore = await prisma.parkingSpace.findFirst({
    where: { zoneId: cameraApproved.zoneId!, code: config.parkingSpaceCode },
  });
  if (!spaceBefore) {
    throw new Error(
      `ParkingSpace code='${config.parkingSpaceCode}' no existe en la zona aprobada — corré el seed primero.`,
    );
  }

  // --- 3. ParkingInfo Occupied ----------------------------------------------
  const occupiedPayload = injectSnapTime(
    loadPayload<ParkingInfoPayload>('ParkingInfo_Occupied.json'),
  );
  occupiedPayload.Picture.ParkingInfo.DeviceID = config.deviceId;
  occupiedPayload.Picture.ParkingInfo.ParkingStallsNo = config.parkingSpaceCode;

  const eventCountBeforeOccupied = await prisma.cameraEvent.count();
  const historyCountBeforeOccupied =
    await prisma.parkingSpaceStatusHistory.count();

  const occupiedRes = await postEvent('ParkingInfo', occupiedPayload);

  const spaceAfterOccupied = await prisma.parkingSpace.findUnique({
    where: { id: spaceBefore.id },
  });
  const eventCountAfterOccupied = await prisma.cameraEvent.count();
  const historyCountAfterOccupied =
    await prisma.parkingSpaceStatusHistory.count();

  check(
    'ParkingInfo Occupied → 200',
    occupiedRes.status === 200,
    `status=${occupiedRes.status}`,
  );
  check(
    'ParkingInfo Occupied → ParkingSpace pasa a occupied',
    spaceAfterOccupied?.status === 'occupied',
    `antes=${spaceBefore.status} después=${spaceAfterOccupied?.status}`,
  );
  check(
    'ParkingInfo Occupied → 1 CameraEvent nuevo',
    eventCountAfterOccupied === eventCountBeforeOccupied + 1,
    `antes=${eventCountBeforeOccupied} después=${eventCountAfterOccupied}`,
  );
  check(
    'ParkingInfo Occupied → 1 fila de historial nueva',
    historyCountAfterOccupied === historyCountBeforeOccupied + 1,
    `antes=${historyCountBeforeOccupied} después=${historyCountAfterOccupied}`,
  );

  report.parkingOccupied = {
    httpStatus: occupiedRes.status,
    ok: occupiedRes.ok,
    snapTime: occupiedPayload.Picture.ParkingInfo.SnapTime,
    spaceStatusBefore: spaceBefore.status,
    spaceStatusAfter: spaceAfterOccupied?.status ?? null,
    cameraEventCreated:
      eventCountAfterOccupied === eventCountBeforeOccupied + 1,
    historyRowCreated:
      historyCountAfterOccupied === historyCountBeforeOccupied + 1,
  };

  // --- 4. ParkingInfo Duplicate — mismo objeto en memoria, no se relee de disco
  const duplicateRes = await postEvent('ParkingInfo', occupiedPayload);

  const eventCountAfterDup = await prisma.cameraEvent.count();
  const historyCountAfterDup = await prisma.parkingSpaceStatusHistory.count();
  const spaceAfterDup = await prisma.parkingSpace.findUnique({
    where: { id: spaceBefore.id },
  });

  check(
    'ParkingInfo Duplicate → 200',
    duplicateRes.status === 200,
    `status=${duplicateRes.status}`,
  );
  check(
    'ParkingInfo Duplicate → 0 CameraEvent nuevos (idempotencia)',
    eventCountAfterDup === eventCountAfterOccupied,
    `antes=${eventCountAfterOccupied} después=${eventCountAfterDup}`,
  );
  check(
    'ParkingInfo Duplicate → 0 filas de historial nuevas',
    historyCountAfterDup === historyCountAfterOccupied,
    `antes=${historyCountAfterOccupied} después=${historyCountAfterDup}`,
  );
  check(
    'ParkingInfo Duplicate → ParkingSpace no cambia',
    spaceAfterDup?.status === spaceAfterOccupied?.status,
    `status=${spaceAfterDup?.status}`,
  );

  report.parkingDuplicate = {
    httpStatus: duplicateRes.status,
    ok: duplicateRes.ok,
    reusedInMemoryPayloadFrom: 'parkingOccupied',
    newCameraEventCreated: eventCountAfterDup !== eventCountAfterOccupied,
    newHistoryRowCreated: historyCountAfterDup !== historyCountAfterOccupied,
  };

  // --- 5. ParkingInfo Free ---------------------------------------------------
  const freePayload = injectSnapTime(
    loadPayload<ParkingInfoPayload>('ParkingInfo_Free.json'),
  );
  freePayload.Picture.ParkingInfo.DeviceID = config.deviceId;
  freePayload.Picture.ParkingInfo.ParkingStallsNo = config.parkingSpaceCode;

  const freeRes = await postEvent('ParkingInfo', freePayload);

  const spaceAfterFree = await prisma.parkingSpace.findUnique({
    where: { id: spaceBefore.id },
  });
  const eventCountAfterFree = await prisma.cameraEvent.count();
  const historyCountAfterFree = await prisma.parkingSpaceStatusHistory.count();

  check(
    'ParkingInfo Free → 200',
    freeRes.status === 200,
    `status=${freeRes.status}`,
  );
  check(
    'ParkingInfo Free → ParkingSpace vuelve a available',
    spaceAfterFree?.status === 'available',
    `status=${spaceAfterFree?.status}`,
  );
  check(
    'ParkingInfo Free → 1 CameraEvent nuevo',
    eventCountAfterFree === eventCountAfterDup + 1,
    `antes=${eventCountAfterDup} después=${eventCountAfterFree}`,
  );
  check(
    'ParkingInfo Free → 1 fila de historial nueva',
    historyCountAfterFree === historyCountAfterDup + 1,
    `antes=${historyCountAfterDup} después=${historyCountAfterFree}`,
  );

  report.parkingFree = {
    httpStatus: freeRes.status,
    ok: freeRes.ok,
    snapTime: freePayload.Picture.ParkingInfo.SnapTime,
    spaceStatusBefore: spaceAfterOccupied?.status ?? null,
    spaceStatusAfter: spaceAfterFree?.status ?? null,
    cameraEventCreated: eventCountAfterFree === eventCountAfterDup + 1,
    historyRowCreated: historyCountAfterFree === historyCountAfterDup + 1,
  };

  // --- 6. ParkingInfo Illegal -------------------------------------------------
  const illegalPayload = injectSnapTime(
    loadPayload<ParkingInfoPayload>('ParkingInfo_Illegal.json'),
  );
  illegalPayload.Picture.ParkingInfo.DeviceID = config.deviceId;

  const illegalRes = await postEvent('ParkingInfo', illegalPayload);

  const spaceAfterIllegal = await prisma.parkingSpace.findUnique({
    where: { id: spaceBefore.id },
  });
  const illegalEvent = await prisma.cameraEvent.findFirst({
    where: { cameraId: cameraApproved.id, detectionScope: 'AREA_ILEGAL' },
    orderBy: { createdAt: 'desc' },
  });

  check(
    'ParkingInfo Illegal → 200',
    illegalRes.status === 200,
    `status=${illegalRes.status}`,
  );
  check(
    'ParkingInfo Illegal → CameraEvent AREA_ILEGAL creado',
    illegalEvent !== null,
    illegalEvent ? `id=${illegalEvent.id}` : 'no encontrado',
  );
  check(
    'ParkingInfo Illegal → parkingSpaceId es null',
    illegalEvent?.parkingSpaceId === null,
    `parkingSpaceId=${illegalEvent?.parkingSpaceId ?? 'null'}`,
  );
  check(
    'ParkingInfo Illegal → ParkingSpace sin cambios',
    spaceAfterIllegal?.status === spaceAfterFree?.status,
    `status=${spaceAfterIllegal?.status}`,
  );

  report.parkingIllegal = {
    httpStatus: illegalRes.status,
    ok: illegalRes.ok,
    detectRegionName: illegalPayload.Picture.ParkingInfo.DetectRegionName,
    cameraEventCreated: illegalEvent !== null,
    parkingSpaceUntouched: spaceAfterIllegal?.status === spaceAfterFree?.status,
  };

  // --- 7. ParkingInfo InvalidDevice -------------------------------------------
  const invalidPayload = injectSnapTime(
    loadPayload<ParkingInfoPayload>('ParkingInfo_InvalidDevice.json'),
  );
  invalidPayload.Picture.ParkingInfo.DeviceID = config.unknownDeviceId;

  const cameraCountBeforeInvalid = await prisma.camera.count();

  const invalidRes = await postEvent('ParkingInfo', invalidPayload);

  const cameraCountAfterInvalid = await prisma.camera.count();
  const rawInvalid = await prisma.cameraEventRaw.findFirst({
    where: { deviceIdRaw: config.unknownDeviceId },
    orderBy: { receivedAt: 'desc' },
  });

  check(
    'ParkingInfo InvalidDevice → 200',
    invalidRes.status === 200,
    `status=${invalidRes.status}`,
  );
  check(
    'ParkingInfo InvalidDevice → 0 Camera nuevas',
    cameraCountAfterInvalid === cameraCountBeforeInvalid,
    `antes=${cameraCountBeforeInvalid} después=${cameraCountAfterInvalid}`,
  );
  check(
    'ParkingInfo InvalidDevice → RAW marcado FAILED',
    rawInvalid?.processingStatus === 'FAILED',
    `processingStatus=${rawInvalid?.processingStatus ?? 'no encontrado'}`,
  );

  report.parkingInvalidDevice = {
    httpStatus: invalidRes.status,
    ok: invalidRes.ok,
    discarded: cameraCountAfterInvalid === cameraCountBeforeInvalid,
    rawProcessingStatus: rawInvalid?.processingStatus ?? null,
  };

  // --- Base de datos: fingerprint final + AuditLogs + historial completo ----
  const fingerprintAfter = await fingerprint();

  check(
    'AuditLogs sin cambios (sin endpoints admin todavía)',
    fingerprintAfter.auditLogs === fingerprintBefore.auditLogs,
    `antes=${fingerprintBefore.auditLogs} después=${fingerprintAfter.auditLogs}`,
  );
  check(
    'CameraEventRaw: 7 filas nuevas (una por request)',
    fingerprintAfter.cameraEventsRaw === fingerprintBefore.cameraEventsRaw + 7,
    `antes=${fingerprintBefore.cameraEventsRaw} después=${fingerprintAfter.cameraEventsRaw}`,
  );
  check(
    'CameraEvent: 3 filas nuevas (Occupied, Free, Illegal)',
    fingerprintAfter.cameraEvents === fingerprintBefore.cameraEvents + 3,
    `antes=${fingerprintBefore.cameraEvents} después=${fingerprintAfter.cameraEvents}`,
  );
  check(
    'ParkingSpaceStatusHistory: 2 filas nuevas',
    fingerprintAfter.parkingSpaceStatusHistory ===
      fingerprintBefore.parkingSpaceStatusHistory + 2,
    `antes=${fingerprintBefore.parkingSpaceStatusHistory} después=${fingerprintAfter.parkingSpaceStatusHistory}`,
  );
  check(
    'Tablas no relacionadas con cámaras sin cambios',
    fingerprintAfter.tenants === fingerprintBefore.tenants &&
      fingerprintAfter.cities === fingerprintBefore.cities &&
      fingerprintAfter.users === fingerprintBefore.users &&
      fingerprintAfter.parkingSpaces === fingerprintBefore.parkingSpaces,
    'tenants/cities/users/parkingSpaces sin drift',
  );

  report.database = { fingerprintBefore, fingerprintAfter };

  const historyRows = await prisma.parkingSpaceStatusHistory.findMany({
    where: { spaceId: spaceBefore.id },
    orderBy: { changedAt: 'asc' },
  });
  report.history = historyRows.map((h) => ({
    previousStatus: h.previousStatus,
    newStatus: h.newStatus,
    source: h.source,
    sourceEventId: h.sourceEventId,
    changedAt: h.changedAt.toISOString(),
  }));

  // --- Logs --------------------------------------------------------------
  if (config.serverLogPath) {
    if (!fs.existsSync(config.serverLogPath)) {
      manualCheck(
        'Logs: archivo no encontrado',
        `DAHUA_SIM_SERVER_LOG=${config.serverLogPath} no existe`,
      );
      report.logs = {
        mode: 'manual',
        checked: false,
        path: config.serverLogPath,
      };
    } else {
      const content = fs.readFileSync(config.serverLogPath, 'utf-8');
      const forbidden: string[] = [];
      if (/authorization/i.test(content)) forbidden.push('Authorization');
      if (/bearer\s+\S+/i.test(content)) forbidden.push('Bearer token');
      if (/[A-Za-z0-9+/]{200,}={0,2}/.test(content))
        forbidden.push('posible Base64 largo');

      check(
        'Logs: sin Authorization/Bearer/Base64 expuestos',
        forbidden.length === 0,
        forbidden.length === 0
          ? 'sin coincidencias'
          : `encontrado: ${forbidden.join(', ')}`,
      );
      report.logs = {
        mode: 'automated',
        checked: true,
        path: config.serverLogPath,
        forbiddenPatternsFound: forbidden,
      };
    }
  } else {
    manualCheck(
      'Logs: revisión manual pendiente',
      'DAHUA_SIM_SERVER_LOG no provisto — revisar a ojo la salida de npm run start:dev',
    );
    report.logs = { mode: 'manual', checked: false, path: null };
  }

  // Corre después de que los fingerprints/checks originales de
  // DeviceInfo/KeepAlive/ParkingInfo ya se calcularon — no altera esos
  // deltas. Auto-contenida: prepara y limpia sus propios datos, nunca
  // depende de C01-C09/CENTRO-008 dejados por una prueba manual anterior.
  await runTimedParkingSpaceInfoTests(
    {
      id: cameraApproved.id,
      tenantId: cameraApproved.tenantId!,
      cityId: cameraApproved.cityId!,
      zoneId: cameraApproved.zoneId!,
    },
    report,
  );

  await writeReportAndExit(report, startedAt);
}

void main().catch(async (err) => {
  console.error('\nSimulación abortada por error inesperado:');
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
