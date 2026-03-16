export type IssueSeverity = "critical" | "high" | "medium" | "low";

export type IssueStatus = "pending" | "approved" | "applied" | "skipped";

export type AuditStatus =
  | "pending"
  | "crawling"
  | "analyzing"
  | "complete"
  | "failed";

export interface CrawledPage {
  url: string;
  title: string | null;
  metaDescription: string | null;
  h1Tags: string[];
  h2Tags: string[];
  h3Tags: string[];
  images: { src: string; alt: string | null }[];
  internalLinks: string[];
  externalLinks: string[];
  canonical: string | null;
  ogTags: Record<string, string>;
  responseTimeMs: number;
  contentLength: number;
  statusCode: number;
}

export interface SEOIssue {
  issueType: string;
  severity: IssueSeverity;
  pageUrl: string;
  currentValue: string;
  suggestedValue: string;
  explanation: string;
  priorityRank: number;
}

export interface AuditSummary {
  totalPages: number;
  totalIssues: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  healthScore: number;
  estimatedTokens: number;
  estimatedCostUsd: number;
  agencyComparisonCostUsd: number;
}

export interface WPConnection {
  siteUrl: string;
  username: string;
  appPassword: string;
}

export interface WPPage {
  id: number;
  title: { rendered: string };
  content: { rendered: string };
  link: string;
  slug: string;
  type: "page" | "post";
}
