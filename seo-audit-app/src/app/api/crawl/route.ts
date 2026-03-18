import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { crawlSiteWithProgress } from "@/lib/crawler";
import { analyzePages } from "@/lib/analyzer";
import { calculateTokenCost, calculateAgencyCost } from "@/lib/pricing";
import type { CrawledPage } from "@/types";

export async function POST(req: Request) {
  const session = await getRequiredSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { wpConnectionId } = await req.json();
  if (!wpConnectionId) {
    return NextResponse.json(
      { error: "wpConnectionId is required" },
      { status: 400 }
    );
  }

  // Verify the connection belongs to this user
  const connection = await prisma.wPConnection.findFirst({
    where: { id: wpConnectionId, userId: session.userId },
  });
  if (!connection) {
    return NextResponse.json(
      { error: "WordPress connection not found" },
      { status: 404 }
    );
  }

  // Find the most recent completed audit for this connection (before/after tracking)
  const previousAudit = await prisma.audit.findFirst({
    where: {
      wpConnectionId: connection.id,
      status: "complete",
    },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  // Create audit record
  const audit = await prisma.audit.create({
    data: {
      userId: session.userId,
      wpConnectionId: connection.id,
      siteUrl: connection.siteUrl,
      status: "crawling",
      progressMessage: "Discovering pages...",
      progressPercent: 0,
      previousAuditId: previousAudit?.id ?? null,
    },
  });

  // Return immediately — run crawl + analysis in the background
  runAuditPipeline(audit.id, connection.siteUrl).catch(() => {
    // Error handling is done inside the pipeline
  });

  return NextResponse.json({
    auditId: audit.id,
    status: "crawling",
  });
}

async function runAuditPipeline(auditId: string, siteUrl: string) {
  try {
    // Phase 1: Crawl with progress updates
    const pages = await crawlSiteWithProgress(siteUrl, async (progress) => {
      await prisma.audit.update({
        where: { id: auditId },
        data: {
          progressMessage: progress.message,
          progressPercent: Math.round(progress.percent * 0.5), // crawling = 0-50%
          totalUrlsDiscovered: progress.totalUrls,
          pagesCrawledSoFar: progress.crawledSoFar,
        },
      });
    });

    // Store crawled data
    await prisma.crawledPageData.createMany({
      data: pages.map((page) => ({
        auditId,
        url: page.url,
        rawData: JSON.parse(JSON.stringify(page)),
      })),
    });

    await prisma.audit.update({
      where: { id: auditId },
      data: {
        status: "analyzing",
        totalPagesCrawled: pages.length,
        progressMessage: "Starting AI analysis...",
        progressPercent: 50,
      },
    });

    // Phase 2: Analyze with progress updates
    const { issues, inputTokens, outputTokens } = await analyzePages(
      pages,
      async (progress) => {
        await prisma.audit.update({
          where: { id: auditId },
          data: {
            progressMessage: progress.message,
            progressPercent: 50 + Math.round(progress.percent * 0.45), // analyzing = 50-95%
            pagesAnalyzedSoFar: progress.pagesAnalyzed,
          },
        });
      }
    );

    // Calculate costs
    const estimatedCostUsd = calculateTokenCost(inputTokens, outputTokens);
    const agencyComparisonCostUsd = calculateAgencyCost(issues);

    // Calculate health score
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

    // Mark complete
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
    const errorMessage =
      err instanceof Error ? err.message : "An unexpected error occurred";

    await prisma.audit.update({
      where: { id: auditId },
      data: {
        status: "failed",
        progressMessage: "Audit failed",
        errorDetails: formatErrorDetails(err),
      },
    });
  }
}

function formatErrorDetails(err: unknown): string {
  if (!(err instanceof Error)) return String(err);

  const message = err.message;

  // WordPress API errors
  if (message.includes("ECONNREFUSED") || message.includes("ENOTFOUND")) {
    return "Could not reach the WordPress site. Please verify the site URL is correct and the server is running.";
  }
  if (message.includes("401") || message.includes("403")) {
    return "WordPress authentication failed. Your application password may have expired or been revoked. Please reconnect your site.";
  }
  if (message.includes("timeout") || message.includes("ETIMEDOUT")) {
    return "The request timed out. The WordPress site may be experiencing high load. Please try again later.";
  }
  if (message.includes("429")) {
    return "Rate limited by the WordPress site. Please wait a few minutes and try again.";
  }

  // Anthropic API errors
  if (message.includes("anthropic") || message.includes("claude")) {
    return "AI analysis service encountered an error. Please try again in a few minutes.";
  }
  if (message.includes("overloaded")) {
    return "AI service is currently busy. Please try again in a few minutes.";
  }

  return `Unexpected error: ${message}`;
}
