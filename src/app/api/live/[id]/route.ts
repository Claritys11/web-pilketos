import { ok, handleApiError } from "@/lib/api/response";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/live/[id]
 *
 * Public endpoint — no authentication required.
 * Returns aggregated vote counts and percentages per candidate for a given election.
 * Safe to expose publicly: only aggregate counts, never individual voter identity.
 *
 * Reference: _reference/e-pilketos/(live)/LiveCount2Kandidat/[id]/page.tsx
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const election = await prisma.election.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        mode: true,
        openedAt: true,
        candidates: {
          orderBy: { orderNumber: "asc" },
          select: {
            id: true,
            orderNumber: true,
            name: true,
            className: true,
            photoUrl: true,
            _count: { select: { votes: true } },
          },
        },
        _count: { select: { votes: true } },
      },
    });

    if (!election) {
      return handleApiError(new Error("Election tidak ditemukan."));
    }

    const totalVotes = election._count.votes;

    const candidates = election.candidates.map((candidate) => {
      const voteCount = candidate._count.votes;
      const percentage =
        totalVotes === 0
          ? 0
          : Number(((voteCount / totalVotes) * 100).toFixed(2));
      return {
        id: candidate.id,
        orderNumber: candidate.orderNumber,
        name: candidate.name,
        className: candidate.className,
        photoUrl: candidate.photoUrl ?? null,
        voteCount,
        percentage,
      };
    });

    return ok({
      election: {
        id: election.id,
        title: election.title,
        description: election.description,
        status: election.status,
        mode: election.mode,
        openedAt: election.openedAt,
      },
      totalVotes,
      candidates,
      refreshIntervalMs: 5000,
      generatedAt: new Date(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
