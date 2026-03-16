import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/session";
import { prisma } from "@/lib/db";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getRequiredSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const audit = await prisma.audit.findFirst({
    where: { id, userId: session.userId },
    include: {
      issues: {
        orderBy: { priorityRank: "asc" },
      },
    },
  });

  if (!audit) {
    return NextResponse.json({ error: "Audit not found" }, { status: 404 });
  }

  const summary = {
    id: audit.id,
    siteUrl: audit.siteUrl,
    status: audit.status,
    totalPagesCrawled: audit.totalPagesCrawled,
    totalIssuesFound: audit.totalIssuesFound,
    healthScore: audit.healthScore,
    estimatedCostUsd: audit.estimatedCostUsd,
    agencyComparisonCostUsd: audit.agencyComparisonCostUsd,
    createdAt: audit.createdAt,
    issues: audit.issues.map((issue) => ({
      id: issue.id,
      pageUrl: issue.pageUrl,
      issueType: issue.issueType,
      severity: issue.severity,
      priorityRank: issue.priorityRank,
      currentValue: issue.currentValue,
      suggestedValue: issue.suggestedValue,
      userModifiedValue: issue.userModifiedValue,
      status: issue.status,
    })),
  };

  return NextResponse.json(summary);
}
