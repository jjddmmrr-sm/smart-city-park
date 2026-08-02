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

  const cameraAfterDeviceInfo = await prisma.camera.findUnique({
    where: { deviceId: config.deviceId },
  });

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

  await writeReportAndExit(report, startedAt);
}

void main().catch(async (err) => {
  console.error('\nSimulación abortada por error inesperado:');
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
