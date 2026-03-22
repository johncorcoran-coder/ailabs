import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/session";
import { createCheckoutSession } from "@/lib/stripe";

export async function POST(req: Request) {
  const session = await getRequiredSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { increments, returnUrl } = await req.json();

  if (!increments || increments < 1 || increments > 20) {
    return NextResponse.json(
      { error: "Please select between 1 and 20 credit increments ($50 each)" },
      { status: 400 }
    );
  }

  const checkoutUrl = await createCheckoutSession({
    userId: session.userId,
    email: session.email,
    increments,
    returnUrl: returnUrl || `${process.env.NEXTAUTH_URL}/dashboard`,
  });

  return NextResponse.json({ url: checkoutUrl });
}
