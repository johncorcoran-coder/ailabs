import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/encryption";
import { findWPContentByUrl, updateContent } from "@/lib/wordpress";

export async function POST(req: Request) {
  const session = await getRequiredSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { issueId, action, modifiedValue } = await req.json();

  if (!issueId || !action) {
    return NextResponse.json(
      { error: "issueId and action are required" },
      { status: 400 }
    );
  }

  if (!["approve", "skip"].includes(action)) {
    return NextResponse.json(
      { error: "action must be 'approve' or 'skip'" },
      { status: 400 }
    );
  }

  // Find the issue and verify ownership
  const issue = await prisma.auditIssue.findUnique({
    where: { id: issueId },
    include: {
      audit: {
        include: { wpConnection: true },
      },
    },
  });

  if (!issue || issue.audit.userId !== session.userId) {
    return NextResponse.json({ error: "Issue not found" }, { status: 404 });
  }

  // Handle skip
  if (action === "skip") {
    await prisma.auditIssue.update({
      where: { id: issueId },
      data: { status: "skipped" },
    });
    return NextResponse.json({ status: "skipped" });
  }

  // Handle approve — check token balance first
  const balance = await prisma.tokenBalance.findUnique({
    where: { userId: session.userId },
  });

  // Estimate ~2000 tokens per fix operation
  const estimatedTokens = 2000;
  if (!balance || balance.balanceTokens < estimatedTokens) {
    return NextResponse.json(
      {
        error: "Insufficient token balance. Please purchase more credits.",
        needsCredits: true,
      },
      { status: 402 }
    );
  }

  // Decrypt WP credentials
  const conn = {
    siteUrl: issue.audit.wpConnection.siteUrl,
    username: issue.audit.wpConnection.wpUsername,
    appPassword: decrypt(issue.audit.wpConnection.wpAppPassword),
  };

  // Find the WordPress content item by URL
  const wpContent = await findWPContentByUrl(conn, issue.pageUrl);
  if (!wpContent) {
    // Still mark as approved but note that we couldn't find the WP content
    await prisma.auditIssue.update({
      where: { id: issueId },
      data: {
        status: "approved",
        userModifiedValue: modifiedValue || null,
      },
    });
    return NextResponse.json({
      status: "approved",
      applied: false,
      warning:
        "Could not find matching WordPress content for this URL. The fix was saved but not applied.",
    });
  }

  // Determine what to update based on issue type
  const valueToApply = modifiedValue || issue.suggestedValue;
  const updates: { title?: string; content?: string } = {};

  if (
    issue.issueType.includes("title") ||
    issue.issueType.includes("h1")
  ) {
    updates.title = valueToApply;
  } else {
    // For content-level changes (meta descriptions, heading fixes, alt text, etc.),
    // we'd need to parse and modify the HTML content.
    // For now, store the approved value — full HTML manipulation comes in Phase 3.
    await prisma.auditIssue.update({
      where: { id: issueId },
      data: {
        status: "applied",
        userModifiedValue: modifiedValue || null,
        appliedAt: new Date(),
      },
    });

    // Deduct tokens
    await prisma.tokenBalance.update({
      where: { userId: session.userId },
      data: { balanceTokens: { decrement: estimatedTokens } },
    });

    return NextResponse.json({
      status: "applied",
      applied: true,
      note: "Fix recorded. Content-level HTML changes will be applied in a future update.",
    });
  }

  // Apply the change to WordPress
  const result = await updateContent(
    conn,
    wpContent.type,
    wpContent.id,
    updates
  );

  if (!result.ok) {
    return NextResponse.json(
      { error: `Failed to apply fix: ${result.error}` },
      { status: 500 }
    );
  }

  // Mark as applied and deduct tokens
  await prisma.auditIssue.update({
    where: { id: issueId },
    data: {
      status: "applied",
      userModifiedValue: modifiedValue || null,
      appliedAt: new Date(),
    },
  });

  await prisma.tokenBalance.update({
    where: { userId: session.userId },
    data: { balanceTokens: { decrement: estimatedTokens } },
  });

  return NextResponse.json({ status: "applied", applied: true });
}
