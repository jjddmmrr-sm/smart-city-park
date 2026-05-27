import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Creating initial tenant...');

  const tenant = await prisma.tenant.create({
    data: {
      name: 'Municipality Demo',
      code: 'MUNI_DEMO',
    },
  });

  console.log('Creating city...');

  const city = await prisma.city.create({
    data: {
      tenantId: tenant.id,
      name: 'Smart City Demo',
      code: 'SMART_CITY',
    },
  });

  console.log('Creating admin role...');

  const role = await prisma.role.create({
    data: {
      name: 'Administrator',
      code: 'ADMIN',
      description: 'System Administrator',
    },
  });

  console.log('Creating admin user...');

  const user = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      cityId: city.id,
      email: 'admin@smartcity.local',
      name: 'Platform Administrator',
      password: 'CHANGE_ME_LATER',
    },
  });

  await prisma.userRole.create({
    data: {
      userId: user.id,
      roleId: role.id,
    },
  });

  console.log('Seed completed successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
