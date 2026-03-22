import * as cheerio from "cheerio";
import type { CrawledPage } from "@/types";

const USER_AGENT = "SEOAuditBot/1.0";
const CRAWL_DELAY_MS = 500;
const PAGE_TIMEOUT_MS = 15000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface CrawlProgress {
  message: string;
  percent: number; // 0-100
  totalUrls: number;
  crawledSoFar: number;
}

export async function discoverUrls(siteUrl: string): Promise<string[]> {
  const base = siteUrl.replace(/\/+$/, "");
  const urls = new Set<string>();

  // Try sitemap.xml first
  try {
    const sitemapRes = await fetch(`${base}/sitemap.xml`, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
    });
    if (sitemapRes.ok) {
      const xml = await sitemapRes.text();
      const $ = cheerio.load(xml, { xmlMode: true } as Parameters<typeof cheerio.load>[1]);

      // Handle sitemap index
      const sitemapLocs = $("sitemap > loc")
        .map((_, el) => $(el).text().trim())
        .get();
      if (sitemapLocs.length > 0) {
        for (const loc of sitemapLocs.slice(0, 5)) {
          try {
            const subRes = await fetch(loc, {
              headers: { "User-Agent": USER_AGENT },
              signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
            });
            if (subRes.ok) {
              const subXml = await subRes.text();
              const sub$ = cheerio.load(subXml, { xmlMode: true } as Parameters<typeof cheerio.load>[1]);
              sub$("url > loc").each((_, el) => {
                urls.add(sub$(el).text().trim());
              });
            }
          } catch {
            // Sub-sitemap fetch failed, continue with others
          }
        }
      } else {
        $("url > loc").each((_, el) => {
          urls.add($(el).text().trim());
        });
      }
    }
  } catch {
    // Sitemap not available, fall through
  }

  // If no sitemap results, crawl homepage for links
  if (urls.size === 0) {
    urls.add(base);
    try {
      const homeRes = await fetch(base, {
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
      });
      if (homeRes.ok) {
        const html = await homeRes.text();
        const $ = cheerio.load(html);
        $("a[href]").each((_, el) => {
          const href = $(el).attr("href");
          if (!href) return;
          try {
            const resolved = new URL(href, base).href;
            if (resolved.startsWith(base)) {
              urls.add(resolved.split("#")[0].split("?")[0]);
            }
          } catch {
            // invalid URL, skip
          }
        });
      }
    } catch {
      // couldn't fetch homepage
    }
  }

  // Cap at 100 pages for MVP
  return Array.from(urls).slice(0, 100);
}

export async function crawlPage(url: string): Promise<CrawledPage> {
  const start = Date.now();
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    redirect: "follow",
    signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
  });
  const responseTimeMs = Date.now() - start;
  const html = await res.text();
  const $ = cheerio.load(html);

  const images = $("img")
    .map((_, el) => ({
      src: $(el).attr("src") || "",
      alt: $(el).attr("alt") ?? null,
    }))
    .get();

  const baseUrl = new URL(url).origin;
  const internalLinks: string[] = [];
  const externalLinks: string[] = [];
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    try {
      const resolved = new URL(href, url).href;
      if (resolved.startsWith(baseUrl)) {
        internalLinks.push(resolved);
      } else if (resolved.startsWith("http")) {
        externalLinks.push(resolved);
      }
    } catch {
      // skip invalid
    }
  });

  const ogTags: Record<string, string> = {};
  $('meta[property^="og:"]').each((_, el) => {
    const prop = $(el).attr("property");
    const content = $(el).attr("content");
    if (prop && content) ogTags[prop] = content;
  });

  return {
    url,
    title: $("title").first().text().trim() || null,
    metaDescription:
      $('meta[name="description"]').attr("content")?.trim() || null,
    h1Tags: $("h1")
      .map((_, el) => $(el).text().trim())
      .get(),
    h2Tags: $("h2")
      .map((_, el) => $(el).text().trim())
      .get(),
    h3Tags: $("h3")
      .map((_, el) => $(el).text().trim())
      .get(),
    images,
    internalLinks,
    externalLinks,
    canonical: $('link[rel="canonical"]').attr("href") || null,
    ogTags,
    responseTimeMs,
    contentLength: html.length,
    statusCode: res.status,
  };
}

/** Original crawlSite without progress — kept for backward compat */
export async function crawlSite(siteUrl: string): Promise<CrawledPage[]> {
  return crawlSiteWithProgress(siteUrl);
}

/** Crawl with progress callback for async pipeline */
export async function crawlSiteWithProgress(
  siteUrl: string,
  onProgress?: (progress: CrawlProgress) => Promise<void>
): Promise<CrawledPage[]> {
  await onProgress?.({
    message: "Discovering pages from sitemap...",
    percent: 0,
    totalUrls: 0,
    crawledSoFar: 0,
  });

  const urls = await discoverUrls(siteUrl);

  await onProgress?.({
    message: `Found ${urls.length} pages. Starting crawl...`,
    percent: 5,
    totalUrls: urls.length,
    crawledSoFar: 0,
  });

  const results: CrawledPage[] = [];
  let failedCount = 0;

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    try {
      const page = await crawlPage(url);
      results.push(page);
    } catch (err) {
      failedCount++;
      // Record a placeholder for failed pages
      results.push({
        url,
        title: null,
        metaDescription: null,
        h1Tags: [],
        h2Tags: [],
        h3Tags: [],
        images: [],
        internalLinks: [],
        externalLinks: [],
        canonical: null,
        ogTags: {},
        responseTimeMs: 0,
        contentLength: 0,
        statusCode: 0,
      });
    }

    // Report progress every page
    const crawled = i + 1;
    const percent = 5 + Math.round((crawled / urls.length) * 95);
    const failSuffix = failedCount > 0 ? ` (${failedCount} failed)` : "";
    await onProgress?.({
      message: `Crawling page ${crawled} of ${urls.length}${failSuffix}...`,
      percent,
      totalUrls: urls.length,
      crawledSoFar: crawled,
    });

    await sleep(CRAWL_DELAY_MS);
  }

  return results;
}
