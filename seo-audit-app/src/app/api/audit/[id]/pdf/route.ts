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
    where: { id, userId: session.userId, status: "complete" },
    include: {
      issues: { orderBy: { priorityRank: "asc" } },
    },
  });

  if (!audit) {
    return NextResponse.json({ error: "Audit not found" }, { status: 404 });
  }

  // Get previous audit for comparison
  let previousAudit: { healthScore: number; totalIssuesFound: number; createdAt: Date } | null = null;
  if (audit.previousAuditId) {
    previousAudit = await prisma.audit.findFirst({
      where: { id: audit.previousAuditId, status: "complete" },
      select: { healthScore: true, totalIssuesFound: true, createdAt: true },
    });
  }

  const severityCounts = {
    critical: audit.issues.filter((i) => i.severity === "critical").length,
    high: audit.issues.filter((i) => i.severity === "high").length,
    medium: audit.issues.filter((i) => i.severity === "medium").length,
    low: audit.issues.filter((i) => i.severity === "low").length,
  };

  const appliedCount = audit.issues.filter((i) => i.status === "applied").length;
  const date = audit.createdAt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const severityColor: Record<string, string> = {
    critical: "#dc2626",
    high: "#ea580c",
    medium: "#ca8a04",
    low: "#2563eb",
  };

  const issueRows = audit.issues
    .map(
      (i) => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;font-size:13px;">
          <span style="display:inline-block;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;color:white;background:${severityColor[i.severity] || "#6b7280"}">
            ${i.severity}
          </span>
        </td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;font-size:13px;">${escapeHtml(i.issueType.replace(/_/g, " "))}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#6b7280;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(i.pageUrl)}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#6b7280;">${escapeHtml(truncate(i.currentValue, 60))}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#059669;">${escapeHtml(truncate(i.suggestedValue, 60))}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;font-size:12px;">
          ${i.status === "applied" ? '<span style="color:#059669">Applied</span>' : i.status === "skipped" ? '<span style="color:#6b7280">Skipped</span>' : '<span style="color:#ea580c">Pending</span>'}
        </td>
      </tr>`
    )
    .join("");

  const comparisonSection = previousAudit
    ? `
    <div style="margin-top:20px;padding:16px;background:#eef2ff;border-radius:8px;">
      <h3 style="margin:0 0 8px;font-size:14px;color:#3730a3;">Compared to Previous Audit (${previousAudit.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })})</h3>
      <div style="display:flex;gap:32px;">
        <div>
          <span style="font-size:12px;color:#6366f1;">Health Score</span><br/>
          <strong>${audit.healthScore}</strong>
          <span style="font-size:12px;color:${audit.healthScore > previousAudit.healthScore ? "#059669" : audit.healthScore < previousAudit.healthScore ? "#dc2626" : "#6b7280"}">
            (${audit.healthScore > previousAudit.healthScore ? "+" : ""}${audit.healthScore - previousAudit.healthScore})
          </span>
        </div>
        <div>
          <span style="font-size:12px;color:#6366f1;">Issues</span><br/>
          <strong>${audit.totalIssuesFound}</strong>
          <span style="font-size:12px;color:${audit.totalIssuesFound < previousAudit.totalIssuesFound ? "#059669" : audit.totalIssuesFound > previousAudit.totalIssuesFound ? "#dc2626" : "#6b7280"}">
            (${audit.totalIssuesFound > previousAudit.totalIssuesFound ? "+" : ""}${audit.totalIssuesFound - previousAudit.totalIssuesFound})
          </span>
        </div>
      </div>
    </div>`
    : "";

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>SEO Audit Report — ${escapeHtml(audit.siteUrl)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 900px; margin: 0 auto; padding: 40px 20px; color: #111827; }
    @media print { body { padding: 0; } }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; padding: 8px; border-bottom: 2px solid #e5e7eb; font-size: 12px; color: #6b7280; text-transform: uppercase; }
  </style>
</head>
<body>
  <div style="display:flex;justify-content:space-between;align-items:flex-start;">
    <div>
      <h1 style="margin:0;font-size:24px;">SEO Audit Report</h1>
      <p style="margin:4px 0 0;color:#6b7280;font-size:14px;">${escapeHtml(audit.siteUrl)} &mdash; ${date}</p>
    </div>
    <div style="text-align:right;">
      <div style="font-size:36px;font-weight:700;color:${audit.healthScore >= 80 ? "#059669" : audit.healthScore >= 60 ? "#ca8a04" : "#dc2626"}">${audit.healthScore}</div>
      <div style="font-size:12px;color:#6b7280;">Health Score</div>
    </div>
  </div>

  <hr style="margin:20px 0;border:none;border-top:1px solid #e5e7eb;"/>

  <!-- Summary -->
  <div style="display:flex;gap:24px;flex-wrap:wrap;">
    <div style="flex:1;min-width:120px;padding:16px;background:#f9fafb;border-radius:8px;text-align:center;">
      <div style="font-size:24px;font-weight:700;">${audit.totalPagesCrawled}</div>
      <div style="font-size:12px;color:#6b7280;">Pages Crawled</div>
    </div>
    <div style="flex:1;min-width:120px;padding:16px;background:#f9fafb;border-radius:8px;text-align:center;">
      <div style="font-size:24px;font-weight:700;">${audit.totalIssuesFound}</div>
      <div style="font-size:12px;color:#6b7280;">Issues Found</div>
    </div>
    <div style="flex:1;min-width:120px;padding:16px;background:#f9fafb;border-radius:8px;text-align:center;">
      <div style="font-size:24px;font-weight:700;">${appliedCount}</div>
      <div style="font-size:12px;color:#6b7280;">Fixes Applied</div>
    </div>
    <div style="flex:1;min-width:120px;padding:16px;background:#f9fafb;border-radius:8px;text-align:center;">
      <div style="font-size:24px;font-weight:700;">$${audit.agencyComparisonCostUsd.toFixed(0)}</div>
      <div style="font-size:12px;color:#6b7280;">Agency Equivalent</div>
    </div>
  </div>

  <!-- Severity breakdown -->
  <div style="margin-top:16px;display:flex;gap:12px;">
    ${severityCounts.critical > 0 ? `<span style="padding:4px 12px;border-radius:12px;font-size:12px;font-weight:600;background:#fef2f2;color:#dc2626;">${severityCounts.critical} Critical</span>` : ""}
    ${severityCounts.high > 0 ? `<span style="padding:4px 12px;border-radius:12px;font-size:12px;font-weight:600;background:#fff7ed;color:#ea580c;">${severityCounts.high} High</span>` : ""}
    ${severityCounts.medium > 0 ? `<span style="padding:4px 12px;border-radius:12px;font-size:12px;font-weight:600;background:#fefce8;color:#ca8a04;">${severityCounts.medium} Medium</span>` : ""}
    ${severityCounts.low > 0 ? `<span style="padding:4px 12px;border-radius:12px;font-size:12px;font-weight:600;background:#eff6ff;color:#2563eb;">${severityCounts.low} Low</span>` : ""}
  </div>

  ${comparisonSection}

  <!-- Issues Table -->
  <h2 style="margin-top:32px;font-size:18px;">Issues (${audit.issues.length})</h2>
  <table>
    <thead>
      <tr>
        <th>Severity</th>
        <th>Issue Type</th>
        <th>Page</th>
        <th>Current</th>
        <th>Suggested Fix</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${issueRows}
    </tbody>
  </table>

  <div style="margin-top:40px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;text-align:center;">
    Generated by SEO Audit App &mdash; ${date}
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `inline; filename="seo-audit-${audit.siteUrl.replace(/https?:\/\//, "").replace(/[^a-zA-Z0-9.-]/g, "_")}-${audit.createdAt.toISOString().slice(0, 10)}.html"`,
    },
  });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + "..." : str;
}
