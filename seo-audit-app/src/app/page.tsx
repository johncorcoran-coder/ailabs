"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";

export default function HomePage() {
  const { data: session } = useSession();
  const router = useRouter();

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-5xl px-6">
        {/* Hero */}
        <section className="py-20 text-center">
          <h1 className="text-5xl font-bold tracking-tight text-gray-900">
            AI-Powered Technical SEO Audit
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600">
            Get a comprehensive technical SEO audit of your WordPress site in
            minutes — not weeks. Our AI analyzes every page, prioritizes fixes
            by impact, and applies them directly to your site.
          </p>
          <div className="mt-8">
            <button
              onClick={() =>
                router.push(session ? "/connect" : "/auth/signup")
              }
              className="rounded-lg bg-indigo-600 px-8 py-3 text-lg font-semibold text-white shadow-md hover:bg-indigo-700"
            >
              Audit My Website
            </button>
          </div>
        </section>

        {/* How it works */}
        <section className="pb-20">
          <h2 className="mb-10 text-center text-3xl font-bold">
            How It Works
          </h2>
          <div className="grid gap-8 md:grid-cols-3">
            {[
              {
                step: "1",
                title: "Connect Your WordPress Site",
                desc: "Enter your site URL and authenticate with a WordPress application password. We never store your main password.",
              },
              {
                step: "2",
                title: "AI Analyzes Every Page",
                desc: "Our AI crawls your site and evaluates titles, headings, meta descriptions, images, links, and more — then ranks every issue by priority.",
              },
              {
                step: "3",
                title: "Review & Apply Fixes",
                desc: "Walk through each suggestion, customize if you like, and apply fixes directly to your WordPress site with one click.",
              },
            ].map((item) => (
              <div
                key={item.step}
                className="rounded-lg border border-gray-200 bg-white p-6"
              >
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-lg font-bold text-indigo-600">
                  {item.step}
                </div>
                <h3 className="mb-2 text-lg font-semibold">{item.title}</h3>
                <p className="text-sm text-gray-600">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Pricing comparison teaser */}
        <section className="mb-20 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 p-10 text-center text-white">
          <h2 className="text-3xl font-bold">
            A Fraction of Traditional Agency Costs
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-lg text-indigo-100">
            A typical SEO agency charges $600–$5,000+ for a technical audit and
            fixes. Our AI does it for a fraction of the cost, with full
            transparency on pricing.
          </p>
          <div className="mt-6 flex items-center justify-center gap-8">
            <div>
              <p className="text-sm text-indigo-200">Traditional Agency</p>
              <p className="text-3xl font-bold">$2,500+</p>
            </div>
            <div className="text-2xl">vs</div>
            <div>
              <p className="text-sm text-indigo-200">SEO Audit AI</p>
              <p className="text-3xl font-bold">~$50</p>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
