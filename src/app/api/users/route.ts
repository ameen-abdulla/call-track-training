import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/api-utils'
import { UserRole } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { validatePassword, sanitizeText, normalizeEmail } from '@/lib/password-policy'

export async function GET(req: NextRequest) {
  try {
    const { error } = await requireAuth('admin')
    if (error) return error

    const { searchParams } = new URL(req.url)
    const role = searchParams.get('role')
    let normalizedRole: UserRole | undefined
    if (role) {
      const r = role.toUpperCase()
      if (r === 'ADMIN') normalizedRole = UserRole.ADMIN
      else if (['FREELANCER', 'AGENT', 'SECRETARY'].includes(r)) normalizedRole = UserRole.FREELANCER
    }

    const where = normalizedRole ? { role: normalizedRole } : {}

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        freelancerStatus: true,
        createdAt: true,
      },
      orderBy: { name: 'asc' },
    })
    return NextResponse.json(users)
  } catch (err) {
    console.error('Error fetching users:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const { error } = await requireAuth('admin')
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
    const role: string = body?.role ?? ''

    if (!name || !email || !password || !role) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
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

    const roleUpper = role.toUpperCase() === 'ADMIN' ? UserRole.ADMIN : UserRole.FREELANCER
    const passwordHash = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
      data: {
        name,
        email,
        phone,
        passwordHash,
        role: roleUpper,
        freelancerStatus: roleUpper === UserRole.FREELANCER ? 'APPROVED' : null,
      },
      select: { id: true, name: true, email: true, role: true, freelancerStatus: true },
    })
    return NextResponse.json(user, { status: 201 })
  } catch (err) {
    console.error('Error creating user:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
