import { PrismaClient, UserRole, FreelancerStatus } from '@prisma/client'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

function generatePassword(): string {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const lower = 'abcdefghijklmnopqrstuvwxyz'
  const digits = '0123456789'
  const special = '!@#$%&'
  const all = upper + lower + digits + special
  // Guarantee at least one of each required char type
  const pick = (set: string) => set[crypto.randomInt(set.length)]
  const rest = Array.from({ length: 12 }, () => pick(all))
  const chars = [pick(upper), pick(lower), pick(digits), pick(special), ...rest]
  // Fisher-Yates shuffle
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}

function extractEmail(value: string): string | null {
  if (!value) return null
  const parts = value.split(/[;,\s]+/)
  const emailPart = parts.find(p => p.includes('@'))
  return emailPart ? emailPart.trim() : null
}

function parseCSV(content: string): Record<string, string>[] {
  const lines = content.replace(/\r/g, '').split('\n').filter(l => l.trim())
  const headers = lines[0].split(',')
  return lines.slice(1).map(line => {
    const values: string[] = []
    let current = ''
    let inQuotes = false
    for (const char of line) {
      if (char === '"') { inQuotes = !inQuotes }
      else if (char === ',' && !inQuotes) { values.push(current.trim()); current = '' }
      else { current += char }
    }
    values.push(current.trim())
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h.trim()] = values[i] ?? '' })
    return row
  })
}

async function main() {
  const adminPassword = generatePassword()
  const freelancerPassword = generatePassword()

  const banner = [
    '============================================',
    ' GENERATED SEED CREDENTIALS (save these!)',
    ` Admin:      admin@calltrack.local  →  ${adminPassword}`,
    ` Freelancer: freelancer@calltrack.local  →  ${freelancerPassword}`,
    '============================================',
  ].join('\n')

  console.log(banner)

  const credsPath = path.resolve(__dirname, '..', 'SEED_CREDENTIALS.txt')
  fs.writeFileSync(credsPath, banner + '\n', 'utf-8')
  console.log(`Saved credentials to: ${credsPath}\n`)

  // ── Users ──────────────────────────────────────────────────────────────
  const adminHash = await bcrypt.hash(adminPassword, 10)
  const freelancerHash = await bcrypt.hash(freelancerPassword, 10)

  const admin = await prisma.user.upsert({
    where: { email: 'admin@calltrack.local' },
    update: { passwordHash: adminHash },
    create: {
      name: 'Admin User',
      email: 'admin@calltrack.local',
      passwordHash: adminHash,
      role: UserRole.ADMIN,
      freelancerStatus: null,
    },
  })

  const freelancer = await prisma.user.upsert({
    where: { email: 'freelancer@calltrack.local' },
    update: { passwordHash: freelancerHash },
    create: {
      name: 'Sarah Freelancer',
      email: 'freelancer@calltrack.local',
      passwordHash: freelancerHash,
      role: UserRole.FREELANCER,
      freelancerStatus: FreelancerStatus.APPROVED,
      appliedAt: new Date(),
      reviewedAt: new Date(),
      reviewedById: null,
    },
  })

  // ── Read CSV ───────────────────────────────────────────────────────────
  const csvPaths = [
    path.join(__dirname, 'training_sample_prospect_list.csv'),
    path.join(process.cwd(), 'prisma/training_sample_prospect_list.csv'),
  ]

  let csvContent: string | null = null
  for (const p of csvPaths) {
    if (fs.existsSync(p)) {
      csvContent = fs.readFileSync(p, 'utf-8')
      console.log(`Reading CSV from: ${p}`)
      break
    }
  }
  if (!csvContent) throw new Error('Training sample CSV not found. Tried: ' + csvPaths.join(', '))

  const rows = parseCSV(csvContent)
  console.log(`Parsed ${rows.length} rows`)

  // ── Create Tags from distinct `tag` column values ──────────────────────
  const distinctTags = [...new Set(rows.map(r => r['tag']?.trim()).filter(Boolean))]
  const tagMap: Record<string, string> = {}
  for (const tagName of distinctTags) {
    const tag = await prisma.tag.upsert({
      where: { name: tagName },
      update: {},
      create: { name: tagName },
    })
    tagMap[tagName] = tag.id
  }
  console.log(`Created ${distinctTags.length} tags:`, distinctTags)

  // ── Create Contacts ────────────────────────────────────────────────────
  const existingContacts = await prisma.contact.count()
  let created = 0

  if (existingContacts === 0) {
    for (const row of rows) {
      const name = row['school_name']?.trim()
      const phone = row['main_phone']?.trim()
      if (!name || !phone) continue

      const phone2 = row['mobile_whatsapp']?.trim() || null
      const email = extractEmail(row['public_business_contact'] || '')
      const source = row['source']?.trim() || null  // actual source column
      const callPriority = row['call_priority']?.trim() || null
      const tagName = row['tag']?.trim() || ''
      const targetRole = row['target_role']?.trim() || ''
      const decisionMaker = row['decision_maker_name']?.trim() || ''

      let topic = ''
      if (decisionMaker) {
        topic = `Speak to: ${decisionMaker} — Role: ${targetRole}`
      } else if (targetRole) {
        topic = `Target role: ${targetRole}`
      }

      const status = callPriority === 'B' ? 'new' : 'queued'
      const assignedToId = status === 'queued' ? freelancer.id : null

      const contact = await prisma.contact.create({
        data: {
          name,
          phone,
          phone2,
          email,
          company: name,
          source,
          callPriority,
          status,
          topic: topic || null,
          assignedToId,
          createdById: admin.id,
        },
      })

      // ── Attach tag via ContactTag ──────────────────────────────────────
      if (tagName && tagMap[tagName]) {
        await prisma.contactTag.create({
          data: { contactId: contact.id, tagId: tagMap[tagName] },
        })
      }

      // ── Create AssignmentHistory for initial assignment ────────────────
      if (assignedToId) {
        await prisma.assignmentHistory.create({
          data: {
            contactId: contact.id,
            fromUserId: null,
            toUserId: assignedToId,
            changedById: admin.id,
            reason: 'initial_seed',
          },
        })
      }

      created++
    }
  } else {
    console.log(`ℹ️ Contacts already exist (${existingContacts} found). Skipping CSV contact creation.`)
  }

  console.log(`\n✅ Seeded:`)
  console.log(`   1 admin: admin@calltrack.local / ${adminPassword}`)
  console.log(`   1 freelancer: freelancer@calltrack.local / ${freelancerPassword}`)
  if (created > 0) {
    console.log(`   ${created} contacts from CSV`)
  } else {
    console.log(`   ${existingContacts} existing contacts preserved`)
  }
  console.log(`   ${distinctTags.length} tags: ${distinctTags.join(', ')}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
