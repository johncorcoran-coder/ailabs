"use client";

import { useState } from "react";

export function BuyCreditsModal({
  open,
  onClose,
  returnUrl,
}: {
  open: boolean;
  onClose: () => void;
  returnUrl: string;
}) {
  const [increments, setIncrements] = useState(1);
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const amount = increments * 50;

  async function handlePurchase() {
    setLoading(true);
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ increments, returnUrl }),
    });

    if (res.ok) {
      const { url } = await res.json();
      window.location.href = url;
    } else {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h2 className="text-xl font-bold text-gray-900">Buy Credits</h2>
        <p className="mt-1 text-sm text-gray-500">
          Credits are sold in $50 increments. Choose how many you need.
        </p>

        <div className="mt-6">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Number of increments
          </label>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIncrements(Math.max(1, increments - 1))}
              className="flex h-10 w-10 items-center justify-center rounded-md border border-gray-300 text-lg hover:bg-gray-50"
            >
              -
            </button>
            <span className="w-12 text-center text-2xl font-bold">
              {increments}
            </span>
            <button
              onClick={() => setIncrements(Math.min(20, increments + 1))}
              className="flex h-10 w-10 items-center justify-center rounded-md border border-gray-300 text-lg hover:bg-gray-50"
            >
              +
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-lg bg-gray-50 p-4">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Price per increment</span>
            <span className="font-medium">$50.00</span>
          </div>
          <div className="mt-2 flex justify-between border-t border-gray-200 pt-2">
            <span className="font-medium text-gray-900">Total</span>
            <span className="text-lg font-bold text-indigo-600">
              ${amount}.00
            </span>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={handlePurchase}
            disabled={loading}
            className="flex-1 rounded-md bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? "Redirecting to Stripe..." : `Pay $${amount}.00`}
          </button>
          <button
            onClick={onClose}
            className="rounded-md border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
