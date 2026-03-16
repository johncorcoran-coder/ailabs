"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { AuditSummary } from "@/components/AuditReport";
import { CostEstimate } from "@/components/CostEstimate";
import { IssueCard } from "@/components/IssueCard";

interface Issue {
  id: string;
  pageUrl: string;
  issueType: string;
  severity: string;
  priorityRank: number;
  currentValue: string;
  suggestedValue: string;
  userModifiedValue: string | null;
  status: string;
}

interface AuditData {
  id: string;
  siteUrl: string;
  status: string;
  totalPagesCrawled: number;
  totalIssuesFound: number;
  healthScore: number;
  estimatedCostUsd: number;
  agencyComparisonCostUsd: number;
  issues: Issue[];
}

export default function AuditPage() {
  const params = useParams();
  const [audit, setAudit] = useState<AuditData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  const fetchAudit = useCallback(async () => {
    const res = await fetch(`/api/audit/${params.id}`);
    if (res.ok) {
      setAudit(await res.json());
    }
    setLoading(false);
  }, [params.id]);

  useEffect(() => {
    fetchAudit();
  }, [fetchAudit]);

  async function handleApprove(issueId: string, value: string) {
    // In Phase 1, just update status locally (Phase 2 will apply to WP)
    if (!audit) return;
    setAudit({
      ...audit,
      issues: audit.issues.map((i) =>
        i.id === issueId
          ? { ...i, status: "applied", userModifiedValue: value }
          : i
      ),
    });
  }

  async function handleSkip(issueId: string) {
    if (!audit) return;
    setAudit({
      ...audit,
      issues: audit.issues.map((i) =>
        i.id === issueId ? { ...i, status: "skipped" } : i
      ),
    });
  }

  if (loading) {
    return (
      <>
        <Navbar />
        <main className="mx-auto max-w-4xl px-6 py-16 text-center">
          <p className="text-gray-500">Loading audit results...</p>
        </main>
      </>
    );
  }

  if (!audit) {
    return (
      <>
        <Navbar />
        <main className="mx-auto max-w-4xl px-6 py-16 text-center">
          <p className="text-red-600">Audit not found</p>
        </main>
      </>
    );
  }

  const severityCounts = {
    critical: audit.issues.filter((i) => i.severity === "critical").length,
    high: audit.issues.filter((i) => i.severity === "high").length,
    medium: audit.issues.filter((i) => i.severity === "medium").length,
    low: audit.issues.filter((i) => i.severity === "low").length,
  };

  const filteredIssues =
    filter === "all"
      ? audit.issues
      : audit.issues.filter((i) => i.severity === filter);

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="mb-1 text-2xl font-bold">Audit Report</h1>
        <p className="mb-8 text-sm text-gray-500">{audit.siteUrl}</p>

        <div className="space-y-6">
          {/* Summary */}
          <AuditSummary
            healthScore={audit.healthScore}
            totalPagesCrawled={audit.totalPagesCrawled}
            totalIssuesFound={audit.totalIssuesFound}
            criticalCount={severityCounts.critical}
            highCount={severityCounts.high}
            mediumCount={severityCounts.medium}
            lowCount={severityCounts.low}
          />

          {/* Cost Estimate */}
          <CostEstimate
            estimatedCostUsd={audit.estimatedCostUsd}
            agencyComparisonCostUsd={audit.agencyComparisonCostUsd}
          />

          {/* Filter */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Filter:</span>
            {["all", "critical", "high", "medium", "low"].map((sev) => (
              <button
                key={sev}
                onClick={() => setFilter(sev)}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  filter === sev
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {sev === "all" ? "All" : sev.charAt(0).toUpperCase() + sev.slice(1)}
              </button>
            ))}
          </div>

          {/* Issues list */}
          <div className="space-y-3">
            {filteredIssues.map((issue) => (
              <IssueCard
                key={issue.id}
                issue={issue}
                onApprove={handleApprove}
                onSkip={handleSkip}
              />
            ))}
            {filteredIssues.length === 0 && (
              <p className="py-8 text-center text-gray-400">
                No issues found for this filter.
              </p>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
