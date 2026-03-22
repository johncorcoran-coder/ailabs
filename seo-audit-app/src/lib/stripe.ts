import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2026-02-25.clover",
    });
  }
  return _stripe;
}

export { _stripe as stripe };

// Each credit increment is $50
export const CREDIT_INCREMENT_USD = 50;

// How many "token credits" the user gets per $50
// This is an internal unit — 1 credit = roughly 1 Claude API token worth of usage
// At our 2.5x markup, $50 buys about 5.5M input tokens or 1.1M output tokens
export const TOKENS_PER_INCREMENT = 5_000_000;

export async function createCheckoutSession({
  userId,
  email,
  increments,
  returnUrl,
}: {
  userId: string;
  email: string;
  increments: number;
  returnUrl: string;
}): Promise<string> {
  const amount = increments * CREDIT_INCREMENT_USD;
  const tokens = increments * TOKENS_PER_INCREMENT;

  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    customer_email: email,
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: amount * 100, // Stripe uses cents
          product_data: {
            name: "SEO Audit Credits",
            description: `${tokens.toLocaleString()} token credits for AI-powered SEO fixes`,
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      userId,
      tokensCredited: tokens.toString(),
      amountUsd: amount.toString(),
    },
    success_url: `${returnUrl}?payment=success`,
    cancel_url: `${returnUrl}?payment=cancelled`,
  });

  return session.url!;
}
