import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { crawlSiteWithProgress } from "@/lib/crawler";
import { analyzePages } from "@/lib/analyzer";
import { calculateTokenCost, calculateAgencyCost } from "@/lib/pricing";

/**
 * Cron endpoint to trigger scheduled re-audits.
 * Should be called by an external cron service (e.g., Vercel Cron, Railway Cron).
 * Protected by CRON_SECRET env var.
 *
 * GET /api/cron/run-schedules?secret=YOUR_CRON_SECRET
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || secret !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find due schedules
  const now = new Date();
  const dueSchedules = await prisma.auditSchedule.findMany({
    where: {
      enabled: true,
      nextRunAt: { lte: now },
    },
    include: {
      wpConnection: true,
    },
    take: 5, // Process max 5 at a time to avoid timeouts
  });

  const results: { connectionId: string; siteUrl: string; auditId: string }[] =
    [];

  for (const schedule of dueSchedules) {
    try {
      // Find previous audit for comparison
      const previousAudit = await prisma.audit.findFirst({
        where: {
          wpConnectionId: schedule.wpConnectionId,
          status: "complete",
        },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });

      // Create the audit
      const audit = await prisma.audit.create({
        data: {
          userId: schedule.userId,
          wpConnectionId: schedule.wpConnectionId,
          siteUrl: schedule.wpConnection.siteUrl,
          status: "crawling",
          progressMessage: "Scheduled audit starting...",
          progressPercent: 0,
          previousAuditId: previousAudit?.id ?? null,
          scheduledBy: schedule.id,
        },
      });

      // Update schedule
      const nextRunAt = getNextRunDate(schedule.frequency);
      await prisma.auditSchedule.update({
        where: { id: schedule.id },
        data: {
          lastRunAt: now,
          nextRunAt,
        },
      });

      // Run the pipeline in background (fire and forget for cron)
      runScheduledAudit(audit.id, schedule.wpConnection.siteUrl).catch(
        () => {}
      );

      results.push({
        connectionId: schedule.wpConnectionId,
        siteUrl: schedule.wpConnection.siteUrl,
        auditId: audit.id,
      });
    } catch (err) {
      console.error(
        `Failed to start scheduled audit for ${schedule.wpConnection.siteUrl}:`,
        err
      );
    }
  }

  return NextResponse.json({
    triggered: results.length,
    audits: results,
  });
}

async function runScheduledAudit(auditId: string, siteUrl: string) {
  try {
    const pages = await crawlSiteWithProgress(siteUrl, async (progress) => {
      await prisma.audit.update({
        where: { id: auditId },
        data: {
          progressMessage: progress.message,
          progressPercent: Math.round(progress.percent * 0.5),
          totalUrlsDiscovered: progress.totalUrls,
          pagesCrawledSoFar: progress.crawledSoFar,
        },
      });
    });

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
        progressMessage: "Analyzing...",
        progressPercent: 50,
      },
    });

    const { issues, inputTokens, outputTokens } = await analyzePages(pages);

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
        progressMessage: "Scheduled audit complete!",
        progressPercent: 100,
      },
    });
  } catch (err) {
    await prisma.audit.update({
      where: { id: auditId },
      data: {
        status: "failed",
        progressMessage: "Scheduled audit failed",
        errorDetails:
          err instanceof Error ? err.message : "An unexpected error occurred",
      },
    });
  }
}

function getNextRunDate(frequency: string): Date {
  const now = new Date();
  switch (frequency) {
    case "weekly":
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    case "biweekly":
      return new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    case "monthly":
    default:
      return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  }
}
