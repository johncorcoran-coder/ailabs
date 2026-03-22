import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/session";
import { testConnection } from "@/lib/wordpress";
import { encrypt } from "@/lib/encryption";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  const session = await getRequiredSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { siteUrl?: string; username?: string; appPassword?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  const { siteUrl, username, appPassword } = body;
  if (!siteUrl || !username || !appPassword) {
    return NextResponse.json(
      { error: "Site URL, username, and application password are required" },
      { status: 400 }
    );
  }

  // Basic URL validation
  let normalizedUrl: string;
  try {
    const parsed = new URL(siteUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return NextResponse.json(
        { error: "Site URL must use http or https protocol" },
        { status: 400 }
      );
    }
    normalizedUrl = parsed.origin + parsed.pathname.replace(/\/+$/, "");
  } catch {
    return NextResponse.json(
      { error: "Invalid URL format. Please enter a valid website URL (e.g., https://example.com)" },
      { status: 400 }
    );
  }

  // Test the connection
  const result = await testConnection({
    siteUrl: normalizedUrl,
    username,
    appPassword,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  // Store the connection with encrypted password
  const connection = await prisma.wPConnection.create({
    data: {
      userId: session.userId,
      siteUrl: normalizedUrl,
      wpUsername: username,
      wpAppPassword: encrypt(appPassword),
    },
  });

  return NextResponse.json({
    id: connection.id,
    siteUrl: connection.siteUrl,
    username: connection.wpUsername,
    capabilities: result.capabilities,
    warning: result.warning,
  });
}

export async function GET() {
  const session = await getRequiredSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const connections = await prisma.wPConnection.findMany({
    where: { userId: session.userId },
    select: { id: true, siteUrl: true, wpUsername: true, createdAt: true },
  });

  return NextResponse.json(connections);
}
