import { PrismaClient, UserRole, FreelancerStatus } from '@prisma/client'
import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import bcrypt from 'bcryptjs'

const testDbPath = path.resolve(__dirname, 'test-scenarios.db')
process.env.DATABASE_URL = `file:${testDbPath}`

function runCommand(cmd: string) {
  execSync(cmd, {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, DATABASE_URL: `file:./test-scenarios.db` },
    stdio: 'pipe',
  })
}

function cleanupDb() {
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath)
  const wal = `${testDbPath}-wal`
  if (fs.existsSync(wal)) fs.unlinkSync(wal)
  const shm = `${testDbPath}-shm`
  if (fs.existsSync(shm)) fs.unlinkSync(shm)
}

async function runTests() {
  console.log('🧪 Starting Seed Scenarios Automated Test Suite...\n')

  // -------------------------------------------------------------
  // Scenario A: Fresh database
  // -------------------------------------------------------------
  console.log('▶ Testing Scenario A: Fresh database...')
  cleanupDb()
  runCommand('npx prisma db push --skip-generate')
  runCommand('npx tsx prisma/seed.ts')

  const prismaA = new PrismaClient({ datasourceUrl: `file:${testDbPath}` })
  const adminA = await prismaA.user.findUnique({ where: { email: 'admin-trn@calltrack.local' } })
  const freelancerA = await prismaA.user.findUnique({ where: { email: 'freelancer-trn@calltrack.local' } })
  if (!adminA || adminA.role !== UserRole.ADMIN) throw new Error('Scenario A failed: Admin user missing or invalid role')
  if (!freelancerA || freelancerA.role !== UserRole.FREELANCER || freelancerA.freelancerStatus !== FreelancerStatus.APPROVED) {
    throw new Error('Scenario A failed: Freelancer missing or invalid status')
  }

  const contactsA = await prismaA.contact.findMany({ include: { assignments: true } })
  if (contactsA.length === 0) throw new Error('Scenario A failed: No contacts created')

  for (const c of contactsA) {
    if (c.createdById !== adminA.id) throw new Error(`Scenario A failed: Contact createdById (${c.createdById}) !== admin.id (${adminA.id})`)
    if (c.status === 'queued' && c.assignedToId !== freelancerA.id) {
      throw new Error(`Scenario A failed: Queued contact assignedToId !== freelancer.id`)
    }
  }

  const historiesA = await prismaA.assignmentHistory.findMany()
  for (const h of historiesA) {
    if (h.changedById !== adminA.id) throw new Error('Scenario A failed: Assignment history changedById !== admin.id')
    if (h.toUserId !== freelancerA.id) throw new Error('Scenario A failed: Assignment history toUserId !== freelancer.id')
  }

  const initialContactCount = contactsA.length
  console.log(`  ✔ Scenario A passed: ${initialContactCount} contacts created with valid FKs to admin (${adminA.id}) and freelancer (${freelancerA.id})\n`)
  await prismaA.$disconnect()

  // -------------------------------------------------------------
  // Scenario B: Seed rerun
  // -------------------------------------------------------------
  console.log('▶ Testing Scenario B: Seed rerun on existing database...')
  runCommand('npx tsx prisma/seed.ts')

  const prismaB = new PrismaClient({ datasourceUrl: `file:${testDbPath}` })
  const contactCountB = await prismaB.contact.count()
  if (contactCountB !== initialContactCount) {
    throw new Error(`Scenario B failed: Duplicate contacts created (${contactCountB} vs ${initialContactCount})`)
  }
  const adminB = await prismaB.user.findUnique({ where: { email: 'admin-trn@calltrack.local' } })
  const freelancerB = await prismaB.user.findUnique({ where: { email: 'freelancer-trn@calltrack.local' } })
  if (!adminB || !freelancerB) throw new Error('Scenario B failed: Users missing after rerun')
  console.log(`  ✔ Scenario B passed: Rerun idempotent, contact count preserved (${contactCountB})\n`)
  await prismaB.$disconnect()

  // -------------------------------------------------------------
  // Scenario C: Legacy users present (admin@calltrack.local, freelancer@calltrack.local)
  // -------------------------------------------------------------
  console.log('▶ Testing Scenario C: Legacy users present...')
  cleanupDb()
  runCommand('npx prisma db push --skip-generate')

  const prismaC = new PrismaClient({ datasourceUrl: `file:${testDbPath}` })
  const dummyHash = await bcrypt.hash('LegacyPass123!', 10)
  const legacyAdmin = await prismaC.user.create({
    data: {
      email: 'admin@calltrack.local',
      name: 'Legacy Admin',
      passwordHash: dummyHash,
      role: UserRole.ADMIN,
    },
  })
  const legacyFreelancer = await prismaC.user.create({
    data: {
      email: 'freelancer@calltrack.local',
      name: 'Legacy Freelancer',
      passwordHash: dummyHash,
      role: UserRole.FREELANCER,
      freelancerStatus: FreelancerStatus.APPROVED,
    },
  })
  // Create a contact linked to legacy admin
  await prismaC.contact.create({
    data: {
      name: 'Legacy School',
      phone: '1234567890',
      createdById: legacyAdmin.id,
      assignedToId: legacyFreelancer.id,
      status: 'queued',
    },
  })
  await prismaC.$disconnect()

  runCommand('npx tsx prisma/seed.ts')

  const prismaC2 = new PrismaClient({ datasourceUrl: `file:${testDbPath}` })
  const oldAdminC = await prismaC2.user.findUnique({ where: { email: 'admin@calltrack.local' } })
  const oldFreelancerC = await prismaC2.user.findUnique({ where: { email: 'freelancer@calltrack.local' } })
  if (oldAdminC || oldFreelancerC) throw new Error('Scenario C failed: Legacy emails still found after migration')

  const migratedAdmin = await prismaC2.user.findUnique({ where: { email: 'admin-trn@calltrack.local' } })
  const migratedFreelancer = await prismaC2.user.findUnique({ where: { email: 'freelancer-trn@calltrack.local' } })
  if (!migratedAdmin || migratedAdmin.id !== legacyAdmin.id) throw new Error('Scenario C failed: Admin ID changed during in-place migration')
  if (!migratedFreelancer || migratedFreelancer.id !== legacyFreelancer.id) throw new Error('Scenario C failed: Freelancer ID changed during in-place migration')

  const contactC = await prismaC2.contact.findFirst({ where: { name: 'Legacy School' } })
  if (!contactC || contactC.createdById !== migratedAdmin.id || contactC.assignedToId !== migratedFreelancer.id) {
    throw new Error('Scenario C failed: Contact relation not preserved')
  }
  console.log('  ✔ Scenario C passed: Legacy accounts migrated in-place, relations intact\n')
  await prismaC2.$disconnect()

  // -------------------------------------------------------------
  // Scenario D: Target training users already present
  // -------------------------------------------------------------
  console.log('▶ Testing Scenario D: Target training users already present...')
  runCommand('npx tsx prisma/seed.ts')
  const prismaD = new PrismaClient({ datasourceUrl: `file:${testDbPath}` })
  const adminD = await prismaD.user.findUnique({ where: { email: 'admin-trn@calltrack.local' } })
  if (!adminD || adminD.role !== UserRole.ADMIN) throw new Error('Scenario D failed')
  console.log('  ✔ Scenario D passed: Existing target training users updated cleanly\n')
  await prismaD.$disconnect()

  // -------------------------------------------------------------
  // Scenario E: Both legacy and target emails present
  // -------------------------------------------------------------
  console.log('▶ Testing Scenario E: Both legacy and target emails present simultaneously...')
  const prismaE = new PrismaClient({ datasourceUrl: `file:${testDbPath}` })
  // Re-insert legacy accounts
  const extraLegacyAdmin = await prismaE.user.create({
    data: {
      email: 'admin@calltrack.local',
      name: 'Stray Legacy Admin',
      passwordHash: dummyHash,
      role: UserRole.ADMIN,
    },
  })
  const extraLegacyFreelancer = await prismaE.user.create({
    data: {
      email: 'freelancer@calltrack.local',
      name: 'Stray Legacy Freelancer',
      passwordHash: dummyHash,
      role: UserRole.FREELANCER,
    },
  })
  // Link contact and history to stray legacy users
  const legacyLinkedContact = await prismaE.contact.create({
    data: {
      name: 'Conflict School',
      phone: '9876543210',
      createdById: extraLegacyAdmin.id,
      assignedToId: extraLegacyFreelancer.id,
      status: 'queued',
    },
  })
  await prismaE.assignmentHistory.create({
    data: {
      contactId: legacyLinkedContact.id,
      fromUserId: null,
      toUserId: extraLegacyFreelancer.id,
      changedById: extraLegacyAdmin.id,
      reason: 'test_legacy_conflict',
    },
  })
  await prismaE.$disconnect()

  // Run seed — must reconcile without collision
  runCommand('npx tsx prisma/seed.ts')

  const prismaE2 = new PrismaClient({ datasourceUrl: `file:${testDbPath}` })
  const legacyAdminCheck = await prismaE2.user.findUnique({ where: { email: 'admin@calltrack.local' } })
  const legacyFreelancerCheck = await prismaE2.user.findUnique({ where: { email: 'freelancer@calltrack.local' } })
  if (legacyAdminCheck || legacyFreelancerCheck) {
    throw new Error('Scenario E failed: Stray legacy user still exists')
  }

  const targetAdminE = await prismaE2.user.findUnique({ where: { email: 'admin-trn@calltrack.local' } })
  const targetFreelancerE = await prismaE2.user.findUnique({ where: { email: 'freelancer-trn@calltrack.local' } })
  if (!targetAdminE || !targetFreelancerE) throw new Error('Scenario E failed: Target users missing')

  const reconciledContact = await prismaE2.contact.findUnique({ where: { id: legacyLinkedContact.id } })
  if (!reconciledContact || reconciledContact.createdById !== targetAdminE.id || reconciledContact.assignedToId !== targetFreelancerE.id) {
    throw new Error('Scenario E failed: Relations were not migrated to target users')
  }

  const reconciledHistory = await prismaE2.assignmentHistory.findFirst({ where: { contactId: legacyLinkedContact.id } })
  if (!reconciledHistory || reconciledHistory.changedById !== targetAdminE.id || reconciledHistory.toUserId !== targetFreelancerE.id) {
    throw new Error('Scenario E failed: History relation not migrated')
  }

  console.log('  ✔ Scenario E passed: Reconciled relations from legacy to target, removed legacy without collision\n')
  await prismaE2.$disconnect()

  cleanupDb()
  console.log('🎉 ALL SEED SCENARIOS PASSED WITH ZERO ERRORS!\n')
}

runTests().catch((err) => {
  console.error('❌ Test suite failed:', err)
  cleanupDb()
  process.exit(1)
})
