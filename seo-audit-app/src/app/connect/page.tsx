"use client";

import { Suspense, useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Navbar } from "@/components/Navbar";

type Step = "form" | "starting" | "crawling" | "analyzing" | "done" | "error";

interface AuditProgress {
  status: string;
  progressMessage: string | null;
  progressPercent: number;
  totalUrlsDiscovered: number;
  totalPagesCrawled: number;
  pagesCrawledSoFar: number;
  pagesAnalyzedSoFar: number;
  totalIssuesFound: number;
  healthScore: number;
  errorDetails: string | null;
}

export default function ConnectPageWrapper() {
  return (
    <Suspense>
      <ConnectPage />
    </Suspense>
  );
}

function ConnectPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillSite = searchParams.get("site") || "";

  const [siteUrl, setSiteUrl] = useState(prefillSite);
  const [username, setUsername] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [error, setError] = useState("");
  const [errorDetails, setErrorDetails] = useState("");
  const [warning, setWarning] = useState("");
  const [step, setStep] = useState<Step>("form");
  const [auditId, setAuditId] = useState<string | null>(null);
  const [progress, setProgress] = useState<AuditProgress | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const startPolling = useCallback(
    (id: string) => {
      if (pollRef.current) clearInterval(pollRef.current);

      pollRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/audit/progress?auditId=${id}`);
          if (!res.ok) return;
          const data: AuditProgress = await res.json();
          setProgress(data);

          // Update step based on status
          if (data.status === "crawling") {
            setStep("crawling");
          } else if (data.status === "analyzing") {
            setStep("analyzing");
          } else if (data.status === "complete") {
            setStep("done");
            if (pollRef.current) clearInterval(pollRef.current);
            setTimeout(() => router.push(`/audit/${id}`), 1200);
          } else if (data.status === "failed") {
            setStep("error");
            setError(data.progressMessage || "Audit failed");
            setErrorDetails(data.errorDetails || "");
            if (pollRef.current) clearInterval(pollRef.current);
          }
        } catch {
          // Network error during poll — don't stop polling, it may recover
        }
      }, 1500);
    },
    [router]
  );

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setErrorDetails("");
    setProgress(null);

    // Step 1: Connect to WordPress
    setStep("starting");
    let connectRes: Response;
    try {
      connectRes = await fetch("/api/wp/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteUrl, username, appPassword }),
      });
    } catch {
      setError("Network error. Please check your connection and try again.");
      setStep("error");
      return;
    }

    if (!connectRes.ok) {
      const data = await connectRes.json().catch(() => ({}));
      setError(
        (data as { error?: string }).error || "Connection failed"
      );
      setErrorDetails(getWPErrorHelp(connectRes.status, (data as { error?: string }).error));
      setStep("error");
      return;
    }

    const connectData = await connectRes.json();
    const { id: wpConnectionId } = connectData;
    if (connectData.warning) {
      setWarning(connectData.warning);
    }

    // Step 2: Start crawl + analysis (async — returns immediately)
    setStep("crawling");
    let crawlRes: Response;
    try {
      crawlRes = await fetch("/api/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wpConnectionId }),
      });
    } catch {
      setError("Network error starting the audit. Please try again.");
      setStep("error");
      return;
    }

    if (!crawlRes.ok) {
      const data = await crawlRes.json().catch(() => ({}));
      setError((data as { error?: string }).error || "Failed to start audit");
      setStep("error");
      return;
    }

    const { auditId: newAuditId } = await crawlRes.json();
    setAuditId(newAuditId);

    // Start polling for progress
    startPolling(newAuditId);
  }

  async function handleRetry() {
    if (!auditId) {
      // If no audit was created, restart from scratch
      setStep("form");
      setError("");
      setErrorDetails("");
      return;
    }

    // Try to re-run analysis on a failed audit
    setError("");
    setErrorDetails("");
    setStep("analyzing");

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auditId }),
      });

      if (!res.ok) {
        // If re-analysis won't work, offer to start over
        setStep("form");
        setAuditId(null);
        return;
      }

      startPolling(auditId);
    } catch {
      setStep("form");
      setAuditId(null);
    }
  }

  const isProcessing = ["starting", "crawling", "analyzing", "done"].includes(
    step
  );

  const percent = progress?.progressPercent ?? 0;
  const message = progress?.progressMessage ?? getDefaultMessage(step);

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-xl px-6 py-16">
        <h1 className="mb-2 text-2xl font-bold">
          Connect Your WordPress Site
        </h1>
        <p className="mb-8 text-sm text-gray-600">
          We use WordPress Application Passwords to securely access your site.
          Your main password is never stored.
        </p>

        {/* Progress panel */}
        {isProcessing && (
          <div className="mb-8 rounded-lg border border-indigo-100 bg-indigo-50 p-6">
            {/* Status message */}
            <div className="flex items-center gap-3">
              {step !== "done" ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
              ) : (
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-white text-xs">
                  ✓
                </div>
              )}
              <span className="font-medium text-indigo-900">{message}</span>
            </div>

            {/* Progress bar */}
            <div className="mt-4">
              <div className="h-2 rounded-full bg-indigo-200 overflow-hidden">
                <div
                  className="h-2 rounded-full bg-indigo-600 transition-all duration-500"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <div className="mt-1 flex justify-between text-xs text-indigo-600">
                <span>{percent}%</span>
                {progress && progress.totalUrlsDiscovered > 0 && (
                  <span>
                    {step === "crawling" &&
                      `${progress.pagesCrawledSoFar} / ${progress.totalUrlsDiscovered} pages`}
                    {step === "analyzing" &&
                      `${progress.pagesAnalyzedSoFar} / ${progress.totalPagesCrawled} pages analyzed`}
                  </span>
                )}
              </div>
            </div>

            {/* Step indicators */}
            <div className="mt-4 flex gap-2">
              {(
                [
                  { key: "starting", label: "Connect" },
                  { key: "crawling", label: "Crawl" },
                  { key: "analyzing", label: "Analyze" },
                ] as const
              ).map(({ key, label }, idx) => {
                const steps: Step[] = [
                  "starting",
                  "crawling",
                  "analyzing",
                  "done",
                ];
                const currentIdx = steps.indexOf(step);
                const isComplete = idx < currentIdx;
                const isCurrent = key === step;

                return (
                  <div key={key} className="flex-1">
                    <div
                      className={`h-1.5 rounded-full transition-all ${
                        isComplete
                          ? "bg-indigo-600"
                          : isCurrent
                            ? "animate-pulse bg-indigo-400"
                            : "bg-indigo-200"
                      }`}
                    />
                    <p className="mt-1 text-xs text-indigo-600">{label}</p>
                  </div>
                );
              })}
            </div>

            {/* Live stats */}
            {progress && step === "done" && (
              <div className="mt-4 grid grid-cols-3 gap-3 rounded-lg bg-white/60 p-3">
                <div className="text-center">
                  <p className="text-lg font-bold text-indigo-900">
                    {progress.totalPagesCrawled}
                  </p>
                  <p className="text-xs text-indigo-600">Pages crawled</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-indigo-900">
                    {progress.totalIssuesFound}
                  </p>
                  <p className="text-xs text-indigo-600">Issues found</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-indigo-900">
                    {progress.healthScore}
                    <span className="text-xs font-normal">/100</span>
                  </p>
                  <p className="text-xs text-indigo-600">Health score</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Warning panel (e.g. bot protection detected) */}
        {warning && !error && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600 text-xs font-bold">
                i
              </div>
              <p className="text-sm text-amber-800">{warning}</p>
            </div>
          </div>
        )}

        {/* Error panel */}
        {(error || step === "error") && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-5">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 text-xs">
                !
              </div>
              <div className="flex-1">
                <p className="font-medium text-red-800">{error}</p>
                {errorDetails && (
                  <p className="mt-2 text-sm text-red-600">{errorDetails}</p>
                )}
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={handleRetry}
                    className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
                  >
                    {auditId ? "Retry Analysis" : "Try Again"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStep("form");
                      setError("");
                      setErrorDetails("");
                      setAuditId(null);
                      setProgress(null);
                    }}
                    className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
                  >
                    Start Over
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleConnect} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">
              WordPress Site URL
            </label>
            <input
              type="url"
              required
              disabled={isProcessing}
              placeholder="https://example.com"
              value={siteUrl}
              onChange={(e) => setSiteUrl(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              WordPress Username
            </label>
            <input
              type="text"
              required
              disabled={isProcessing}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Application Password
            </label>
            <input
              type="password"
              required
              disabled={isProcessing}
              value={appPassword}
              onChange={(e) => setAppPassword(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              Go to WordPress Admin &rarr; Users &rarr; Profile &rarr;
              Application Passwords to generate one.
            </p>
          </div>

          <button
            type="submit"
            disabled={isProcessing}
            className="w-full rounded-md bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {isProcessing ? "Processing..." : "Connect & Start Audit"}
          </button>
        </form>
      </main>
    </>
  );
}

function getDefaultMessage(step: Step): string {
  switch (step) {
    case "starting":
      return "Connecting to WordPress...";
    case "crawling":
      return "Crawling your pages...";
    case "analyzing":
      return "AI is analyzing SEO issues...";
    case "done":
      return "Audit complete! Redirecting...";
    default:
      return "";
  }
}

function getWPErrorHelp(status: number, errorMsg?: string): string {
  if (status === 401 || errorMsg?.includes("credentials")) {
    return "Double-check your username and application password. Make sure you're using an Application Password (not your regular WordPress password). Go to WordPress Admin → Users → Profile → Application Passwords to generate one.";
  }
  if (status === 403) {
    return "Your WordPress user may not have sufficient permissions. Make sure you have an Administrator or Editor role.";
  }
  if (status === 404 || errorMsg?.includes("REST API")) {
    return "The WordPress REST API doesn't seem to be available at this URL. Make sure your site has the REST API enabled and the URL is correct (e.g., https://yoursite.com).";
  }
  if (errorMsg?.includes("ECONNREFUSED") || errorMsg?.includes("ENOTFOUND")) {
    return "Could not reach the server. Please verify the URL is correct and the site is online.";
  }
  if (errorMsg?.includes("timeout")) {
    return "The connection timed out. The server may be slow or unreachable. Try again in a moment.";
  }
  return "";
}
