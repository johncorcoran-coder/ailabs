import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { analyzePages } from "@/lib/analyzer";
import { calculateTokenCost, calculateAgencyCost } from "@/lib/pricing";
import type { CrawledPage } from "@/types";

/**
 * Re-analyze an already-crawled audit.
 * In the normal flow, crawl + analyze run together via POST /api/crawl.
 * This endpoint exists for retrying analysis on a failed audit.
 */
export async function POST(req: Request) {
  const session = await getRequiredSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { auditId } = await req.json();
  if (!auditId) {
    return NextResponse.json(
      { error: "auditId is required" },
      { status: 400 }
    );
  }

  const audit = await prisma.audit.findFirst({
    where: { id: auditId, userId: session.userId },
    include: { crawledPages: true },
  });

  if (!audit) {
    return NextResponse.json({ error: "Audit not found" }, { status: 404 });
  }

  if (!["analyzing", "failed"].includes(audit.status)) {
    return NextResponse.json(
      { error: `Audit is in '${audit.status}' state. Can only re-analyze 'analyzing' or 'failed' audits.` },
      { status: 400 }
    );
  }

  if (audit.crawledPages.length === 0) {
    return NextResponse.json(
      { error: "No crawled page data found. Please start a new audit." },
      { status: 400 }
    );
  }

  // Mark as analyzing
  await prisma.audit.update({
    where: { id: audit.id },
    data: {
      status: "analyzing",
      progressMessage: "Retrying analysis...",
      progressPercent: 50,
      errorDetails: null,
    },
  });

  // Run in background
  runReanalysis(audit.id, audit.crawledPages).catch(() => {});

  return NextResponse.json({
    auditId: audit.id,
    status: "analyzing",
  });
}

async function runReanalysis(
  auditId: string,
  crawledPages: { rawData: unknown }[]
) {
  try {
    const pages = crawledPages.map(
      (cp) => cp.rawData as unknown as CrawledPage
    );

    const { issues, inputTokens, outputTokens } = await analyzePages(
      pages,
      async (progress) => {
        await prisma.audit.update({
          where: { id: auditId },
          data: {
            progressMessage: progress.message,
            progressPercent: 50 + Math.round(progress.percent * 0.45),
            pagesAnalyzedSoFar: progress.pagesAnalyzed,
          },
        });
      }
    );

    const estimatedCostUsd = calculateTokenCost(inputTokens, outputTokens);
    const agencyComparisonCostUsd = calculateAgencyCost(issues);

    const severityPenalty: Record<string, number> = {
      critical: 15,
      high: 8,
      medium: 3,
      low: 1,
    };
    const totalPenalty = issues.reduce(
      (sum, i) => sum + (severityPenalty[i.severity] || 0),
      0
    );
    const healthScore = Math.max(0, Math.min(100, 100 - totalPenalty));

    // Clear existing issues (in case of retry) then create new ones
    await prisma.auditIssue.deleteMany({ where: { auditId } });
    await prisma.auditIssue.createMany({
      data: issues.map((issue) => ({
        auditId,
        pageUrl: issue.pageUrl,
        issueType: issue.issueType,
        severity: issue.severity,
        priorityRank: issue.priorityRank,
        currentValue: issue.currentValue,
        suggestedValue: issue.suggestedValue,
        status: "pending",
      })),
    });

    await prisma.audit.update({
      where: { id: auditId },
      data: {
        status: "complete",
        totalIssuesFound: issues.length,
        estimatedTokens: inputTokens + outputTokens,
        estimatedCostUsd,
        agencyComparisonCostUsd,
        healthScore,
        progressMessage: "Audit complete!",
        progressPercent: 100,
      },
    });
  } catch (err) {
    await prisma.audit.update({
      where: { id: auditId },
      data: {
        status: "failed",
        progressMessage: "Analysis failed",
        errorDetails:
          err instanceof Error ? err.message : "An unexpected error occurred",
      },
    });
  }
}
