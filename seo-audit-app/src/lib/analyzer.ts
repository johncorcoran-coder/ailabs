import Anthropic from "@anthropic-ai/sdk";
import type { CrawledPage, SEOIssue } from "@/types";

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) _client = new Anthropic();
  return _client;
}

const SYSTEM_PROMPT = `You are a technical SEO expert. Analyze crawled page data and identify SEO issues.

For each issue found, return a JSON object with these fields:
- issueType: a snake_case identifier (e.g., missing_h1, duplicate_title, missing_meta_description, missing_alt_text, poor_heading_hierarchy, missing_canonical, thin_content, missing_og_tags)
- severity: "critical" | "high" | "medium" | "low"
- pageUrl: the URL of the page with the issue
- currentValue: what currently exists (or "missing" if absent)
- suggestedValue: your recommended fix
- explanation: 1-2 sentences on why this matters for SEO

Severity guidelines:
- critical: Missing title tag, missing H1, page returning errors
- high: Duplicate titles across pages, missing meta descriptions, multiple H1s
- medium: Missing image alt text, poor heading hierarchy (skipping levels), missing canonical
- low: Missing Open Graph tags, minor content improvements

Return ONLY a valid JSON array of issue objects. No markdown, no explanation outside the JSON.`;

export async function analyzePages(
  pages: CrawledPage[]
): Promise<{ issues: SEOIssue[]; inputTokens: number; outputTokens: number }> {
  const allIssues: SEOIssue[] = [];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  // Process pages in batches of 5 to stay within context limits
  const batchSize = 5;
  for (let i = 0; i < pages.length; i += batchSize) {
    const batch = pages.slice(i, i + batchSize);
    const pageData = batch.map((p) => ({
      url: p.url,
      title: p.title,
      metaDescription: p.metaDescription,
      h1Tags: p.h1Tags,
      h2Tags: p.h2Tags,
      h3Tags: p.h3Tags,
      imageCount: p.images.length,
      imagesWithoutAlt: p.images.filter((img) => !img.alt).length,
      internalLinkCount: p.internalLinks.length,
      externalLinkCount: p.externalLinks.length,
      canonical: p.canonical,
      ogTags: p.ogTags,
      statusCode: p.statusCode,
      contentLength: p.contentLength,
      responseTimeMs: p.responseTimeMs,
    }));

    const response = await getClient().messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Analyze these ${batch.length} pages for SEO issues:\n\n${JSON.stringify(pageData, null, 2)}`,
        },
      ],
    });

    totalInputTokens += response.usage.input_tokens;
    totalOutputTokens += response.usage.output_tokens;

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
    try {
      const issues: SEOIssue[] = JSON.parse(text);
      allIssues.push(...issues);
    } catch {
      // If parsing fails, try extracting JSON from the response
      const match = text.match(/\[[\s\S]*\]/);
      if (match) {
        try {
          const issues: SEOIssue[] = JSON.parse(match[0]);
          allIssues.push(...issues);
        } catch {
          // Skip this batch if we can't parse it
        }
      }
    }
  }

  // Now do cross-page analysis
  if (pages.length > 1) {
    const crossPageData = {
      allTitles: pages.map((p) => ({ url: p.url, title: p.title })),
      allMetaDescriptions: pages.map((p) => ({
        url: p.url,
        metaDescription: p.metaDescription,
      })),
      internalLinkMap: pages.map((p) => ({
        url: p.url,
        internalLinkCount: p.internalLinks.length,
      })),
    };

    const crossResponse = await getClient().messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Perform cross-page SEO analysis. Look for duplicate titles, duplicate meta descriptions, and orphan pages (pages with very few internal links). Data:\n\n${JSON.stringify(crossPageData, null, 2)}`,
        },
      ],
    });

    totalInputTokens += crossResponse.usage.input_tokens;
    totalOutputTokens += crossResponse.usage.output_tokens;

    const crossText =
      crossResponse.content[0].type === "text"
        ? crossResponse.content[0].text
        : "";
    try {
      const crossIssues: SEOIssue[] = JSON.parse(crossText);
      allIssues.push(...crossIssues);
    } catch {
      const match = crossText.match(/\[[\s\S]*\]/);
      if (match) {
        try {
          const crossIssues: SEOIssue[] = JSON.parse(match[0]);
          allIssues.push(...crossIssues);
        } catch {
          // Skip
        }
      }
    }
  }

  // Assign priority ranks based on severity
  const severityWeight: Record<string, number> = {
    critical: 10,
    high: 7,
    medium: 4,
    low: 1,
  };

  allIssues.sort(
    (a, b) =>
      (severityWeight[b.severity] || 0) - (severityWeight[a.severity] || 0)
  );
  allIssues.forEach((issue, idx) => {
    issue.priorityRank = idx + 1;
  });

  return {
    issues: allIssues,
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
  };
}
