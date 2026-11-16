process.loadEnvFile?.();
import { PrismaPg } from '@prisma/adapter-pg';
import { ostan, shahr } from 'iran-cities-json';
import { PrismaClient, Role } from '../src/generated/prisma/client.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not defined in .env');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

function toSlug(value: string): string {
  return value.trim().replace(/\s+/g, '-');
}

async function seedAdmin() {
  const adminPhone = process.env.ADMIN_PHONE || '09121111111';
  const adminName = process.env.ADMIN_NAME || 'مدیر سیستم';

  console.log(`Checking admin user...`);

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
    `✅ Admin user ready: ID=${user.id}, Name=${user.name}, Role=${user.role}`,
  );
}

async function seedLocations() {
  console.log('Seeding Iranian provinces and cities from iran-cities-json...');

  const provinceIdMap = new Map<number, number>();
  let seededProvinces = 0;

  for (const p of ostan) {
    const name = p.name.trim();
    const slug = toSlug(name);

    const province = await prisma.province.upsert({
      where: { slug },
      update: { name },
      create: {
        name,
        slug,
        isActive: true,
      },
    });

    provinceIdMap.set(p.id, province.id);
    seededProvinces++;
  }

  // Deduplicate cities within the same province (e.g. duplicate 'گلوگاه' in Mazandaran)
  const uniqueCities = new Map<string, { provinceId: number; name: string; slug: string }>();

  for (const c of shahr) {
    const dbProvinceId = provinceIdMap.get(c.ostan);
    if (!dbProvinceId) continue;

    const name = c.name.trim();
    const slug = toSlug(name);
    const key = `${dbProvinceId}:${slug}`;

    if (!uniqueCities.has(key)) {
      uniqueCities.set(key, {
        provinceId: dbProvinceId,
        name,
        slug,
      });
    }
  }

  const citiesList = Array.from(uniqueCities.values());
  const batchSize = 50;

  for (let i = 0; i < citiesList.length; i += batchSize) {
    const batch = citiesList.slice(i, i + batchSize);
    await Promise.all(
      batch.map((city) =>
        prisma.city.upsert({
          where: {
            provinceId_slug: {
              provinceId: city.provinceId,
              slug: city.slug,
            },
          },
          update: { name: city.name },
          create: {
            provinceId: city.provinceId,
            name: city.name,
            slug: city.slug,
            isActive: true,
          },
        }),
      ),
    );
  }

  console.log(
    `✅ Locations seeded (idempotent): ${seededProvinces} provinces, ${citiesList.length} unique cities`,
  );
}

async function main() {
  await seedAdmin();
  await seedLocations();
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
