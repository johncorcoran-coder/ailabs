import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event;
  try {
    event = getStripe().webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const userId = session.metadata?.userId;
    const tokensCredited = parseInt(session.metadata?.tokensCredited || "0");
    const amountUsd = parseFloat(session.metadata?.amountUsd || "0");

    if (!userId || !tokensCredited) {
      return NextResponse.json({ error: "Missing metadata" }, { status: 400 });
    }

    // Credit the user's token balance
    await prisma.tokenBalance.upsert({
      where: { userId },
      create: {
        userId,
        balanceTokens: tokensCredited,
        totalPurchased: amountUsd,
      },
      update: {
        balanceTokens: { increment: tokensCredited },
        totalPurchased: { increment: amountUsd },
      },
    });

    // Record the transaction
    await prisma.transaction.create({
      data: {
        userId,
        stripePaymentIntentId: session.payment_intent as string,
        amountUsd,
        tokensCredited,
      },
    });
  }

  return NextResponse.json({ received: true });
}
