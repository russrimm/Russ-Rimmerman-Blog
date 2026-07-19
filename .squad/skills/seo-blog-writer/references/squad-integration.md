# Using seo-blog-writer with Squad + GitHub Copilot

## Installation into a Squad project

1. Copy the skill folder into your project:

```bash
cp -r /path/to/seo-blog-writer .squad/skills/
```

(Or from the persisted location if using the Grok skills dir.)

2. Restart or re-cast the Squad so agents discover the new skill.

3. Invoke naturally:

```
@Squad use the seo-blog-writer skill to create a full SEO blog post.
Keyword: "how to style a corduroy bucket hat"
Working title: "Corduroy Bucket Hat Outfits"
Description: Practical styling guide for men and women
Site: thebuckethat.nl (or your brand)
```

Or shorter:

```
Run seo-blog-writer for keyword "Power Platform ALM best practices"
```

## Recommended Squad Agents for this Workflow

Add or extend these agents (create charter.md under `.squad/agents/<name>/`):

### content-strategist
- Owns Phase 2 (SERP + guidelines + keywords + hidden insight) and Phase 6 (Outline).
- Charter focus: search intent analysis, semantic SEO, unique angles.

### title-specialist
- Owns Phase 3 (title refinement). Short, high-impact role.

### content-writer
- Owns Phase 5 (Intro), Phase 7 (Main body), Phase 8 (Conclusion).
- Must follow the HTML-only, internal-link, word-count rules strictly.

### editor
- Owns Phase 9 (Assembly + Final Edit) and Phase 10 (Meta + Image Prompt).
- Quality gate owner.

### research-analyst (optional)
- Handles live Tavily/web search and sitemap parsing if tools are available.

The Squad coordinator can sequence the phases automatically when the skill is active, storing intermediate artifacts in `decisions.md` or a working markdown file in the repo.

## Tooling Notes

- Prefer Tavily (or equivalent SERP tool) for Phase 2 when available.
- For internal links, either hard-code a URL list in the skill invocation or have an agent fetch/parse the sitemap.xml.
- Final delivery: write the HTML to a `.md` or `.html` file, create a Google Doc via API if credentials exist, or open a PR.
- Airtable-style tracking can be replaced by updating a local YAML/JSON status file or GitHub Issue.

## Human-in-the-loop Points (from original template)

- After generating 3-5 title options (extend Phase 3), pause for human selection.
- After Key Takeaways or Outline, offer review before committing to the expensive main-body generation.
EOF