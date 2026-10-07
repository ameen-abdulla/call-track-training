import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/api-utils'
import bcrypt from 'bcryptjs'
import { validatePassword, sanitizeText, normalizeEmail } from '@/lib/password-policy'

export async function GET() {
  try {
    const { error } = await requireAuth('ADMIN')
    if (error) return error

    const freelancers = await prisma.user.findMany({
      where: { role: 'FREELANCER' },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        freelancerStatus: true,
        applicationNote: true,
        appliedAt: true,
        reviewedAt: true,
        createdAt: true,
        _count: { select: { assignedContacts: true, calls: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(freelancers)
  } catch (err) {
    console.error('Error fetching freelancers:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const { error, session } = await requireAuth('ADMIN')
    if (error) return error

    let body: any
    try {
      body = await req.json()
    } catch (err) {
      console.error('Error parsing JSON request body:', err)
      return NextResponse.json({ error: 'Invalid JSON request body' }, { status: 400 })
    }

    const name = sanitizeText(body?.name ?? '')
    const email = normalizeEmail(body?.email ?? '')
    const phone = body?.phone ? sanitizeText(body.phone) : null
    const password: string = body?.password ?? ''
    const applicationNote = body?.applicationNote ? sanitizeText(body.applicationNote) : null

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Name, email, and password are required' }, { status: 400 })
    }

    // Password strength policy
    const pwCheck = validatePassword(password)
    if (!pwCheck.valid) {
      return NextResponse.json({ error: pwCheck.errors[0] }, { status: 400 })
    }

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 })
    }

    // Safely verify if the reviewer exists to avoid foreign key violation
    let reviewerId: string | null = null
    if (session?.user?.id) {
      const reviewer = await prisma.user.findUnique({ where: { id: session.user.id } })
      if (reviewer) {
        reviewerId = reviewer.id
      } else {
        console.warn(`Reviewer session user ID "${session.user.id}" not found in database. Setting reviewedById to null.`)
      }
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const freelancer = await prisma.user.create({
      data: {
        name,
        email,
        phone,
        passwordHash,
        role: 'FREELANCER',
        freelancerStatus: 'APPROVED',
        appliedAt: new Date(),
        reviewedAt: new Date(),
        reviewedById: reviewerId,
        applicationNote: applicationNote || 'Created directly by Admin',
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        freelancerStatus: true,
        createdAt: true,
      },
    })

    console.log(`Created freelancer successfully: ${freelancer.id} (${freelancer.email})`)
    return NextResponse.json(freelancer, { status: 201 })
  } catch (err) {
    console.error('Error creating freelancer:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
