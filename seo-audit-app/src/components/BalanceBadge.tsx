"use client";

import { useEffect, useState } from "react";

export function BalanceBadge({ onBuyClick }: { onBuyClick: () => void }) {
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    async function fetchBalance() {
      const res = await fetch("/api/balance");
      if (res.ok) {
        const data = await res.json();
        setBalance(data.balanceTokens);
      }
    }
    fetchBalance();
  }, []);

  if (balance === null) return null;

  // Convert tokens to approximate dollar value (tokens / 5M * $50)
  const dollarValue = ((balance / 5_000_000) * 50).toFixed(2);

  return (
    <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2">
      <div>
        <p className="text-xs text-gray-500">Credit Balance</p>
        <p className="text-sm font-semibold text-gray-900">~${dollarValue}</p>
      </div>
      <button
        onClick={onBuyClick}
        className="rounded-md bg-indigo-100 px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-200"
      >
        + Add
      </button>
    </div>
  );
}
