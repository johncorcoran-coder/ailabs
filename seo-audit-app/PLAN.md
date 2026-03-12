# SEO Audit App — Architecture & Implementation Plan

## 1. Product Overview

A web application where users enter their website URL, authenticate with their WordPress credentials, and receive an AI-powered technical SEO audit. The app uses the Claude API on the backend to crawl, analyze, and prioritize SEO fixes. Users can review, customize, and approve changes — which are then applied directly to their WordPress site via the WordPress REST API. Usage is metered by Claude API token consumption and billed through Stripe.

---

## 2. Core User Flow

```
1. User lands on the app → enters their website URL
2. User authenticates with their WordPress admin credentials
   (stored securely per-session via the WP REST API application passwords)
3. App crawls the site and sends page data to Claude API for SEO analysis
4. App displays a prioritized audit report:
   - Critical issues first (missing titles, broken H1s, duplicate meta, etc.)
   - Organized by page, with severity/priority ranking
5. App shows cost estimate:
   - Estimated token cost to fix everything (in $50 increments)
   - Comparison: "Traditional SEO agency would charge $X for this"
6. User pays via Stripe (prepay in $50 token-credit increments)
7. User walks through fixes one-by-one (highest priority first):
   - Sees the proposed change (e.g., "Change H1 from X → Y")
   - Can approve as-is, modify the suggestion, or skip
8. Approved changes are applied to WordPress via the REST API
9. User sees a summary of all changes made + remaining token balance
```

---

## 3. Technical Architecture

### 3.1 Tech Stack

| Layer          | Technology                          | Rationale                                                |
|----------------|-------------------------------------|----------------------------------------------------------|
| Frontend       | Next.js (React) + Tailwind CSS      | SSR for fast loads, React for interactive audit UI        |
| Backend/API    | Next.js API Routes (Node.js)        | Keeps everything in one deployable unit                   |
| AI Engine      | Anthropic Claude API (claude-sonnet-4-6) | Best cost/quality ratio for structured SEO analysis  |
| Database       | PostgreSQL (via Supabase or Neon)   | User accounts, audit history, token balances              |
| Auth           | NextAuth.js (credentials provider)  | Manages app sessions; WP auth is separate per-site        |
| Payments       | Stripe Checkout + Webhooks          | Prepaid token credit system                               |
| WordPress Comm | WordPress REST API                  | Read pages/posts, update content programmatically         |
| Crawler        | Cheerio + fetch (server-side)       | Lightweight HTML parsing, no headless browser needed      |
| Hosting        | Vercel or Railway                   | Easy Next.js deployment with serverless functions         |
| Job Queue      | Inngest or BullMQ (Redis)           | Long-running crawl + analysis jobs                        |

### 3.2 High-Level System Diagram

```
┌─────────────┐       ┌──────────────────────────────────────┐
│   Browser    │◄─────►│          Next.js App                 │
│  (React UI)  │       │  ┌────────────┐  ┌───────────────┐  │
└─────────────┘       │  │ API Routes │  │  Job Queue    │  │
                       │  └─────┬──────┘  └───────┬───────┘  │
                       └────────┼─────────────────┼──────────┘
                                │                 │
              ┌─────────────────┼─────────────────┼──────────┐
              │                 │                 │          │
        ┌─────▼─────┐   ┌──────▼──────┐   ┌─────▼──────┐   │
        │ PostgreSQL │   │ Claude API  │   │  Stripe    │   │
        │ (users,    │   │ (analysis)  │   │ (payments) │   │
        │  audits,   │   └─────────────┘   └────────────┘   │
        │  credits)  │                                       │
        └────────────┘         ┌────────────────┐            │
                               │  WordPress     │            │
                               │  REST API      │◄───────────┘
                               │  (target site) │
                               └────────────────┘
```

---

## 4. Database Schema (Key Tables)

```
users
  id, email, password_hash, created_at

wp_connections
  id, user_id, site_url, wp_username, wp_app_password (encrypted), created_at

audits
  id, user_id, wp_connection_id, site_url, status (pending/crawling/analyzing/complete),
  total_pages_crawled, total_issues_found, estimated_tokens, estimated_cost_usd,
  agency_comparison_cost_usd, created_at

audit_issues
  id, audit_id, page_url, issue_type, severity (critical/high/medium/low),
  priority_rank, current_value, suggested_value, user_modified_value,
  status (pending/approved/applied/skipped), applied_at

token_balances
  id, user_id, balance_tokens, total_purchased_usd

transactions
  id, user_id, stripe_payment_intent_id, amount_usd, tokens_credited, created_at
```

---

## 5. Feature Breakdown

### 5.1 Site Crawler Module

**What it does:** Crawls the user's WordPress site to collect page data for analysis.

- Fetch the sitemap.xml first (fast discovery of all URLs)
- Fall back to recursive link-following if no sitemap exists
- For each page, extract:
  - Title tag
  - Meta description
  - H1, H2, H3 hierarchy
  - Image alt text
  - Internal/external links
  - Canonical tag
  - Open Graph / structured data
  - Page load indicators (response time, content size)
- Rate-limit crawling to avoid overloading the target site
- Store raw crawl data in the database for the analysis step

### 5.2 Claude SEO Analysis Engine

**What it does:** Sends crawl data to Claude API with a structured prompt to identify and prioritize technical SEO issues.

- Prompt structure (per page batch):
  ```
  You are a technical SEO expert. Analyze the following page data
  and return a JSON array of issues found, each with:
  - issue_type (e.g., missing_h1, duplicate_title, missing_alt_text, ...)
  - severity: critical | high | medium | low
  - current_value: what's there now
  - suggested_fix: the recommended replacement
  - explanation: why this matters for SEO (1-2 sentences)

  Page data:
  [structured page data here]
  ```

- Issue types to detect:
  - Missing or duplicate title tags
  - Missing or multiple H1 tags
  - Missing meta descriptions
  - Missing image alt text
  - Broken internal links
  - Missing canonical tags
  - Thin content pages
  - Missing Open Graph tags
  - Poor heading hierarchy (H1 → H3 skip)
  - Missing structured data / schema markup
  - Redirect chains
  - Non-HTTPS resources (mixed content)

- Global cross-page analysis:
  - Duplicate titles across pages
  - Duplicate meta descriptions
  - Orphan pages (no internal links pointing to them)
  - Keyword cannibalization detection

### 5.3 Priority Ranking System

Issues are ranked using a weighted scoring model:

| Severity | Weight | Examples                                      |
|----------|--------|-----------------------------------------------|
| Critical | 10     | Missing title, missing H1, broken pages       |
| High     | 7      | Duplicate titles, missing meta descriptions   |
| Medium   | 4      | Missing alt text, poor heading hierarchy       |
| Low      | 1      | Missing OG tags, schema markup gaps            |

Within each severity tier, issues are further ranked by:
1. Pages with higher traffic potential (homepage > deep pages)
2. Ease of fix (quick text change > structural change)

### 5.4 Audit Report UI

The report page displays:

- **Summary dashboard:** Total issues by severity, overall SEO health score (0-100)
- **Cost panel:**
  - "Estimated cost to fix all issues: ~$X (Y tokens)"
  - "A traditional SEO agency would charge: ~$Z for this work"
  - Agency comparison is calculated as: `(estimated_hours × $150/hr)` where hours are estimated per issue type
- **Issue list:** Grouped by page, sorted by priority
  - Each issue shows: what's wrong, why it matters, the suggested fix
  - Action buttons: Approve / Modify / Skip

### 5.5 WordPress Integration

**Authentication:**
- User provides their WordPress site URL + admin username
- App guides them to generate a WordPress Application Password
  (WordPress → Users → Profile → Application Passwords)
- App stores the app password encrypted (AES-256) in the database
- All WP API calls use Basic Auth with the application password

**Reading content:**
- `GET /wp-json/wp/v2/pages` — fetch all pages
- `GET /wp-json/wp/v2/posts` — fetch all posts
- Used to get current content for comparison and to identify WordPress post/page IDs

**Applying changes:**
- `PUT /wp-json/wp/v2/pages/{id}` — update page title, content
- `PUT /wp-json/wp/v2/posts/{id}` — update post title, content
- For meta descriptions: use Yoast/RankMath REST API extensions if available,
  otherwise update via custom fields

**Limitations to communicate to users:**
- Changes to robots.txt, .htaccess, site speed, or server config are outside scope
- The app handles on-page content SEO only
- Plugin-level changes (e.g., installing Yoast) require manual action

### 5.6 Stripe Billing System

**Model:** Prepaid token credits in $50 increments.

**Flow:**
1. After audit completes, show estimated cost
2. User clicks "Buy Credits" → Stripe Checkout session
3. On successful payment (webhook), credit tokens to user's balance
4. Each change applied deducts tokens based on actual Claude API usage
5. User can see remaining balance in their dashboard

**Pricing formula:**
- Track actual input + output tokens used per Claude API call
- Convert to USD using Anthropic's published pricing
- Apply a markup (e.g., 2-3x) to cover infrastructure + margin
- Display to user as simple dollar amounts, not raw token counts

**Stripe implementation:**
- Stripe Checkout for payment
- Stripe Webhooks (`checkout.session.completed`) to credit balance
- Stripe Customer Portal for receipt/invoice management

### 5.7 User Customization Flow

When the user reviews each suggested fix:

```
┌─────────────────────────────────────────────────┐
│  Issue #1 (Critical) — Homepage: Missing H1     │
│                                                  │
│  Current:  (no H1 tag found)                     │
│  Suggested: "AI-Powered SEO Services for B2B"   │
│                                                  │
│  [ Edit suggestion ]                             │
│                                                  │
│  [✓ Approve & Apply]  [Skip]  [Apply All Below] │
└─────────────────────────────────────────────────┘
```

- "Edit suggestion" opens an inline text editor where the user can modify the proposed value
- "Approve & Apply" sends the change to WordPress immediately
- "Skip" moves to the next issue
- "Apply All Below" applies all remaining suggestions at current severity level without review (power-user shortcut)

---

## 6. Security Considerations

- **WordPress credentials:** Encrypted at rest (AES-256-GCM), never logged, transmitted only over HTTPS
- **Session management:** Short-lived JWT tokens, refresh token rotation
- **WordPress API calls:** Made server-side only, never exposed to the browser
- **Rate limiting:** API routes rate-limited to prevent abuse
- **Input validation:** Sanitize all user-provided URLs and text inputs
- **Stripe webhooks:** Verified using Stripe signature verification
- **CSRF protection:** Built into Next.js API routes

---

## 7. Project Structure

```
seo-audit-app/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── page.tsx            # Landing page (enter URL)
│   │   ├── auth/               # Login / signup pages
│   │   ├── connect/            # WordPress connection setup
│   │   ├── audit/
│   │   │   ├── [id]/
│   │   │   │   ├── page.tsx    # Audit report view
│   │   │   │   └── fix/
│   │   │   │       └── page.tsx # Fix review & apply flow
│   │   ├── dashboard/          # User dashboard (history, balance)
│   │   └── api/
│   │       ├── auth/           # NextAuth endpoints
│   │       ├── crawl/          # Start crawl job
│   │       ├── analyze/        # Start analysis job
│   │       ├── audit/          # Get audit results
│   │       ├── fix/            # Apply a fix to WordPress
│   │       ├── stripe/
│   │       │   ├── checkout/   # Create checkout session
│   │       │   └── webhook/    # Handle Stripe events
│   │       └── wp/             # WordPress API proxy
│   ├── lib/
│   │   ├── crawler.ts          # Site crawling logic
│   │   ├── analyzer.ts         # Claude API analysis prompts
│   │   ├── wordpress.ts        # WP REST API client
│   │   ├── stripe.ts           # Stripe helpers
│   │   ├── pricing.ts          # Token cost + agency comparison calc
│   │   ├── encryption.ts       # Credential encryption
│   │   └── db.ts               # Database client
│   ├── components/
│   │   ├── AuditReport.tsx     # Audit summary dashboard
│   │   ├── IssueCard.tsx       # Individual issue display
│   │   ├── FixEditor.tsx       # Inline edit for suggestions
│   │   ├── CostEstimate.tsx    # Pricing panel
│   │   └── WPConnectForm.tsx   # WordPress connection form
│   └── types/
│       └── index.ts            # TypeScript type definitions
├── prisma/
│   └── schema.prisma           # Database schema
├── package.json
├── .env.example
└── README.md
```

---

## 8. Agency Cost Comparison Formula

To show users what this would cost with a traditional SEO agency:

| Task Type                        | Estimated Manual Time | Agency Rate |
|----------------------------------|----------------------|-------------|
| Title tag optimization (per page)| 15 min               | $37.50      |
| Meta description (per page)      | 10 min               | $25.00      |
| H1/heading restructure (per page)| 20 min               | $50.00      |
| Image alt text audit (per page)  | 15 min               | $37.50      |
| Internal linking fixes           | 30 min               | $75.00      |
| Schema markup additions          | 45 min               | $112.50     |
| Full technical audit report      | 3-5 hours            | $450-$750   |

**Baseline rate:** $150/hr (industry average for mid-tier SEO agency)

The app sums up estimated manual hours for all detected issues and multiplies by the hourly rate to produce the comparison figure.

---

## 9. Implementation Phases

### Phase 1 — MVP (Weeks 1-3)
- [ ] Next.js project setup with Tailwind
- [ ] User auth (signup/login) with NextAuth
- [ ] Basic site crawler (sitemap + page extraction)
- [ ] Claude API integration for single-page analysis
- [ ] Audit report UI with priority ranking
- [ ] WordPress connection (read-only first)

### Phase 2 — WordPress Write + Payments (Weeks 4-5)
- [ ] WordPress write integration (apply fixes via REST API)
- [ ] Fix review flow with inline editing
- [ ] Stripe integration (checkout, webhooks, balance tracking)
- [ ] Cost estimation + agency comparison display

### Phase 3 — Polish & Scale (Weeks 6-7)
- [ ] Job queue for large site crawls (async processing)
- [ ] Progress indicators during crawl/analysis
- [ ] Audit history in user dashboard
- [ ] Email notifications (audit complete, low balance)
- [ ] Error handling for WP API failures (permissions, plugin conflicts)

### Phase 4 — Growth Features (Week 8+)
- [ ] Scheduled re-audits (monthly)
- [ ] Before/after SEO score tracking
- [ ] PDF export of audit reports
- [ ] Multi-site management
- [ ] Referral / affiliate program

---

## 10. Key Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| WordPress site has no REST API enabled | Check on connection and show clear error message |
| User doesn't have admin access | Validate permissions before starting audit |
| Claude API produces inaccurate SEO suggestions | Always show suggestions for user review; never auto-apply without consent |
| Large sites (1000+ pages) cost too much in tokens | Offer to audit a subset (top 50 pages by traffic) first |
| WP plugins (Yoast, RankMath) handle meta differently | Detect installed SEO plugin and use the correct API fields |
| Stripe payment disputes | Clear pricing disclosure upfront; show token usage log |
| Rate limiting by WordPress host | Throttle API calls; allow user to configure delay |

---

## 11. Environment Variables Needed

```
# Auth
NEXTAUTH_SECRET=
NEXTAUTH_URL=

# Database
DATABASE_URL=

# Anthropic
ANTHROPIC_API_KEY=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=

# Encryption
ENCRYPTION_KEY=  # For encrypting WP credentials at rest
```
