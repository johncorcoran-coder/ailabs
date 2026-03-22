import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/session";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getRequiredSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const balance = await prisma.tokenBalance.findUnique({
    where: { userId: session.userId },
  });

  return NextResponse.json({
    balanceTokens: balance?.balanceTokens ?? 0,
    totalPurchased: balance?.totalPurchased ?? 0,
  });
}
