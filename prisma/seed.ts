import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import bcrypt from 'bcryptjs';

const connectionString = process.env.DATABASE_URL!;
const adapter = new PrismaNeon({ connectionString });
const prisma = new PrismaClient({ adapter });

const COMMITTEES = [
  { nombre: 'Curricular', codigo: 'CUR' },
  { nombre: 'Investigación', codigo: 'INV' },
  { nombre: 'Decanatura', codigo: 'DEC' },
  { nombre: 'Otro', codigo: 'OTR' },
] as const;

async function seedCommittees() {
  console.log('🏛️  Seeding committees...');

  for (const committee of COMMITTEES) {
    const result = await prisma.committee.upsert({
      where: { codigo: committee.codigo },
      update: {},
      create: {
        nombre: committee.nombre,
        codigo: committee.codigo,
        activo: true,
      },
    });

    const wasCreated = result.createdAt.getTime() === result.updatedAt.getTime();
    if (wasCreated) {
      console.log(`  ✅ Created committee: ${committee.nombre} (${committee.codigo})`);
    } else {
      console.log(`  ⏭️  Skipped committee (already exists): ${committee.nombre} (${committee.codigo})`);
    }
  }
}

async function seedAdminUser() {
  console.log('👤 Seeding admin user...');

  const adminUser = process.env.ADMIN_USER;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminCargo = process.env.ADMIN_CARGO || 'Profesor';

  if (!adminUser || !adminPassword || !adminEmail) {
    console.error(
      '  ❌ Missing required environment variables: ADMIN_USER, ADMIN_PASSWORD, ADMIN_EMAIL'
    );
    console.error('  Skipping admin user seed.');
    return;
  }

  const passwordHash = await bcrypt.hash(adminPassword, 12);

  const result = await prisma.user.upsert({
    where: { usuario: adminUser },
    update: {},
    create: {
      nombreCompleto: adminUser,
      usuario: adminUser,
      passwordHash,
      cargo: adminCargo,
      correo: adminEmail,
      rol: 'Administrador',
      activo: true,
    },
  });

  const wasCreated = result.createdAt.getTime() === result.updatedAt.getTime();
  if (wasCreated) {
    console.log(`  ✅ Created admin user: ${adminUser} (${adminEmail})`);
  } else {
    console.log(`  ⏭️  Skipped admin user (already exists): ${adminUser}`);
  }
}

async function main() {
  console.log('🌱 Starting database seed...\n');

  await seedCommittees();
  console.log('');
  await seedAdminUser();

  console.log('\n✨ Seed completed successfully!');
}

main()
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
