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

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
    }
  }, [status, router]);

  useEffect(() => {
    async function fetchData() {
      const res = await fetch("/api/wp/connect");
      if (res.ok) {
        setConnections(await res.json());
      }
      setLoading(false);
    }
    if (status === "authenticated") fetchData();
  }, [status]);

  if (status === "loading" || loading) {
    return (
      <>
        <Navbar />
        <main className="mx-auto max-w-4xl px-6 py-16 text-center">
          <p className="text-gray-500">Loading...</p>
        </main>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <Link
            href="/connect"
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            + New Audit
          </Link>
        </div>

        <section className="mt-8">
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
            <div className="space-y-3">
              {connections.map((conn) => (
                <div
                  key={conn.id}
                  className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4"
                >
                  <div>
                    <p className="font-medium">{conn.siteUrl}</p>
                    <p className="text-sm text-gray-500">
                      {conn.wpUsername} &middot; Connected{" "}
                      {new Date(conn.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Link
                    href={`/connect?site=${encodeURIComponent(conn.siteUrl)}`}
                    className="text-sm text-indigo-600 hover:underline"
                  >
                    Run new audit
                  </Link>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
