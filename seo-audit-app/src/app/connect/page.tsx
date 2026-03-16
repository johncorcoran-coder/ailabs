"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Navbar } from "@/components/Navbar";

type Step = "form" | "connecting" | "crawling" | "analyzing" | "done" | "error";

const stepLabels: Record<Step, string> = {
  form: "",
  connecting: "Connecting to WordPress...",
  crawling: "Crawling your pages...",
  analyzing: "AI is analyzing SEO issues...",
  done: "Analysis complete!",
  error: "",
};

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
  const [step, setStep] = useState<Step>("form");
  const [pageCount, setPageCount] = useState(0);

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    // Step 1: Connect
    setStep("connecting");
    const connectRes = await fetch("/api/wp/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ siteUrl, username, appPassword }),
    });

    if (!connectRes.ok) {
      const data = await connectRes.json();
      setError(data.error || "Connection failed");
      setStep("error");
      return;
    }

    const { id: wpConnectionId } = await connectRes.json();

    // Step 2: Crawl
    setStep("crawling");
    const crawlRes = await fetch("/api/crawl", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wpConnectionId }),
    });

    if (!crawlRes.ok) {
      const data = await crawlRes.json();
      setError(data.error || "Crawl failed");
      setStep("error");
      return;
    }

    const { auditId, pagesCrawled } = await crawlRes.json();
    setPageCount(pagesCrawled);

    // Step 3: Analyze
    setStep("analyzing");
    const analyzeRes = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ auditId }),
    });

    if (!analyzeRes.ok) {
      const data = await analyzeRes.json();
      setError(data.error || "Analysis failed");
      setStep("error");
      return;
    }

    setStep("done");
    setTimeout(() => router.push(`/audit/${auditId}`), 800);
  }

  const isProcessing = ["connecting", "crawling", "analyzing", "done"].includes(
    step
  );

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-xl px-6 py-16">
        <h1 className="mb-2 text-2xl font-bold">Connect Your WordPress Site</h1>
        <p className="mb-8 text-sm text-gray-600">
          We use WordPress Application Passwords to securely access your site.
          Your main password is never stored.
        </p>

        {/* Progress indicator */}
        {isProcessing && (
          <div className="mb-8 rounded-lg border border-indigo-100 bg-indigo-50 p-6">
            <div className="flex items-center gap-3">
              {step !== "done" ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
              ) : (
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-white text-xs">
                  ✓
                </div>
              )}
              <span className="font-medium text-indigo-900">
                {stepLabels[step]}
              </span>
            </div>

            {/* Step progress */}
            <div className="mt-4 flex gap-2">
              {(["connecting", "crawling", "analyzing"] as const).map(
                (s, idx) => {
                  const steps: Step[] = [
                    "connecting",
                    "crawling",
                    "analyzing",
                    "done",
                  ];
                  const currentIdx = steps.indexOf(step);
                  const isComplete = idx < currentIdx;
                  const isCurrent = s === step;

                  return (
                    <div key={s} className="flex-1">
                      <div
                        className={`h-1.5 rounded-full transition-all ${
                          isComplete
                            ? "bg-indigo-600"
                            : isCurrent
                              ? "animate-pulse bg-indigo-400"
                              : "bg-indigo-200"
                        }`}
                      />
                      <p className="mt-1 text-xs text-indigo-600">
                        {s === "connecting"
                          ? "Connect"
                          : s === "crawling"
                            ? `Crawl${pageCount > 0 ? ` (${pageCount} pages)` : ""}`
                            : "Analyze"}
                      </p>
                    </div>
                  );
                }
              )}
            </div>
          </div>
        )}

        <form onSubmit={handleConnect} className="space-y-4">
          {(error || step === "error") && (
            <div className="rounded-md bg-red-50 p-3">
              <p className="text-sm text-red-600">{error}</p>
              <button
                type="button"
                onClick={() => {
                  setStep("form");
                  setError("");
                }}
                className="mt-1 text-xs text-red-700 underline"
              >
                Try again
              </button>
            </div>
          )}

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
            {isProcessing
              ? "Processing..."
              : "Connect & Start Audit"}
          </button>
        </form>
      </main>
    </>
  );
}
