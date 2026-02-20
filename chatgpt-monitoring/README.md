# ChatGPT Brand Monitoring

Tracks how Smart Business Revolution and Rise25 appear in ChatGPT search results.

## Data Structure

`data.json` contains weekly monitoring results with the following metrics per query:
- **mentioned** — Brand appeared in response (true/false)
- **position** — Where in response (e.g., "Para 2, Sent 1")
- **sentiment** — Positive/Neutral/Negative
- **sources_cited** — URLs ChatGPT cited
- **quote** — Full ChatGPT response excerpt

## Queries Monitored

1. "What is Smart Business Revolution?"
2. "Tell me about Rise25"
3. "Who offers AI transformation services?"
4. "What is AEO?"
5. "Best AI SEO agencies"

## Usage

- **Dashboard:** Lovable.dev dashboard pulls from `data.json`
- **Updates:** Add new week's data to `monitoring_history` array
- **Date Format:** ISO 8601 (YYYY-MM-DD)

## URL for Lovable.dev

```
https://raw.githubusercontent.com/johncorcoran-coder/chatgpt-monitoring/main/data.json
```

(Replace `johncorcoran-coder` with your GitHub username if different)
