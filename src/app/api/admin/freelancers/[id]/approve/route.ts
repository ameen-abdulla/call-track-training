import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/api-utils'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error, session } = await requireAuth('ADMIN')
    if (error) return error
    const { id } = await params

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
        freelancerStatus: 'APPROVED',
        reviewedAt: new Date(),
        reviewedById: reviewerId,
      },
      select: { id: true, name: true, email: true, freelancerStatus: true },
    })

    return NextResponse.json(updated)
  } catch (err) {
    console.error('Error approving freelancer:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
