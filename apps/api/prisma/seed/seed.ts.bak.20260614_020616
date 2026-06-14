import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Creating or updating initial tenant...');

  const tenant = await prisma.tenant.upsert({
    where: { code: 'MUNI_DEMO' },
    update: {
      name: 'Municipality Demo',
      status: 'active',
    },
    create: {
      name: 'Municipality Demo',
      code: 'MUNI_DEMO',
      status: 'active',
    },
  });

  const city = await prisma.city.upsert({
    where: {
      tenantId_code: {
        tenantId: tenant.id,
        code: 'SMART_CITY',
      },
    },
    update: {
      name: 'Smart City Demo',
      status: 'active',
    },
    create: {
      tenantId: tenant.id,
      name: 'Smart City Demo',
      code: 'SMART_CITY',
      status: 'active',
    },
  });

  const role = await prisma.role.upsert({
    where: { code: 'SUPER_ADMIN' },
    update: {
      name: 'Super Administrator',
      description: 'Full platform access',
    },
    create: {
      name: 'Super Administrator',
      code: 'SUPER_ADMIN',
      description: 'Full platform access',
    },
  });

  const password = await bcrypt.hash('Admin12345', 10);

  const user = await prisma.user.upsert({
    where: { email: 'admin@smartparking.com' },
    update: {
      tenantId: tenant.id,
      cityId: city.id,
      name: 'Platform Administrator',
      password,
      status: 'active',
    },
    create: {
      tenantId: tenant.id,
      cityId: city.id,
      email: 'admin@smartparking.com',
      name: 'Platform Administrator',
      password,
      status: 'active',
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: user.id,
        roleId: role.id,
      },
    },
    update: {},
    create: {
      userId: user.id,
      roleId: role.id,
    },
  });


  console.log('Creating payment methods...');

  await prisma.paymentMethod.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'APP' } },
    update: {},
    create: {
      tenantId: tenant.id,
      code: 'APP',
      name: 'Aplicación Móvil',
    },
  });

  await prisma.paymentMethod.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'CARD' } },
    update: {},
    create: {
      tenantId: tenant.id,
      code: 'CARD',
      name: 'Tarjeta',
    },
  });

  console.log('Creating fine types...');

  await prisma.fineType.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'NO_PAYMENT' } },
    update: {},
    create: {
      tenantId: tenant.id,
      code: 'NO_PAYMENT',
      name: 'Sin Pago',
      amount: 20,
    },
  });

  await prisma.fineType.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'OVERSTAY' } },
    update: {},
    create: {
      tenantId: tenant.id,
      code: 'OVERSTAY',
      name: 'Exceso de Tiempo',
      amount: 15,
    },
  });

  console.log('Creating inspector...');

  await prisma.inspector.create({
    data: {
      tenantId: tenant.id,
      cityId: city.id,
      name: 'Carlos Mendoza',
      email: 'carlos@smartparking.com',
      phone: '0999999999',
      shift: 'mixto',
      status: 'active',
    },
  }).catch(() => {});

  console.log('Creating camera...');

  await prisma.camera.create({
    data: {
      tenantId: tenant.id,
      cityId: city.id,
      code: 'CAM-001',
      name: 'Cámara Centro',
      location: 'Parque Central',
      status: 'active',
    },
  }).catch(() => {});


  console.log('Creating demo payment, fine and enforcement data...');

  const appMethod = await prisma.paymentMethod.findFirst({
    where: { tenantId: tenant.id, code: 'APP' },
  });

  const fineType = await prisma.fineType.findFirst({
    where: { tenantId: tenant.id, code: 'NO_PAYMENT' },
  });

  const inspector = await prisma.inspector.findFirst({
    where: { tenantId: tenant.id },
  });

  const vehicle = await prisma.vehicle.findFirst({
    where: { tenantId: tenant.id },
  });

  const session = await prisma.parkingSession.findFirst({
    where: { tenantId: tenant.id },
    orderBy: { createdAt: 'desc' },
  });

  if (appMethod && session) {
    await prisma.payment.create({
      data: {
        tenantId: tenant.id,
        cityId: city.id,
        sessionId: session.id,
        paymentMethodId: appMethod.id,
        amount: session.amount || 0.45,
        currency: 'USD',
        status: 'paid',
        reference: 'DEMO-PAY-001',
      },
    }).catch(() => {});
  }

  if (fineType) {
    await prisma.fine.create({
      data: {
        tenantId: tenant.id,
        cityId: city.id,
        sessionId: session?.id,
        vehicleId: vehicle?.id,
        inspectorId: inspector?.id,
        fineTypeId: fineType.id,
        plateNumber: vehicle?.plateNumber ?? 'ABC1234',
        amount: fineType.amount,
        status: 'pending',
        priority: 'high',
        observation: 'Vehículo detectado sin pago válido',
      },
    }).catch(() => {});
  }

  await prisma.enforcementCase.create({
    data: {
      tenantId: tenant.id,
      cityId: city.id,
      inspectorId: inspector?.id,
      vehicleId: vehicle?.id,
      plateNumber: vehicle?.plateNumber ?? 'ABC1234',
      issue: 'no_payment',
      status: 'pending',
      priority: 'high',
      observation: 'Caso generado para demo cliente',
    },
  }).catch(() => {});

  console.log('Seed completed successfully.');
  console.log('Login: admin@smartparking.com / Admin12345');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
