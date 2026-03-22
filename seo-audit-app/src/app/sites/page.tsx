"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";

interface Connection {
  id: string;
  siteUrl: string;
  wpUsername: string;
  createdAt: string;
}

interface AuditSchedule {
  id: string;
  wpConnectionId: string;
  frequency: string;
  enabled: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  wpConnection: { siteUrl: string };
}

interface HistoryPoint {
  id: string;
  healthScore: number;
  totalIssuesFound: number;
  fixedCount: number;
  createdAt: string;
}

interface SiteHistory {
  siteUrl: string;
  history: HistoryPoint[];
}

export default function SitesPage() {
  const { status } = useSession();
  const router = useRouter();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [schedules, setSchedules] = useState<AuditSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSite, setExpandedSite] = useState<string | null>(null);
  const [siteHistory, setSiteHistory] = useState<Record<string, SiteHistory>>(
    {}
  );
  const [savingSchedule, setSavingSchedule] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth/login");
  }, [status, router]);

  useEffect(() => {
    async function fetchData() {
      const [connRes, schedRes] = await Promise.all([
        fetch("/api/wp/connect"),
        fetch("/api/schedules"),
      ]);
      if (connRes.ok) setConnections(await connRes.json());
      if (schedRes.ok) setSchedules(await schedRes.json());
      setLoading(false);
    }
    if (status === "authenticated") fetchData();
  }, [status]);

  async function loadHistory(connectionId: string) {
    if (siteHistory[connectionId]) return;
    const res = await fetch(`/api/sites/${connectionId}/history`);
    if (res.ok) {
      const data: SiteHistory = await res.json();
      setSiteHistory((prev) => ({ ...prev, [connectionId]: data }));
    }
  }

  function toggleExpand(connectionId: string) {
    if (expandedSite === connectionId) {
      setExpandedSite(null);
    } else {
      setExpandedSite(connectionId);
      loadHistory(connectionId);
    }
  }

  async function handleScheduleToggle(
    connectionId: string,
    frequency: string,
    enabled: boolean
  ) {
    setSavingSchedule(connectionId);
    const res = await fetch("/api/schedules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        wpConnectionId: connectionId,
        frequency,
        enabled,
      }),
    });
    if (res.ok) {
      const schedule: AuditSchedule = await res.json();
      setSchedules((prev) => {
        const existing = prev.findIndex(
          (s) => s.wpConnectionId === connectionId
        );
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = { ...schedule, wpConnection: { siteUrl: "" } };
          return updated;
        }
        return [...prev, { ...schedule, wpConnection: { siteUrl: "" } }];
      });
    }
    setSavingSchedule(null);
  }

  if (status === "loading" || loading) {
    return (
      <>
        <Navbar />
        <main className="mx-auto max-w-5xl px-6 py-16">
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-28 animate-pulse rounded-lg bg-gray-100"
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Site Management</h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage all your connected WordPress sites, view score history, and
              configure automated re-audits.
            </p>
          </div>
          <Link
            href="/connect"
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            + Add Site
          </Link>
        </div>

        {connections.length === 0 ? (
          <div className="mt-10 rounded-lg border border-dashed border-gray-300 p-12 text-center">
            <p className="font-medium text-gray-700">No sites connected yet</p>
            <p className="mt-1 text-sm text-gray-500">
              Connect your first WordPress site to get started.
            </p>
            <Link
              href="/connect"
              className="mt-4 inline-block rounded-md bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Connect Site
            </Link>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {connections.map((conn) => {
              const schedule = schedules.find(
                (s) => s.wpConnectionId === conn.id
              );
              const history = siteHistory[conn.id];
              const isExpanded = expandedSite === conn.id;

              return (
                <div
                  key={conn.id}
                  className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm"
                >
                  {/* Site Header */}
                  <div
                    className="flex cursor-pointer items-center justify-between p-5 hover:bg-gray-50"
                    onClick={() => toggleExpand(conn.id)}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-900">
                          {conn.siteUrl}
                        </p>
                        {schedule?.enabled && (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                            Auto-audit: {schedule.frequency}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        {conn.wpUsername} &middot; Connected{" "}
                        {new Date(conn.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/connect?site=${encodeURIComponent(conn.siteUrl)}`}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded-md border border-indigo-200 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
                      >
                        Run Audit
                      </Link>
                      <span className="text-gray-400">
                        {isExpanded ? "\u25B2" : "\u25BC"}
                      </span>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 bg-gray-50 p-5">
                      {/* Schedule Controls */}
                      <div className="mb-5 rounded-lg border border-gray-200 bg-white p-4">
                        <h3 className="text-sm font-semibold text-gray-900">
                          Automated Re-audits
                        </h3>
                        <div className="mt-3 flex items-center gap-4">
                          <select
                            value={schedule?.frequency || "monthly"}
                            onChange={(e) =>
                              handleScheduleToggle(
                                conn.id,
                                e.target.value,
                                schedule?.enabled !== false
                              )
                            }
                            disabled={savingSchedule === conn.id}
                            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                          >
                            <option value="weekly">Weekly</option>
                            <option value="biweekly">Every 2 Weeks</option>
                            <option value="monthly">Monthly</option>
                          </select>
                          <button
                            onClick={() =>
                              handleScheduleToggle(
                                conn.id,
                                schedule?.frequency || "monthly",
                                !schedule?.enabled
                              )
                            }
                            disabled={savingSchedule === conn.id}
                            className={`rounded-md px-4 py-1.5 text-sm font-medium ${
                              schedule?.enabled
                                ? "bg-red-50 text-red-600 hover:bg-red-100"
                                : "bg-green-50 text-green-600 hover:bg-green-100"
                            }`}
                          >
                            {savingSchedule === conn.id
                              ? "Saving..."
                              : schedule?.enabled
                                ? "Disable"
                                : "Enable"}
                          </button>
                          {schedule?.nextRunAt && schedule.enabled && (
                            <span className="text-xs text-gray-500">
                              Next run:{" "}
                              {new Date(
                                schedule.nextRunAt
                              ).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Score History */}
                      <h3 className="text-sm font-semibold text-gray-900">
                        Score History
                      </h3>
                      {!history ? (
                        <div className="mt-3 flex items-center gap-2 text-sm text-gray-400">
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-200 border-t-gray-500" />
                          Loading history...
                        </div>
                      ) : history.history.length === 0 ? (
                        <p className="mt-3 text-sm text-gray-400">
                          No completed audits yet.
                        </p>
                      ) : (
                        <div className="mt-3">
                          {/* Bar chart visualization */}
                          <div className="flex items-end gap-1" style={{ height: 120 }}>
                            {history.history.map((point, idx) => {
                              const barHeight = Math.max(
                                4,
                                (point.healthScore / 100) * 100
                              );
                              const color =
                                point.healthScore >= 80
                                  ? "bg-green-500"
                                  : point.healthScore >= 60
                                    ? "bg-yellow-500"
                                    : "bg-red-500";
                              const prevScore =
                                idx > 0
                                  ? history.history[idx - 1].healthScore
                                  : null;
                              const diff =
                                prevScore !== null
                                  ? point.healthScore - prevScore
                                  : null;

                              return (
                                <div
                                  key={point.id}
                                  className="group relative flex flex-1 flex-col items-center"
                                >
                                  {/* Tooltip */}
                                  <div className="pointer-events-none absolute -top-16 z-10 hidden whitespace-nowrap rounded bg-gray-800 px-2 py-1 text-xs text-white shadow-lg group-hover:block">
                                    <p className="font-semibold">
                                      Score: {point.healthScore}
                                      {diff !== null && (
                                        <span
                                          className={
                                            diff > 0
                                              ? "text-green-400"
                                              : diff < 0
                                                ? "text-red-400"
                                                : "text-gray-400"
                                          }
                                        >
                                          {" "}
                                          ({diff > 0 ? "+" : ""}
                                          {diff})
                                        </span>
                                      )}
                                    </p>
                                    <p>
                                      {point.totalIssuesFound} issues,{" "}
                                      {point.fixedCount} fixed
                                    </p>
                                    <p className="text-gray-400">
                                      {new Date(
                                        point.createdAt
                                      ).toLocaleDateString()}
                                    </p>
                                  </div>
                                  <div
                                    className={`w-full max-w-[32px] rounded-t ${color} cursor-pointer transition-all hover:opacity-80`}
                                    style={{ height: `${barHeight}%` }}
                                  />
                                  <span className="mt-1 text-[10px] text-gray-400">
                                    {new Date(
                                      point.createdAt
                                    ).toLocaleDateString(undefined, {
                                      month: "short",
                                      day: "numeric",
                                    })}
                                  </span>
                                </div>
                              );
                            })}
                          </div>

                          {/* History table */}
                          <div className="mt-4 space-y-2">
                            {history.history
                              .slice()
                              .reverse()
                              .slice(0, 5)
                              .map((point, idx, arr) => {
                                const prev =
                                  idx < arr.length - 1 ? arr[idx + 1] : null;
                                const diff = prev
                                  ? point.healthScore - prev.healthScore
                                  : null;
                                return (
                                  <Link
                                    key={point.id}
                                    href={`/audit/${point.id}`}
                                    className="flex items-center justify-between rounded-lg bg-white p-3 text-sm hover:bg-indigo-50"
                                  >
                                    <span className="text-gray-500">
                                      {new Date(
                                        point.createdAt
                                      ).toLocaleDateString(undefined, {
                                        month: "short",
                                        day: "numeric",
                                        year: "numeric",
                                      })}
                                    </span>
                                    <span className="font-semibold">
                                      {point.healthScore}/100
                                      {diff !== null && diff !== 0 && (
                                        <span
                                          className={`ml-1 text-xs ${diff > 0 ? "text-green-600" : "text-red-600"}`}
                                        >
                                          ({diff > 0 ? "+" : ""}
                                          {diff})
                                        </span>
                                      )}
                                    </span>
                                    <span className="text-gray-400">
                                      {point.totalIssuesFound} issues
                                    </span>
                                  </Link>
                                );
                              })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
