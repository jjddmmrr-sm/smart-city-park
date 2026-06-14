import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { code: 'SMART-PARKING-DEMO' },
    update: {},
    create: {
      name: 'Smart Parking Demo Municipality',
      code: 'SMART-PARKING-DEMO',
      status: 'active',
    },
  });

  const city = await prisma.city.upsert({
    where: {
      tenantId_code: {
        tenantId: tenant.id,
        code: 'CUENCA',
      },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Cuenca',
      code: 'CUENCA',
      status: 'active',
    },
  });

  const role = await prisma.role.upsert({
    where: { code: 'SUPER_ADMIN' },
    update: {},
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
      password,
      tenantId: tenant.id,
      cityId: city.id,
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

  console.log('Seed completed');
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
