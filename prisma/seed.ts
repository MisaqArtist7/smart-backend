process.loadEnvFile?.();
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Role } from '../src/generated/prisma/client.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not defined in .env');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  const adminPhone = process.env.ADMIN_PHONE || '09121111111';
  const adminName = process.env.ADMIN_NAME || 'مدیر سیستم';

  console.log(`Checking admin user with phone: ${adminPhone}...`);

  const user = await prisma.user.upsert({
    where: { phone: adminPhone },
    update: {
      role: Role.ADMIN,
      isActive: true,
    },
    create: {
      phone: adminPhone,
      name: adminName,
      role: Role.ADMIN,
      isActive: true,
    },
  });

  console.log(
    `✅ Admin user ready: ID=${user.id}, Name=${user.name}, Phone=${user.phone}, Role=${user.role}`,
  );
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
