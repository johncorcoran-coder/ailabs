// Anthropic pricing for Claude Sonnet 4.6 (per million tokens)
const INPUT_PRICE_PER_MILLION = 3.0;
const OUTPUT_PRICE_PER_MILLION = 15.0;

// Our markup on top of raw API costs
const MARKUP_MULTIPLIER = 2.5;

// Token credit increment
export const CREDIT_INCREMENT_USD = 50;

// Agency comparison rates
const AGENCY_HOURLY_RATE = 150;
const AGENCY_HOURS_PER_ISSUE: Record<string, number> = {
  missing_title: 0.25,
  duplicate_title: 0.25,
  missing_h1: 0.33,
  multiple_h1: 0.33,
  missing_meta_description: 0.17,
  duplicate_meta_description: 0.17,
  missing_alt_text: 0.25,
  poor_heading_hierarchy: 0.33,
  missing_canonical: 0.25,
  thin_content: 0.75,
  missing_og_tags: 0.17,
  missing_schema: 0.75,
  broken_internal_link: 0.5,
  orphan_page: 0.5,
};
const DEFAULT_HOURS_PER_ISSUE = 0.33;

// Base cost for the audit report itself (agency would charge 3-5 hours)
const AGENCY_AUDIT_BASE_HOURS = 4;

export function calculateTokenCost(
  inputTokens: number,
  outputTokens: number
): number {
  const rawCost =
    (inputTokens / 1_000_000) * INPUT_PRICE_PER_MILLION +
    (outputTokens / 1_000_000) * OUTPUT_PRICE_PER_MILLION;
  return Math.ceil(rawCost * MARKUP_MULTIPLIER * 100) / 100;
}

export function estimateFixCost(totalPages: number): number {
  // Rough estimate: ~2000 input + ~500 output tokens per page fix
  const estimatedInput = totalPages * 2000;
  const estimatedOutput = totalPages * 500;
  return calculateTokenCost(estimatedInput, estimatedOutput);
}

export function calculateAgencyCost(
  issues: { issueType: string }[]
): number {
  const issueHours = issues.reduce((total, issue) => {
    return (
      total +
      (AGENCY_HOURS_PER_ISSUE[issue.issueType] || DEFAULT_HOURS_PER_ISSUE)
    );
  }, 0);

  const totalHours = AGENCY_AUDIT_BASE_HOURS + issueHours;
  return Math.round(totalHours * AGENCY_HOURLY_RATE);
}

export function creditsNeeded(estimatedCostUsd: number): number {
  return Math.ceil(estimatedCostUsd / CREDIT_INCREMENT_USD) * CREDIT_INCREMENT_USD;
}
