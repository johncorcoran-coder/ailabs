import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/session";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  const session = await getRequiredSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const auditId = searchParams.get("auditId");

  if (!auditId) {
    return NextResponse.json(
      { error: "auditId query parameter is required" },
      { status: 400 }
    );
  }

  const audit = await prisma.audit.findFirst({
    where: { id: auditId, userId: session.userId },
    select: {
      id: true,
      status: true,
      progressMessage: true,
      progressPercent: true,
      totalUrlsDiscovered: true,
      totalPagesCrawled: true,
      pagesCrawledSoFar: true,
      pagesAnalyzedSoFar: true,
      totalIssuesFound: true,
      healthScore: true,
      estimatedCostUsd: true,
      agencyComparisonCostUsd: true,
      errorDetails: true,
    },
  });

  if (!audit) {
    return NextResponse.json({ error: "Audit not found" }, { status: 404 });
  }

  return NextResponse.json(audit);
}
