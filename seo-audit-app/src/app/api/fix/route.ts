import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/encryption";
import {
  findWPContentByUrl,
  updateContent,
  fetchContentById,
} from "@/lib/wordpress";
import { applyHtmlFix } from "@/lib/html-fixer";

export async function POST(req: Request) {
  const session = await getRequiredSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { issueId?: string; action?: string; modifiedValue?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  const { issueId, action, modifiedValue } = body;

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
  let conn: { siteUrl: string; username: string; appPassword: string };
  try {
    conn = {
      siteUrl: issue.audit.wpConnection.siteUrl,
      username: issue.audit.wpConnection.wpUsername,
      appPassword: decrypt(issue.audit.wpConnection.wpAppPassword),
    };
  } catch {
    return NextResponse.json(
      {
        error:
          "Could not decrypt WordPress credentials. The encryption key may have changed. Please reconnect your site.",
      },
      { status: 500 }
    );
  }

  // Find the WordPress content item by URL
  let wpContent: { id: number; type: "pages" | "posts" } | null;
  try {
    wpContent = await findWPContentByUrl(conn, issue.pageUrl);
  } catch (err) {
    return NextResponse.json(
      {
        error: `Could not reach WordPress: ${err instanceof Error ? err.message : "Unknown error"}. Please verify the site is accessible.`,
      },
      { status: 502 }
    );
  }

  if (!wpContent) {
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
        "Could not find matching WordPress content for this URL. The fix was saved but not applied. The page may have been deleted or its URL structure changed.",
    });
  }

  // Determine what to update based on issue type
  const valueToApply = modifiedValue || issue.suggestedValue;
  const updates: { title?: string; content?: string } = {};

  if (issue.issueType.includes("title")) {
    updates.title = valueToApply;
  } else {
    // Content-level HTML changes
    let currentContent: string | null;
    try {
      currentContent = await fetchContentById(
        conn,
        wpContent.type,
        wpContent.id
      );
    } catch (err) {
      return NextResponse.json(
        {
          error: `Could not fetch current content from WordPress: ${err instanceof Error ? err.message : "Unknown error"}`,
        },
        { status: 502 }
      );
    }

    if (!currentContent) {
      await prisma.auditIssue.update({
        where: { id: issueId },
        data: { status: "approved", userModifiedValue: modifiedValue || null },
      });
      return NextResponse.json({
        status: "approved",
        applied: false,
        warning:
          "Could not fetch current content from WordPress. The fix was saved but not applied.",
      });
    }

    const { html: fixedHtml, modified } = applyHtmlFix(
      currentContent,
      issue.issueType,
      issue.currentValue,
      valueToApply
    );

    if (modified) {
      updates.content = fixedHtml;
    } else {
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
      return NextResponse.json({
        status: "applied",
        applied: true,
        note: "Fix recorded. Could not auto-apply this change to the HTML content.",
      });
    }
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
      { status: 502 }
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
