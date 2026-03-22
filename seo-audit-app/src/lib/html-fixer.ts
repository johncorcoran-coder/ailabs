/**
 * HTML-level fix operations for SEO issues.
 * These functions manipulate WordPress post/page HTML content
 * to apply specific SEO improvements.
 */

/**
 * Replace or insert an H1 tag in HTML content.
 * If an H1 exists, replaces its text. If not, prepends one.
 */
export function fixH1(html: string, newH1Text: string): string {
  const h1Regex = /<h1[^>]*>[\s\S]*?<\/h1>/i;
  if (h1Regex.test(html)) {
    return html.replace(h1Regex, `<h1>${escapeHtml(newH1Text)}</h1>`);
  }
  return `<h1>${escapeHtml(newH1Text)}</h1>\n${html}`;
}

/**
 * Fix a heading hierarchy issue — e.g. replace an H3 that should be an H2.
 * Replaces the first occurrence of the specified heading with the correct level.
 */
export function fixHeadingLevel(
  html: string,
  currentLevel: number,
  newLevel: number,
  headingText: string
): string {
  const escapedText = escapeRegex(headingText);
  const pattern = new RegExp(
    `<h${currentLevel}([^>]*)>\\s*${escapedText}\\s*</h${currentLevel}>`,
    "i"
  );
  return html.replace(
    pattern,
    `<h${newLevel}$1>${headingText}</h${newLevel}>`
  );
}

/**
 * Add alt text to images that are missing it.
 * Targets the first img without alt, or with empty alt, that matches the src pattern.
 */
export function fixImgAlt(
  html: string,
  imgSrcPattern: string,
  altText: string
): string {
  const escapedSrc = escapeRegex(imgSrcPattern);
  // Match img tags with this src and missing/empty alt
  const withEmptyAlt = new RegExp(
    `(<img[^>]*src=["']${escapedSrc}["'][^>]*)alt=["']['"]`,
    "i"
  );
  const withoutAlt = new RegExp(
    `(<img[^>]*src=["']${escapedSrc}["'][^>]*?)(/?>)`,
    "i"
  );

  if (withEmptyAlt.test(html)) {
    return html.replace(
      withEmptyAlt,
      `$1alt="${escapeHtml(altText)}"`
    );
  }

  if (withoutAlt.test(html)) {
    return html.replace(withoutAlt, `$1 alt="${escapeHtml(altText)}" $2`);
  }

  return html;
}

/**
 * Determine what type of HTML fix to apply based on the issue type,
 * and return the modified HTML content.
 */
export function applyHtmlFix(
  html: string,
  issueType: string,
  currentValue: string,
  newValue: string
): { html: string; modified: boolean } {
  let result = html;

  if (issueType.includes("missing_h1") || issueType.includes("h1")) {
    result = fixH1(html, newValue);
  } else if (issueType.includes("heading_hierarchy") || issueType.includes("heading_order")) {
    // Try to extract heading levels from the issue type or values
    const currentMatch = currentValue.match(/^h(\d)/i);
    const newMatch = newValue.match(/^h(\d)/i);
    if (currentMatch && newMatch) {
      const textOnly = currentValue.replace(/^h\d\s*[-:]\s*/i, "");
      result = fixHeadingLevel(
        html,
        parseInt(currentMatch[1]),
        parseInt(newMatch[1]),
        textOnly
      );
    }
  } else if (issueType.includes("alt_text") || issueType.includes("img_alt")) {
    // For alt text fixes, currentValue typically contains the img src or identifier
    result = fixImgAlt(html, currentValue, newValue);
  }

  return { html: result, modified: result !== html };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
