import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/api-utils'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error, session } = await requireAuth('ADMIN')
    if (error) return error
    const { id } = await params
    const body = await req.json().catch(() => ({}))

    const user = await prisma.user.findUnique({ where: { id } })
    if (!user || user.role !== 'FREELANCER') {
      return NextResponse.json({ error: 'Freelancer not found' }, { status: 404 })
    }

    let reviewerId: string | null = null
    if (session?.user?.id) {
      const reviewer = await prisma.user.findUnique({ where: { id: session.user.id } })
      if (reviewer) reviewerId = reviewer.id
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        freelancerStatus: 'REJECTED',
        reviewedAt: new Date(),
        reviewedById: reviewerId,
        applicationNote: body.reason
          ? `${user.applicationNote || ''}\n[REJECTED]: ${body.reason}`.trim()
          : user.applicationNote,
      },
      select: { id: true, name: true, email: true, freelancerStatus: true },
    })

    return NextResponse.json(updated)
  } catch (err) {
    console.error('Error rejecting freelancer:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
