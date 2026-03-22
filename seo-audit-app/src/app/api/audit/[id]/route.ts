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

  // Fetch previous audit for before/after comparison
  let previousAudit: {
    healthScore: number;
    totalIssuesFound: number;
    totalPagesCrawled: number;
    createdAt: Date;
  } | null = null;

  if (audit.previousAuditId) {
    previousAudit = await prisma.audit.findFirst({
      where: { id: audit.previousAuditId, status: "complete" },
      select: {
        healthScore: true,
        totalIssuesFound: true,
        totalPagesCrawled: true,
        createdAt: true,
      },
    });
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
    previousAudit: previousAudit
      ? {
          healthScore: previousAudit.healthScore,
          totalIssuesFound: previousAudit.totalIssuesFound,
          totalPagesCrawled: previousAudit.totalPagesCrawled,
          createdAt: previousAudit.createdAt,
        }
      : null,
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
