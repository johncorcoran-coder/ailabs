"use client";

interface AuditSummaryProps {
  healthScore: number;
  totalPagesCrawled: number;
  totalIssuesFound: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
}

function scoreColor(score: number): string {
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-yellow-600";
  return "text-red-600";
}

function scoreBg(score: number): string {
  if (score >= 80) return "bg-green-100";
  if (score >= 60) return "bg-yellow-100";
  return "bg-red-100";
}

export function AuditSummary({
  healthScore,
  totalPagesCrawled,
  totalIssuesFound,
  criticalCount,
  highCount,
  mediumCount,
  lowCount,
}: AuditSummaryProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-6">
        {/* Health Score */}
        <div
          className={`flex h-24 w-24 flex-shrink-0 items-center justify-center rounded-full ${scoreBg(healthScore)}`}
        >
          <div className="text-center">
            <p className={`text-3xl font-bold ${scoreColor(healthScore)}`}>
              {healthScore}
            </p>
            <p className="text-xs text-gray-500">/ 100</p>
          </div>
        </div>

        <div className="flex-1">
          <h3 className="text-lg font-semibold">SEO Health Score</h3>
          <p className="mt-1 text-sm text-gray-500">
            Crawled {totalPagesCrawled} pages, found {totalIssuesFound} issues
          </p>

          {/* Severity breakdown */}
          <div className="mt-3 flex gap-4">
            {criticalCount > 0 && (
              <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
                {criticalCount} critical
              </span>
            )}
            {highCount > 0 && (
              <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-700">
                {highCount} high
              </span>
            )}
            {mediumCount > 0 && (
              <span className="rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-700">
                {mediumCount} medium
              </span>
            )}
            {lowCount > 0 && (
              <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                {lowCount} low
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
