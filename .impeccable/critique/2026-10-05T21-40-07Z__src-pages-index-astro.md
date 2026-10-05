---
target: entire site, primary surface src/pages/index.astro
total_score: 28
p0_count: 0
p1_count: 4
timestamp: 2026-10-05T21-40-07Z
slug: src-pages-index-astro
---
Method: degraded single-context (no sub-agent tool). Detector on src/pages, src/components, and src/layouts returned no findings. No browser overlay; production headers and GET /api/subscribe were checked.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Newsletter and search speak; reading progress and view transitions do not |
| 2 | Match System / Real World | 3 | Hero is vague and third-person; projects index overclaims open source |
| 3 | User Control and Freedom | 3 | Navigation is clear; subscribe has no on-site undo |
| 4 | Consistency and Standards | 3 | System is real; focus rings and a few claims diverge |
| 5 | Error Prevention | 3 | Form checks are good; the live subscribe API is easy to call without a browser |
| 6 | Recognition Rather Than Recall | 3 | Topics, tags, and search exist; the homepage shows all of them at once |
| 7 | Flexibility and Efficiency | 2 | No search shortcut; RSS is footer-only; every visit replays the full homepage |
| 8 | Aesthetic and Minimalist Design | 3 | Calm and consistent; the lower homepage is three archives competing |
| 9 | Error Recovery | 3 | 404, search, and subscribe errors are plain language |
| 10 | Help and Documentation | 2 | Books are unnamed and unlinked; no path for speaking or a first visit |
| **Total** | | **28/40** | **Good, not excellent** |

## Anti-Patterns Verdict

Does not look like an AI slop gallery. The detector found nothing. The look is a competent Azure-blue card blog: Inter is named but not loaded, so most people see Segoe UI. Personality is in the posts, not the chrome. Mild tells: hero glow, identical post cards, and a fake terminal only when a featured image is missing.

## Overall Impression

The engineering is ahead of the homepage. A practitioner can trust the article page. A first visit does not yet earn the line in PRODUCT.md.

## What's Working

- Security headers on HTML are unusually complete, and comments stay unloaded until the reader asks.
- Article chrome (TOC, related posts, reading time, print styles, reduced motion, skip link) respects the reader.
- Newsletter, search, and theme code fail in plain language and do not leak provider errors.

## Priority Issues

### [P1] The homepage does not say why this site exists
Mobile never sees "30+ years." The headline is "Where I share what I learn, to help you." The next sentence switches to third person and "his team of highly skilled agents," which reads as marketing and is ambiguous. Fix: put the 10-second line in the h1, first person, with the proof visible at every width. Suggested command: /impeccable clarify

### [P1] The subscribe API is live and weakly braked
GET /api/subscribe returns available:true. Requests with no Origin are allowed. The rate limit is per instance and keys off the last X-Forwarded-For hop, which may be the proxy. Invalid JSON is not rate-limited. Fix: confirm double opt-in, rate-limit before parse, key off the platform client IP, and stop saying "You're subscribed" if the provider still needs confirmation. Not an Impeccable command.

### [P1] Narrated videos have no captions
open-notebook-self-hosted-research-notebook.mdx embeds three narrated videos. Video.astro has a label and figcaption, not a caption track. That misses WCAG 1.2.2. Fix: add WebVTT tracks, or don't publish narration without them. Suggested command: /impeccable harden

### [P1] The portfolio overclaims and overlaps
projects/index.astro says open-source projects. Portal 360 is still private. Three projects are variations of one pane of glass. Fix: say private where it is private, and tell the reader how the three differ in one sentence. Suggested command: /impeccable clarify

## Persona Red Flags

**Alex (returning practitioner):** No "/" search shortcut. RSS is in the footer. The homepage makes them scan a tag cloud to get back to a subject.

**Jordan (first visit, phone):** The credential is in a column hidden below lg. "Agents" could mean staff or AI. They cannot tell, in 10 seconds, what they will be able to do after reading.

**Sam (peer or event organizer):** About mentions two Microsoft Press e-books and does not name or link them. Contact has no speaking line. The long CV starts in 1990 before the current work.

## Minor Observations

- White on #0078d4 is 4.53:1. It passes AA by a hair. Darken buttons to azure-700 for margin.
- Footer social icons are 20px. Header icon buttons are 40px. Target is 44px.
- Newsletter inputs use focus:outline-none plus a 30% ring, fighting the global focus-visible outline.
- Featured image is lazy and can be the LCP element. The headshot is loading=eager inside hidden lg:block.
- ClientRouter adds JS to every page for a content site.
- API responses do not inherit staticwebapp.config headers. The live subscribe response has no nosniff.
- Function runtime is node:20, past EOL as of April 2026. Confirm SWA offers a newer runtime before changing the pin.
- script-src still allows unsafe-inline. Do not remove it until the theme boot script is hashed, or the no-flash theme breaks.
- Privacy page does not name the newsletter processor, now that signup is live.

## Questions

- Should the homepage sell the latest post, or the 30-year practitioner, in the first screen?
- Is Portal 360 meant to be public, or should the index stop calling the portfolio open source?
- Is double opt-in already on in Buttondown?
