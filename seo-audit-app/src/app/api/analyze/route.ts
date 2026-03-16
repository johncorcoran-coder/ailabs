import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { analyzePages } from "@/lib/analyzer";
import { calculateTokenCost, calculateAgencyCost } from "@/lib/pricing";
import type { CrawledPage } from "@/types";

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

  if (audit.status !== "analyzing") {
    return NextResponse.json(
      { error: `Audit is in '${audit.status}' state, expected 'analyzing'` },
      { status: 400 }
    );
  }

  try {
    const pages = audit.crawledPages.map(
      (cp) => cp.rawData as unknown as CrawledPage
    );
    const { issues, inputTokens, outputTokens } = await analyzePages(pages);

    // Calculate costs
    const estimatedCostUsd = calculateTokenCost(inputTokens, outputTokens);
    const agencyComparisonCostUsd = calculateAgencyCost(issues);

    // Calculate health score (100 - weighted penalty)
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

    // Store issues
    await prisma.auditIssue.createMany({
      data: issues.map((issue) => ({
        auditId: audit.id,
        pageUrl: issue.pageUrl,
        issueType: issue.issueType,
        severity: issue.severity,
        priorityRank: issue.priorityRank,
        currentValue: issue.currentValue,
        suggestedValue: issue.suggestedValue,
        status: "pending",
      })),
    });

    // Update audit
    await prisma.audit.update({
      where: { id: audit.id },
      data: {
        status: "complete",
        totalIssuesFound: issues.length,
        estimatedTokens: inputTokens + outputTokens,
        estimatedCostUsd,
        agencyComparisonCostUsd,
        healthScore,
      },
    });

    return NextResponse.json({
      auditId: audit.id,
      status: "complete",
      totalIssues: issues.length,
      healthScore,
      estimatedCostUsd,
      agencyComparisonCostUsd,
    });
  } catch (err) {
    await prisma.audit.update({
      where: { id: audit.id },
      data: { status: "failed" },
    });
    return NextResponse.json(
      { error: "Analysis failed. Please try again." },
      { status: 500 }
    );
  }
}
