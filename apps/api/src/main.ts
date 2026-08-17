import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import type { NextFunction, Request, Response } from 'express';
import * as fs from 'fs';
import { AppModule } from './app.module';

/**
 * Opt-in, transport-level HTTP traffic capture — never touches
 * DahuaProviderAdapter/DTOs/normalizer/CameraIngestionCoreService. Off
 * unless DAHUA_TRAFFIC_CAPTURE_LOG is set (temporary field-debugging tool,
 * not meant to run permanently in production). Runs before Nest routing,
 * so it also sees requests to routes that don't exist (404s) — something
 * CameraEventRaw can never show, since that table is only ever written by
 * the 3 known Dahua controller routes.
 */
function summarizeRequestBody(body: unknown): Record<string, unknown> | null {
  if (!body || typeof body !== 'object') {
    return null;
  }
  const record = body as Record<string, unknown>;
  const picture = record.Picture as Record<string, unknown> | undefined;
  const parkingInfo = picture?.ParkingInfo as
    | Record<string, unknown>
    | undefined;

  const summary: Record<string, unknown> = {
    topLevelKeys: Object.keys(record),
  };
  if (typeof record.DeviceID === 'string') summary.deviceId = record.DeviceID;
  if (parkingInfo) {
    summary.deviceId = parkingInfo.DeviceID ?? summary.deviceId;
    summary.parkingStallsNo = parkingInfo.ParkingStallsNo ?? null;
    summary.parkingStatus = parkingInfo.ParkingStatus ?? null;
  }
  if (Array.isArray(record.SpaceModeInfo)) {
    summary.spaceModeInfoCount = record.SpaceModeInfo.length;
  }
  // TimedParkingSpaceInfo carries its Base64 snapshot at the root
  // (ParkingSpacePic), not nested under Picture like ParkingInfo's —
  // summarized the same way: length only, never the content itself.
  const rootPic = record.ParkingSpacePic as Record<string, unknown> | undefined;
  if (rootPic && typeof rootPic === 'object') {
    summary.parkingSpacePic = {
      PicName: rootPic.PicName ?? null,
      base64Length:
        typeof rootPic.Content === 'string' ? rootPic.Content.length : 0,
    };
  }
  if (picture) {
    for (const [key, value] of Object.entries(picture)) {
      if (
        value &&
        typeof value === 'object' &&
        'Content' in (value as Record<string, unknown>)
      ) {
        const block = value as Record<string, unknown>;
        summary[`${key}Image`] = {
          PicName: block.PicName ?? null,
          Width: block.Width ?? null,
          Height: block.Height ?? null,
          base64Length:
            typeof block.Content === 'string' ? block.Content.length : 0,
        };
      }
    }
  }
  return summary;
}

function installTrafficCapture(app: import('@nestjs/common').INestApplication) {
  const logPath = process.env.DAHUA_TRAFFIC_CAPTURE_LOG;
  if (!logPath) {
    return;
  }
  const watchedIps = (process.env.DAHUA_TRAFFIC_CAPTURE_IPS ?? '')
    .split(',')
    .map((ip) => ip.trim())
    .filter(Boolean);

  app.use((req: Request, res: Response, next: NextFunction) => {
    const startedAt = Date.now();
    const forwardedFor = (req.headers['x-forwarded-for'] as string | undefined)
      ?.split(',')[0]
      ?.trim();
    const clientIp = forwardedFor ?? req.socket.remoteAddress ?? 'unknown';
    const isDahuaRoute = req.originalUrl.startsWith('/integrations/dahua');
    const isWatchedIp =
      watchedIps.length === 0 || watchedIps.some((ip) => clientIp.includes(ip));

    if (!isDahuaRoute && !isWatchedIp) {
      next();
      return;
    }

    res.on('finish', () => {
      const entry = {
        ts: new Date().toISOString(),
        ip: clientIp,
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        latencyMs: Date.now() - startedAt,
        contentType: req.headers['content-type'] ?? null,
        contentLength: req.headers['content-length'] ?? null,
        userAgent: req.headers['user-agent'] ?? null,
        body: summarizeRequestBody(req.body),
      };
      fs.appendFile(logPath, JSON.stringify(entry) + '\n', () => {});
    });
    next();
  });
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Dahua ITC413-PW4D-IZ1 ParkingInfo payloads carry Picture.NormalPic.Content
  // (Base64 snapshot), observed at ~780KB in real traffic capture — well
  // over Express/Nest's implicit 100kb default, which was rejecting every
  // real ParkingInfo with 413 before it ever reached the controller. 5mb
  // covers the observed payload with headroom, deliberately not unbounded.
  app.use(json({ limit: '5mb' }));
  app.use(urlencoded({ limit: '5mb', extended: true }));

  installTrafficCapture(app);

  // Dahua ITSAPI ingestion routes stay outside /api/v1: the camera firmware
  // only lets you configure a base server URL, and appends fixed ITSAPI
  // suffixes (/NotificationInfo/...) that are not versionable like the rest
  // of the administrative API — see DAHUA_IMPLEMENTATION_PLAN.md §0/§1.
  app.setGlobalPrefix('api/v1', {
    exclude: [{ path: 'integrations/dahua/(.*)', method: RequestMethod.ALL }],
  });

  const configuredOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const defaultDevOrigins = ['http://localhost:5173', 'http://localhost:3000'];
  const corsOrigins =
    configuredOrigins.length > 0 ? configuredOrigins : defaultDevOrigins;

  if (configuredOrigins.length === 0) {
    console.warn(
      'CORS_ORIGINS is not set. Falling back to local dev origins ' +
        `(${defaultDevOrigins.join(', ')}). Set CORS_ORIGINS in any ` +
        'deployed environment (comma-separated) or requests from the real ' +
        'frontend origin will be rejected.',
    );
  }

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Smart City Parking API')
    .setDescription('Enterprise multi-tenant Smart City Parking platform API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  console.log(`API running on http://localhost:${port}/api/v1`);
  console.log(`Swagger running on http://localhost:${port}/docs`);
}

bootstrap();
