import * as cheerio from "cheerio";
import type { CrawledPage } from "@/types";

const USER_AGENT = "SEOAuditBot/1.0";
const CRAWL_DELAY_MS = 500;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function discoverUrls(siteUrl: string): Promise<string[]> {
  const base = siteUrl.replace(/\/+$/, "");
  const urls = new Set<string>();

  // Try sitemap.xml first
  try {
    const sitemapRes = await fetch(`${base}/sitemap.xml`, {
      headers: { "User-Agent": USER_AGENT },
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
          const subRes = await fetch(loc, {
            headers: { "User-Agent": USER_AGENT },
          });
          if (subRes.ok) {
            const subXml = await subRes.text();
            const sub$ = cheerio.load(subXml, { xmlMode: true } as Parameters<typeof cheerio.load>[1]);
            sub$("url > loc").each((_, el) => {
              urls.add(sub$(el).text().trim());
            });
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

export async function crawlSite(siteUrl: string): Promise<CrawledPage[]> {
  const urls = await discoverUrls(siteUrl);
  const results: CrawledPage[] = [];

  for (const url of urls) {
    try {
      const page = await crawlPage(url);
      results.push(page);
    } catch {
      // Log but continue crawling other pages
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
    await sleep(CRAWL_DELAY_MS);
  }

  return results;
}
