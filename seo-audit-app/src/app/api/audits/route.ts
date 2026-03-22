import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/session";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getRequiredSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const audits = await prisma.audit.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      siteUrl: true,
      status: true,
      totalPagesCrawled: true,
      totalIssuesFound: true,
      healthScore: true,
      estimatedCostUsd: true,
      createdAt: true,
      issues: {
        select: { status: true },
      },
    },
  });

  const result = audits.map((a) => ({
    id: a.id,
    siteUrl: a.siteUrl,
    status: a.status,
    totalPagesCrawled: a.totalPagesCrawled,
    totalIssuesFound: a.totalIssuesFound,
    healthScore: a.healthScore,
    estimatedCostUsd: a.estimatedCostUsd,
    createdAt: a.createdAt,
    appliedCount: a.issues.filter((i) => i.status === "applied").length,
    skippedCount: a.issues.filter((i) => i.status === "skipped").length,
  }));

  return NextResponse.json(result);
}
