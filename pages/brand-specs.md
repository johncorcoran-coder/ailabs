# Smart Business Revolution — Brand Specifications

## COLOR PALETTE

| Name | Hex | Used For |
|------|-----|----------|
| Navy | #0a1628 | Primary background, dark sections, buttons |
| Gold | #c9a84c | Accents, CTAs, highlights, labels |
| Gold Light | #e8c97a | Gold hover states |
| White | #ffffff | Text on dark, card backgrounds |
| Gray | #f4f5f7 | Alternate section backgrounds |
| Text Dark | #2d3748 | Body text on light backgrounds |
| Text Light | #718096 | Subtext, captions, secondary copy |

## TYPOGRAPHY

**Google Fonts Import:**
```css
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow:wght@400;500;600;700&family=Barlow+Condensed:wght@600;700&display=swap');
```

### 1. Bebas Neue — Headlines Only
- Font family: `'Bebas Neue', sans-serif`
- Used for: H1, H2, section titles, stat numbers
- Always uppercase by nature
- Letter spacing: 1–3px depending on size
- Never use for body copy

### 2. Barlow Condensed — Labels, Subheadings, Card Titles, UI Text
- Font family: `'Barlow Condensed', sans-serif`
- Weights: 600, 700
- Used for: eyebrow labels, card headings, FAQ questions, press text, nav elements
- Almost always uppercase with letter-spacing: 1–3px

### 3. Barlow — All Body Copy
- Font family: `'Barlow', sans-serif`
- Weights: 400 (regular), 500 (medium), 600 (semibold), 700 (bold)
- Used for: paragraphs, button text, captions, list items

## FONT SIZES

| Element | Font | Size | Weight | Notes |
|---------|------|------|--------|-------|
| H1 hero | Bebas Neue | clamp(40px, 6vw, 72px) | — | Scales with viewport |
| H2 section | Bebas Neue | clamp(28px, 4vw, 52px) | — | Scales with viewport |
| Eyebrow label | Barlow Condensed | 12px | 700 | All caps, 3px letter-spacing |
| Card heading | Barlow Condensed | 17–20px | 700 | All caps |
| Body paragraph | Barlow | 16–18px | 400 | Line height 1.7–1.8 |
| Button text | Barlow | 14px | 700 | All caps, 1.5px letter-spacing |
| Caption/meta | Barlow | 13px | 400 | Italic or light color |
| Stat number | Bebas Neue | 48px | — | Gold color |

## BUTTONS

### Gold Button (Primary CTA)
```css
background: #c9a84c;
color: #0a1628;
font-family: Barlow, sans-serif;
font-weight: 700;
font-size: 14px;
letter-spacing: 1.5px;
text-transform: uppercase;
padding: 16px 36px;
```

### Outline Button (Secondary CTA, on dark backgrounds)
```css
background: transparent;
color: #ffffff;
border: 2px solid rgba(255,255,255,0.4);
font-family: Barlow, sans-serif;
font-weight: 700;
font-size: 14px;
letter-spacing: 1.5px;
text-transform: uppercase;
padding: 16px 36px;

/* Hover */
border-color: #c9a84c;
color: #c9a84c;
```

### Navy Button (on gold backgrounds)
```css
background: #0a1628;
color: #ffffff;
font-family: Barlow, sans-serif;
font-weight: 700;
font-size: 14px;
letter-spacing: 1.5px;
text-transform: uppercase;
padding: 16px 36px;
```

## LAYOUT RULES

- **Max content width:** 960–1000px, centered with `margin: 0 auto`
- **Section padding:** 72–80px top/bottom, 20px left/right
- **Cards:** CSS Grid `repeat(auto-fit, minmax(260–280px, 1fr))`
- **Card gap:** 24–32px
- **Section backgrounds:** Alternate between navy, white, and gray for visual rhythm

## DESIGN PATTERNS

- **Eyebrow labels:** Always above H2s — gold, Barlow Condensed, all caps, 12px, 3px letter-spacing
- **Light-background cards:** Gold left border `border-left: 4px solid #c9a84c`
- **Dark navy cards:** Gold bottom border `border-bottom: 3px solid #c9a84c`
- **Decorative numbers:** Large faded background numbers (e.g., "01", "02") — gold at 12% opacity, Bebas Neue 64px
- **Stat boxes on navy:** `rgba(255,255,255,0.05)` background with `rgba(201,168,76,0.2)` border
- **Hover effects:** Buttons lift `translateY(-2px)`, logos brighten opacity

## SEO & STRUCTURED DATA

Include in `<head>`:
- **Schema.org:** Organization, Service (with OfferCatalog), FAQPage, BreadcrumbList
- **Meta tags:** description, og:title, og:description, og:type, og:url, og:image
- **Twitter cards:** All required fields

---

*Saved Feb 26, 2026*
