import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/session";
import { prisma } from "@/lib/db";

const VALID_FREQUENCIES = ["weekly", "biweekly", "monthly"] as const;

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

// GET — list all schedules for the user
export async function GET() {
  const session = await getRequiredSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const schedules = await prisma.auditSchedule.findMany({
    where: { userId: session.userId },
    include: {
      wpConnection: {
        select: { siteUrl: true, wpUsername: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(schedules);
}

// POST — create or update a schedule
export async function POST(req: Request) {
  const session = await getRequiredSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { wpConnectionId, frequency, enabled } = body as {
    wpConnectionId?: string;
    frequency?: string;
    enabled?: boolean;
  };

  if (!wpConnectionId) {
    return NextResponse.json(
      { error: "wpConnectionId is required" },
      { status: 400 }
    );
  }

  const freq = frequency || "monthly";
  if (!VALID_FREQUENCIES.includes(freq as (typeof VALID_FREQUENCIES)[number])) {
    return NextResponse.json(
      { error: `Invalid frequency. Must be one of: ${VALID_FREQUENCIES.join(", ")}` },
      { status: 400 }
    );
  }

  // Verify ownership
  const connection = await prisma.wPConnection.findFirst({
    where: { id: wpConnectionId, userId: session.userId },
  });
  if (!connection) {
    return NextResponse.json(
      { error: "WordPress connection not found" },
      { status: 404 }
    );
  }

  // Upsert schedule (one per connection)
  const schedule = await prisma.auditSchedule.upsert({
    where: { wpConnectionId },
    create: {
      wpConnectionId,
      userId: session.userId,
      frequency: freq,
      enabled: enabled !== false,
      nextRunAt: getNextRunDate(freq),
    },
    update: {
      frequency: freq,
      enabled: enabled !== false,
      nextRunAt: enabled === false ? null : getNextRunDate(freq),
    },
  });

  return NextResponse.json(schedule);
}

// DELETE — remove a schedule
export async function DELETE(req: Request) {
  const session = await getRequiredSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const scheduleId = searchParams.get("id");

  if (!scheduleId) {
    return NextResponse.json(
      { error: "id query parameter is required" },
      { status: 400 }
    );
  }

  const schedule = await prisma.auditSchedule.findFirst({
    where: { id: scheduleId, userId: session.userId },
  });
  if (!schedule) {
    return NextResponse.json(
      { error: "Schedule not found" },
      { status: 404 }
    );
  }

  await prisma.auditSchedule.delete({ where: { id: scheduleId } });

  return NextResponse.json({ deleted: true });
}
