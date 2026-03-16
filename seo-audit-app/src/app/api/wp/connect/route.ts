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

  const { siteUrl, username, appPassword } = await req.json();
  if (!siteUrl || !username || !appPassword) {
    return NextResponse.json(
      { error: "Site URL, username, and application password are required" },
      { status: 400 }
    );
  }

  // Normalize URL
  const normalizedUrl = siteUrl.replace(/\/+$/, "");

  // Test the connection first
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
  });
}

export async function GET(req: Request) {
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
