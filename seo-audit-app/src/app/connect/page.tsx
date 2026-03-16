"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";

export default function ConnectPage() {
  const router = useRouter();
  const [siteUrl, setSiteUrl] = useState("");
  const [username, setUsername] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Step 1: Connect WordPress
    const connectRes = await fetch("/api/wp/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ siteUrl, username, appPassword }),
    });

    if (!connectRes.ok) {
      const data = await connectRes.json();
      setError(data.error || "Connection failed");
      setLoading(false);
      return;
    }

    const { id: wpConnectionId } = await connectRes.json();

    // Step 2: Start crawl
    const crawlRes = await fetch("/api/crawl", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wpConnectionId }),
    });

    if (!crawlRes.ok) {
      const data = await crawlRes.json();
      setError(data.error || "Crawl failed");
      setLoading(false);
      return;
    }

    const { auditId } = await crawlRes.json();

    // Step 3: Start analysis
    const analyzeRes = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ auditId }),
    });

    if (!analyzeRes.ok) {
      const data = await analyzeRes.json();
      setError(data.error || "Analysis failed");
      setLoading(false);
      return;
    }

    // Redirect to audit report
    router.push(`/audit/${auditId}`);
  }

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-xl px-6 py-16">
        <h1 className="mb-2 text-2xl font-bold">Connect Your WordPress Site</h1>
        <p className="mb-8 text-sm text-gray-600">
          We use WordPress Application Passwords to securely access your site.
          Your main password is never stored.
        </p>

        <form onSubmit={handleConnect} className="space-y-4">
          {error && (
            <p className="rounded-md bg-red-50 p-3 text-sm text-red-600">
              {error}
            </p>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium">
              WordPress Site URL
            </label>
            <input
              type="url"
              required
              placeholder="https://example.com"
              value={siteUrl}
              onChange={(e) => setSiteUrl(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              WordPress Username
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Application Password
            </label>
            <input
              type="password"
              required
              value={appPassword}
              onChange={(e) => setAppPassword(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              Go to WordPress Admin &rarr; Users &rarr; Profile &rarr;
              Application Passwords to generate one.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading
              ? "Connecting & scanning your site..."
              : "Connect & Start Audit"}
          </button>
        </form>
      </main>
    </>
  );
}
