"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { BalanceBadge } from "@/components/BalanceBadge";
import { BuyCreditsModal } from "@/components/BuyCreditsModal";

interface Connection {
  id: string;
  siteUrl: string;
  wpUsername: string;
  createdAt: string;
}

interface AuditSummary {
  id: string;
  siteUrl: string;
  status: string;
  totalPagesCrawled: number;
  totalIssuesFound: number;
  healthScore: number;
  estimatedCostUsd: number;
  createdAt: string;
  appliedCount: number;
  skippedCount: number;
}

const statusLabels: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending", color: "bg-gray-100 text-gray-600" },
  crawling: { label: "Crawling", color: "bg-blue-100 text-blue-600" },
  analyzing: { label: "Analyzing", color: "bg-yellow-100 text-yellow-700" },
  complete: { label: "Complete", color: "bg-green-100 text-green-700" },
  failed: { label: "Failed", color: "bg-red-100 text-red-600" },
};

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [audits, setAudits] = useState<AuditSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBuyModal, setShowBuyModal] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
    }
  }, [status, router]);

  useEffect(() => {
    async function fetchData() {
      const [connRes, auditsRes] = await Promise.all([
        fetch("/api/wp/connect"),
        fetch("/api/audits"),
      ]);
      if (connRes.ok) setConnections(await connRes.json());
      if (auditsRes.ok) setAudits(await auditsRes.json());
      setLoading(false);
    }
    if (status === "authenticated") fetchData();
  }, [status]);

  if (status === "loading" || loading) {
    return (
      <>
        <Navbar />
        <main className="mx-auto max-w-5xl px-6 py-16">
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-20 animate-pulse rounded-lg bg-gray-100"
              />
            ))}
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-5xl px-6 py-10">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <div className="flex items-center gap-3">
            <BalanceBadge onBuyClick={() => setShowBuyModal(true)} />
            <Link
              href="/connect"
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              + New Audit
            </Link>
          </div>
        </div>

        {/* Audit History */}
        <section className="mt-8">
          <h2 className="mb-4 text-lg font-semibold">Audit History</h2>
          {audits.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 p-10 text-center">
              <div className="text-4xl">🔍</div>
              <p className="mt-2 font-medium text-gray-700">
                No audits yet
              </p>
              <p className="mt-1 text-sm text-gray-500">
                Connect your WordPress site to run your first SEO audit.
              </p>
              <Link
                href="/connect"
                className="mt-4 inline-block rounded-md bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Start Your First Audit
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {audits.map((audit) => {
                const s = statusLabels[audit.status] || statusLabels.pending;
                const pendingCount =
                  audit.totalIssuesFound -
                  audit.appliedCount -
                  audit.skippedCount;

                return (
                  <Link
                    key={audit.id}
                    href={`/audit/${audit.id}`}
                    className="block rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition hover:border-indigo-200 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-gray-900">
                            {audit.siteUrl}
                          </p>
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.color}`}
                          >
                            {s.label}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-gray-500">
                          {new Date(audit.createdAt).toLocaleDateString(
                            undefined,
                            {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            }
                          )}
                        </p>
                      </div>
                      {audit.status === "complete" && (
                        <div className="text-right">
                          <div className="text-2xl font-bold text-gray-900">
                            {audit.healthScore}
                            <span className="text-sm font-normal text-gray-400">
                              /100
                            </span>
                          </div>
                          <p className="text-xs text-gray-500">Health Score</p>
                        </div>
                      )}
                    </div>

                    {audit.status === "complete" && (
                      <div className="mt-3 flex items-center gap-4 text-xs">
                        <span className="text-gray-500">
                          {audit.totalPagesCrawled} pages crawled
                        </span>
                        <span className="text-gray-500">
                          {audit.totalIssuesFound} issues found
                        </span>
                        {audit.appliedCount > 0 && (
                          <span className="text-green-600">
                            {audit.appliedCount} fixed
                          </span>
                        )}
                        {pendingCount > 0 && (
                          <span className="text-orange-600">
                            {pendingCount} pending
                          </span>
                        )}
                        <span className="ml-auto text-gray-400">
                          Est. ${audit.estimatedCostUsd.toFixed(0)} to fix all
                        </span>
                      </div>
                    )}

                    {audit.status === "complete" &&
                      audit.totalIssuesFound > 0 && (
                        <div className="mt-2 h-1.5 rounded-full bg-gray-100">
                          <div
                            className="h-1.5 rounded-full bg-green-500 transition-all"
                            style={{
                              width: `${(audit.appliedCount / audit.totalIssuesFound) * 100}%`,
                            }}
                          />
                        </div>
                      )}
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* Connected Sites */}
        <section className="mt-10">
          <h2 className="mb-4 text-lg font-semibold">Connected Sites</h2>
          {connections.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
              <p className="text-gray-500">No sites connected yet.</p>
              <Link
                href="/connect"
                className="mt-2 inline-block text-sm text-indigo-600 hover:underline"
              >
                Connect your first WordPress site
              </Link>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {connections.map((conn) => (
                <div
                  key={conn.id}
                  className="rounded-lg border border-gray-200 bg-white p-4"
                >
                  <p className="font-medium text-gray-900">{conn.siteUrl}</p>
                  <p className="mt-1 text-xs text-gray-500">
                    {conn.wpUsername} &middot; Connected{" "}
                    {new Date(conn.createdAt).toLocaleDateString()}
                  </p>
                  <Link
                    href={`/connect?site=${encodeURIComponent(conn.siteUrl)}`}
                    className="mt-2 inline-block text-xs text-indigo-600 hover:underline"
                  >
                    Run new audit &rarr;
                  </Link>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      <BuyCreditsModal
        open={showBuyModal}
        onClose={() => setShowBuyModal(false)}
        returnUrl={
          typeof window !== "undefined" ? window.location.href : "/dashboard"
        }
      />
    </>
  );
}
