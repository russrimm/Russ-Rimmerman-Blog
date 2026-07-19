---
name: seo-blog-writer
description: Multi-phase SEO blog post automation adapted from advanced n8n agentic workflow. Use when creating long-form SEO-optimized blog posts (2900-3500 words), refining titles, generating key takeaways, outlines, introductions, main body, conclusions, meta descriptions, or featured image prompts. Triggers on blog post, SEO article, content writing, article generation, keyword research for writing, The Bucket Hat style posts, or requests to follow the blog writing process/pipeline.
---

# SEO Blog Writer

Produce high-quality, SEO-optimized, long-form blog posts (target 2900-3500 words total) using a structured multi-agent-style pipeline. Output clean HTML suitable for Shopify or CMS (h2/h3, p, strong, ul/li, a tags). Support internal linking from a provided URL list or sitemap. Incorporate research-driven writing guidelines, hidden insights, and natural keyword use.

## Prerequisites and Inputs

Before starting, gather or request:

- **Primary Keyword**
- **Working Title**
- **Description** (brief article summary or angle)
- **Brand / Site context** (e.g. The Bucket Hat / thebuckethat.nl or your brand)
- **Target site base URL** and preferably a list of internal URLs (collections, products, blog posts) or sitemap
- Optional: existing Airtable/record data, Tavily or web search access, Google Docs for final delivery

If tools are available (web search, Tavily-like SERP, file write, browser), use them. Otherwise simulate research with best knowledge and flag for human verification.

## Core Process (Follow Sequentially)

Execute these phases in order. At each major step produce the artifact, then feed it forward. Keep intermediate results structured so later phases can reference them. Prefer JSON for structured data (intent, keywords, etc.).

### Phase 1: Internal URL Selection (for hyperlinking)

1. Obtain or fetch the site's sitemap or URL list (homepage, collections, products, blogs).
2. Using the working title, description, and primary keyword, select 8-13 most relevant internal URLs.
3. Always include homepage and key collection pages if they exist.
4. Prioritize collection pages that match the topic; include 2-7 product pages where relevant.
5. Output a clean list or JSON array of "best matching urls". Never invent URLs.

### Phase 2: SERP Research + Writing Guidelines + Keywords + Hidden Insights

Use a search tool (Tavily preferred, or web search) on the primary keyword. Analyze top results + the working title/description.

Produce a strict JSON object with exactly these keys:

```json
{
  "search_intent": "informational | transactional | navigational | commercial",
  "writing_style": "e.g. engaging and storytelling | concise and professional | data-driven and technical",
  "writing_tone": "e.g. friendly and conversational | formal and authoritative | persuasive and compelling",
  "hidden_insight": "unique non-obvious insight from competitor gaps or patterns, or 'No significant insights detected beyond existing content trends.'",
  "target_audience": "specific persona",
  "goal_of_article": "clear objective",
  "semantic_analysis": {
    "common_subtopics": ["...", "...", "..."],
    "related_questions": ["...", "...", "..."]
  },
  "keywords": {
    "primary_keyword": "...",
    "secondary_keywords": ["...", "...", "..."],
    "semantic_keywords": ["...", "...", "..."],
    "long_tail_keywords": ["...", "...", "..."]
  }
}
```

Do not add extra text outside the JSON. Use this JSON for all subsequent phases.

### Phase 3: Refine the Title

Input: primary keyword, working title, the JSON from Phase 2 (especially search_intent, semantic_analysis, keywords, writing_style, tone, goal).

Rules:
- 50-60 characters ideal.
- SEO-friendly, click-worthy, natural language.
- Incorporate primary + relevant secondary keywords without stuffing.
- Match search intent and tone.
- Output ONLY the refined title as plain text (no JSON, no quotes, no extra words).

Update any tracking record with the new_title / Final Title.

### Phase 4: Key Takeaways

Using refined title + Phase 2 data + hidden insight:

- Write a short intro paragraph that sets context.
- 6-10 bullet points in the form: **Action-driven bold heading**: concise explanation.
- Outro paragraph that transitions into the main body.
- Prefer HTML: <p>, <ul><li><strong>...</strong>: ...</li></ul>
- Incorporate hidden insight if valuable.
- Whole section should feel scannable and high-value.

### Phase 5: Introduction (400-450 words)

Hook with surprising fact, question, or bold statement. Explain why the topic matters to the reader. Naturally use the primary keyword. Smooth transition into body. Match writing_style and writing_tone. Prefer clean HTML (<p>, optional <h2>/<h3> if natural). Include 1-2 internal links from the URL list when a product/collection is mentioned (use exact provided URLs, natural anchor text).

### Phase 6: Outline

Generate a detailed Markdown or HTML outline for the main body only (exclude title, intro, key takeaways, conclusion).

- Hierarchical H2 / H3.
- Incorporate secondary keywords, semantic subtopics, and related questions naturally into headings where they fit.
- Ensure logical progression that supports the article goal and search intent.
- Reference the URL list for potential link placement points.
- Keep explanations under each heading concise (1-2 sentences describing what the section will cover).
- Do NOT include the actual introduction or conclusion sections.

### Phase 7: Main Body Prompt + Content Writing

First (optional but recommended): generate a self-contained writing prompt that embeds the outline, keywords, style, tone, goal, hidden insight, and URL list. The prompt must instruct the writer to produce only the main body (no intro/conclusion), in clean Shopify-ready HTML, 1800-2400 words, with natural internal links, smooth transitions, real-world depth, and keyword optimization without stuffing.

Then write the main body:
- Strictly follow the outline.
- Clean HTML only: <h2>, <h3>, <p>, <strong>, <ul><li>, <a href="exact-url">anchor</a>.
- No Markdown syntax, no raw \n, no invented URLs.
- End each major section with a transition sentence.
- Aim for depth: examples, implications, actionable advice.
- Total main body 1800-2400 words. If needed, produce in chunks and continue.

### Phase 8: Conclusion (450-550 words)

Summarize key points without repeating the body verbatim. Reinforce value and relevance. End with a strong, forward-looking or actionable final thought (avoid generic "the future is bright"). Clean HTML. Include natural internal links. Match tone.

### Phase 9: Assembly + Final Edit

Combine in this order (or as Markdown with ## headings if preferred for intermediate):

1. Key Takeaways
2. Introduction
3. Main body (with its H2/H3s)
4. Conclusion

Then perform a final editorial pass:
- Expand thin sections rather than cut.
- Improve transitions.
- Diversify examples across industries if the topic allows.
- Strengthen conclusion with future-oriented insight.
- Ensure overall 2900-3500 words.
- Keep all valuable content; only remove true redundancy.
- Output the polished full article in clean HTML.
- Do not add commentary about the edits.

### Phase 10: Meta Description + Featured Image Prompt

**Meta Description** (150-160 characters):
- Keyword-rich, active voice, clear benefit, optional soft CTA.
- Output as:

## Meta Description
[the text]

**Image Prompt**:
Detailed visual description for an AI image generator representing the article's essence. End with `--ar 16:9`.

## Image Prompt
[description] --ar 16:9

## Output Standards (Apply Everywhere)

- Language: English (or match the source language if the original workflow was localized).
- Prefer clean, minimal, valid HTML ready to paste into Shopify or most CMS.
- Internal links: only from the provided best-matching list. Anchor text = product/collection name.
- No keyword stuffing. Readability first.
- When tools or human review are needed (e.g. live SERP, sitemap fetch, Google Doc creation, Airtable update), pause and request or use the available tool.
- For tracking: if an Airtable or similar record ID is provided, update fields such as Final Title, Writing Style, Tone, Search Intent, Hidden Insight, Goal, Semantic Analysis, Keywords, Google Doc URL as they become available.

## Error Recovery and Quality Gates

- If SERP data is unavailable, fall back to strong domain knowledge and note the limitation.
- If word count is short, expand with additional examples, subtopics from semantic analysis, or deeper explanation of the hidden insight.
- If internal URLs are missing, produce the article without links and flag for later linking.
- Always validate that the final piece matches the detected search intent and target audience.
- Human-in-the-loop opportunity: after title options or after key takeaways/outline, offer  the human a choice before full generation (as noted in the original template sticky notes).

## Anti-patterns

- Do not invent product URLs or external links.
- Do not produce Markdown when HTML is required for the final body.
- Do not include introduction or conclusion inside the main-body writer.
- Do not force the hidden insight if it does not fit naturally.
- Avoid generic openings ("In today's fast-paced world...") and weak conclusions.
- Do not exceed or fall far short of the target word counts without justification.

## Integration with Squad / Copilot

See `references/squad-integration.md` for full setup, recommended agent roles (content-strategist, title-specialist, content-writer, editor), and invocation examples.

When running under Squad:
- Route research phases to a Research / Analyst or content-strategist agent if available.
- Route writing phases to a Content Writer agent.
- Use the coordinator to maintain state across phases (store intermediate JSON and sections in decisions.md or a dedicated working file).
- After final article, offer to create a Google Doc equivalent, commit to repo, or open a PR with the content.
- Skill can be invoked with: "Run the seo-blog-writer skill for keyword X with working title Y".

Adapt brand-specific elements (site, collections, tone) to the current project. The original template targeted The Bucket Hat fashion site; generalize while preserving the rigorous research → structure → write → polish pipeline.
