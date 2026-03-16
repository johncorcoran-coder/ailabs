"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { AuditSummary } from "@/components/AuditReport";
import { CostEstimate } from "@/components/CostEstimate";
import { IssueCard } from "@/components/IssueCard";
import { BalanceBadge } from "@/components/BalanceBadge";
import { BuyCreditsModal } from "@/components/BuyCreditsModal";

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
  const searchParams = useSearchParams();
  const [audit, setAudit] = useState<AuditData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

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

  // Show payment result notification
  useEffect(() => {
    const payment = searchParams.get("payment");
    if (payment === "success") {
      setNotification({
        type: "success",
        message: "Payment successful! Credits have been added to your account.",
      });
    } else if (payment === "cancelled") {
      setNotification({
        type: "info",
        message: "Payment was cancelled.",
      });
    }
  }, [searchParams]);

  async function handleApprove(issueId: string, value: string) {
    setApplyingId(issueId);
    setNotification(null);

    const res = await fetch("/api/fix", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        issueId,
        action: "approve",
        modifiedValue: value,
      }),
    });

    const data = await res.json();

    if (res.status === 402) {
      // Needs credits
      setShowBuyModal(true);
      setApplyingId(null);
      return;
    }

    if (!res.ok) {
      setNotification({ type: "error", message: data.error || "Failed to apply fix" });
      setApplyingId(null);
      return;
    }

    // Update local state
    if (audit) {
      setAudit({
        ...audit,
        issues: audit.issues.map((i) =>
          i.id === issueId
            ? { ...i, status: "applied", userModifiedValue: value }
            : i
        ),
      });
    }

    if (data.warning) {
      setNotification({ type: "info", message: data.warning });
    } else if (data.note) {
      setNotification({ type: "success", message: data.note });
    } else {
      setNotification({
        type: "success",
        message: "Fix applied to your WordPress site!",
      });
    }

    setApplyingId(null);
  }

  async function handleSkip(issueId: string) {
    setApplyingId(issueId);

    const res = await fetch("/api/fix", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ issueId, action: "skip" }),
    });

    if (res.ok && audit) {
      setAudit({
        ...audit,
        issues: audit.issues.map((i) =>
          i.id === issueId ? { ...i, status: "skipped" } : i
        ),
      });
    }

    setApplyingId(null);
  }

  if (loading) {
    return (
      <>
        <Navbar />
        <main className="mx-auto max-w-4xl px-6 py-16 text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
          <p className="mt-4 text-gray-500">Loading audit results...</p>
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

  const appliedCount = audit.issues.filter((i) => i.status === "applied").length;
  const pendingCount = audit.issues.filter((i) => i.status === "pending").length;

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-4xl px-6 py-10">
        {/* Header with balance */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="mb-1 text-2xl font-bold">Audit Report</h1>
            <p className="text-sm text-gray-500">{audit.siteUrl}</p>
          </div>
          <BalanceBadge onBuyClick={() => setShowBuyModal(true)} />
        </div>

        {/* Notification banner */}
        {notification && (
          <div
            className={`mt-4 rounded-md p-3 text-sm ${
              notification.type === "success"
                ? "bg-green-50 text-green-700"
                : notification.type === "error"
                  ? "bg-red-50 text-red-700"
                  : "bg-blue-50 text-blue-700"
            }`}
          >
            {notification.message}
            <button
              onClick={() => setNotification(null)}
              className="ml-2 font-medium underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Progress bar */}
        {appliedCount > 0 && (
          <div className="mt-4 rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">
                {appliedCount} of {audit.totalIssuesFound} fixes applied
              </span>
              <span className="font-medium text-indigo-600">
                {pendingCount} remaining
              </span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-gray-100">
              <div
                className="h-2 rounded-full bg-indigo-600 transition-all"
                style={{
                  width: `${(appliedCount / audit.totalIssuesFound) * 100}%`,
                }}
              />
            </div>
          </div>
        )}

        <div className="mt-6 space-y-6">
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

          {/* Buy credits CTA */}
          <div className="flex items-center justify-between rounded-lg border border-indigo-200 bg-indigo-50 p-4">
            <div>
              <p className="text-sm font-medium text-indigo-900">
                Ready to fix your site?
              </p>
              <p className="text-xs text-indigo-600">
                Purchase credits to start applying fixes to your WordPress site.
              </p>
            </div>
            <button
              onClick={() => setShowBuyModal(true)}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Buy Credits
            </button>
          </div>

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
                {sev === "all"
                  ? "All"
                  : sev.charAt(0).toUpperCase() + sev.slice(1)}
              </button>
            ))}
          </div>

          {/* Issues list */}
          <div className="space-y-3">
            {filteredIssues.map((issue) => (
              <div key={issue.id} className="relative">
                {applyingId === issue.id && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-white/70">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
                  </div>
                )}
                <IssueCard
                  issue={issue}
                  onApprove={handleApprove}
                  onSkip={handleSkip}
                />
              </div>
            ))}
            {filteredIssues.length === 0 && (
              <p className="py-8 text-center text-gray-400">
                No issues found for this filter.
              </p>
            )}
          </div>
        </div>
      </main>

      {/* Buy credits modal */}
      <BuyCreditsModal
        open={showBuyModal}
        onClose={() => setShowBuyModal(false)}
        returnUrl={
          typeof window !== "undefined"
            ? window.location.href.split("?")[0]
            : ""
        }
      />
    </>
  );
}
