import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/session";
import { prisma } from "@/lib/db";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ connectionId: string }> }
) {
  const session = await getRequiredSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { connectionId } = await params;

  // Verify ownership
  const connection = await prisma.wPConnection.findFirst({
    where: { id: connectionId, userId: session.userId },
    select: { id: true, siteUrl: true },
  });

  if (!connection) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  // Get all completed audits for this connection, ordered by date
  const audits = await prisma.audit.findMany({
    where: {
      wpConnectionId: connectionId,
      status: "complete",
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      healthScore: true,
      totalPagesCrawled: true,
      totalIssuesFound: true,
      createdAt: true,
      issues: {
        select: { severity: true, status: true },
      },
    },
  });

  const history = audits.map((a) => ({
    id: a.id,
    healthScore: a.healthScore,
    totalPagesCrawled: a.totalPagesCrawled,
    totalIssuesFound: a.totalIssuesFound,
    criticalCount: a.issues.filter((i) => i.severity === "critical").length,
    highCount: a.issues.filter((i) => i.severity === "high").length,
    mediumCount: a.issues.filter((i) => i.severity === "medium").length,
    lowCount: a.issues.filter((i) => i.severity === "low").length,
    fixedCount: a.issues.filter((i) => i.status === "applied").length,
    createdAt: a.createdAt,
  }));

  return NextResponse.json({
    siteUrl: connection.siteUrl,
    history,
  });
}
