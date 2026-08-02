import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

const DRY_RUN = process.argv.includes('--dry-run');

/**
 * Domain command — backfills Camera.providerId/gatewayId for cameras that
 * predate the multi-provider model (providerId still NULL). Assigns them
 * to DAHUA_ITSAPI, the only provider that could have created them. Every
 * change is audited via AuditLog. Idempotent: re-running after a
 * successful backfill finds zero orphan cameras and does nothing.
 *
 * Usage:
 *   npm run camera:backfill-provider -- --dry-run   # preview only
 *   npm run camera:backfill-provider                # apply
 */
async function main() {
  const provider = await prisma.cameraProvider.findUnique({
    where: { code: 'DAHUA_ITSAPI' },
  });

  if (!provider) {
    console.error(
      'CameraProvider DAHUA_ITSAPI no existe todavía. Ejecuta `npm run seed` primero.',
    );
    process.exit(1);
  }

  const activeGateways = await prisma.cameraGateway.findMany({
    where: { providerId: provider.id, active: true },
  });

  // Same "exactly one active gateway" rule as camera auto-registration in
  // CameraIngestionCoreService — never guess when ambiguous.
  const gatewayId = activeGateways.length === 1 ? activeGateways[0].id : null;
  if (activeGateways.length !== 1) {
    console.warn(
      `Advertencia: ${activeGateways.length} gateway(s) activo(s) para DAHUA_ITSAPI — gatewayId quedará NULL para las cámaras backfilleadas.`,
    );
  }

  const orphanCameras = await prisma.camera.findMany({
    where: { providerId: null },
    select: {
      id: true,
      deviceId: true,
      tenantId: true,
      providerId: true,
      gatewayId: true,
    },
  });

  console.log('\n=== camera:backfill-provider ===');
  console.log(`Provider destino: ${provider.code} (${provider.id})`);
  console.log(
    `Gateway destino: ${gatewayId ?? '(ninguno — ambiguo o ausente)'}`,
  );
  console.log(`Cámaras con providerId NULL: ${orphanCameras.length}`);
  for (const cam of orphanCameras) {
    console.log(
      `  - ${cam.deviceId} (${cam.id}): providerId NULL → ${provider.id}, gatewayId ${cam.gatewayId ?? 'NULL'} → ${gatewayId ?? 'NULL'}`,
    );
  }

  if (orphanCameras.length === 0) {
    console.log(
      '\nNada que hacer — todas las cámaras ya tienen providerId asignado.',
    );
    return;
  }

  if (DRY_RUN) {
    console.log('\n--dry-run: ningún cambio fue aplicado.');
    return;
  }

  for (const cam of orphanCameras) {
    await prisma.$transaction([
      prisma.camera.update({
        where: { id: cam.id },
        data: { providerId: provider.id, gatewayId },
      }),
      prisma.auditLog.create({
        data: {
          tenantId: cam.tenantId,
          action: 'CAMERA_BACKFILL_PROVIDER',
          entity: 'Camera',
          entityId: cam.id,
          beforeData: { providerId: cam.providerId, gatewayId: cam.gatewayId },
          afterData: { providerId: provider.id, gatewayId },
        },
      }),
    ]);
  }

  console.log(
    `\n${orphanCameras.length} cámara(s) actualizada(s) y auditada(s) en AuditLog.`,
  );
}

main()
  .catch((e) => {
    console.error('camera:backfill-provider failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
