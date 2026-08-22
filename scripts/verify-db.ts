import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function verify() {
  console.log('=== VERIFICACIÓN BASE DE DATOS NEON ===\n');

  // Users
  const users = await prisma.user.findMany({ select: { usuario: true, rol: true, cargo: true, activo: true } });
  console.log('👤 USUARIOS:');
  users.forEach(u => console.log(`   ${u.usuario} | ${u.rol} | ${u.cargo} | Activo: ${u.activo}`));

  // Committees
  const committees = await prisma.committee.findMany({ select: { nombre: true, codigo: true, activo: true } });
  console.log('\n🏛️ COMITÉS:');
  committees.forEach(c => console.log(`   ${c.nombre} (${c.codigo}) | Activo: ${c.activo}`));

  // Actas count
  const actasCount = await prisma.acta.count();
  console.log(`\n📄 ACTAS: ${actasCount} registros`);

  // Voice transcriptions
  const voiceCount = await prisma.voiceTranscription.count();
  console.log(`🎙️ VOICE TRANSCRIPTIONS: ${voiceCount} registros`);

  // Sequences
  const sequences = await prisma.sequence.findMany();
  console.log(`🔢 SEQUENCES: ${sequences.length} registros`);
  sequences.forEach(s => console.log(`   ${s.committeeCode} - ${s.year} - Último: ${s.lastNumber}`));

  // Audit logs
  const auditCount = await prisma.auditLog.count();
  console.log(`📋 AUDIT LOGS: ${auditCount} registros`);

  console.log('\n✅ BASE DE DATOS NEON VERIFICADA CORRECTAMENTE');
  await prisma.$disconnect();
}

verify().catch(e => { console.error('❌ ERROR:', e.message); process.exit(1); });
