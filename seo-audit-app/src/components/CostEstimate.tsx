"use client";

export function CostEstimate({
  estimatedCostUsd,
  agencyComparisonCostUsd,
}: {
  estimatedCostUsd: number;
  agencyComparisonCostUsd: number;
}) {
  const savings = agencyComparisonCostUsd - estimatedCostUsd;
  const savingsPercent = Math.round(
    (savings / agencyComparisonCostUsd) * 100
  );

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900">Cost Estimate</h3>
      <div className="mt-4 grid grid-cols-2 gap-6">
        <div>
          <p className="text-sm text-gray-500">AI-Powered Fix (this tool)</p>
          <p className="mt-1 text-3xl font-bold text-indigo-600">
            ${estimatedCostUsd.toFixed(2)}
          </p>
          <p className="mt-0.5 text-xs text-gray-400">
            Billed in $50 increments
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Traditional SEO Agency</p>
          <p className="mt-1 text-3xl font-bold text-gray-400 line-through">
            ${agencyComparisonCostUsd.toLocaleString()}
          </p>
          <p className="mt-0.5 text-xs text-gray-400">
            Based on $150/hr industry avg
          </p>
        </div>
      </div>
      <div className="mt-4 rounded-md bg-green-50 px-3 py-2">
        <p className="text-sm font-medium text-green-700">
          You save ~${savings.toLocaleString()} ({savingsPercent}% less)
        </p>
      </div>
    </div>
  );
}
