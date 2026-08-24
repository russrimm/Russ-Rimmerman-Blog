# Copilot Instructions — Russ Rimmerman Blog

Personal blog and portfolio. Astro 7 + MDX, Tailwind 4, TypeScript, deployed to
Azure Static Web Apps. Posts live in `src/content/blog` as `.mdx`.

**This repository is public.** Everything here ships to the open internet under
Russ's name, so the tone and sanitization rules below are hard gates, not
preferences.

## Use the specialists

Don't reinvent guidance that already exists here:

- **Words, structure, frontmatter, editing** → `.github/agents/technical-blog-editor.agent.md`
- **Layout, components, navigation, styling** → `.github/agents/technical-blog-architect.agent.md`
- **Drafting a new post** → `.github/skills/blog-post/SKILL.md`
- **Final prose pass, required for new or heavily rewritten posts** → `.github/skills/humanizer/SKILL.md`

Read the relevant one before you write. This file covers only the rules that
apply to _every_ change, including one-line edits.

## Tone: never criticize a product or the people who build it

Russ is a Microsoft Cloud Solution Architect writing publicly about Microsoft
products. A post can be honest about behavior without being negative about the
product or its product group. If a sentence would read as a complaint,
frustration, or a dig, rewrite it or cut it.

- **Never** disparage a product, a feature, a product group, or a competitor.
- **Never** editorialize about a product's quality, maturity, or intent. Drop
  words like _annoying_, _confusing_, _clunky_, _broken_, _half-baked_, and
  framings like "the error that lies to you."
- Describe **behavior and impact**, not blame. "The 403 doesn't name the missing
  permission, so check X" is publishable. "The 403 lies to you" is not.
- Don't make a small difference into a big deal. Note it once, plainly, and move
  on.
- Preview and known limitations get stated as **facts with a workaround**, never
  as grievances.
- No snark, no sarcasm, no venting, and no framing a post as "long and
  opinionated." Confident and warm, never sharp.

Positive framing is not the same as marketing hype. Keep the practitioner
honesty; remove the edge.

## US English, always

Spell in US English throughout — prose, headings, alt text, frontmatter, code
comments, and commit messages. Not _behaviour_, _organisation_, _centre_,
_optimise_, _licence_ (as a noun for software), or _whilst_. If you notice UK
spelling anywhere in a file you're touching, fix it in that file and say so.

## Expand acronyms on first mention

First use in a post spells it out with the short form in quotes, then the short
form thereafter: Azure Site Reliability Engineering ("Azure SRE"), Data Loss
Prevention ("DLP"), Advanced Connector Policy ("ACP"). Applies per post, not per
section. Use official product names and capitalization exactly — Microsoft Entra
ID, Microsoft Intune, Microsoft Foundry, Copilot Studio, Power Platform,
Microsoft 365, GitHub Copilot.

## Field notes, not an architecture deep-dive

The positioning in `PRODUCT.md` is practical field notes for practitioners. Keep
posts at the altitude a reader can act on.

- Explain **what to do and why it matters** before _how the internals work_.
- Cut internal-mechanics sections that don't change what the reader does.
- If a section reads as cryptic, dense, or "in the weeds," it's too deep — link
  out to Microsoft Learn instead of unpacking it inline.
- Prefer splitting a genuinely deep topic into a follow-up post over stretching
  one post past its type's length band.

When you cut for depth, say what you removed so Russ can push back.

## Sanitize before you publish

- No secrets, tokens, connection strings, or `.env` contents — ever.
- No tenant IDs, subscription IDs, object IDs, resource names, endpoints, or
  internal URLs. Redact them or replace with obvious placeholders.
- **Screenshots count.** Check every image for tenant names, UPNs, resource
  names, and IDs before adding it, and redact them in the image itself.
- No customer names, internal-only project detail, unannounced product
  information, or proprietary code from a private repository.
- If a useful point can't be made without disclosing something non-public, cut
  it and tell Russ why.

## Images and figures

- Post images live in `src/assets/blog/<post-slug>/`, imported at the top of the
  `.mdx` and rendered with `<Screenshot>`. Project screenshots come from
  `src/assets/projects/<project>/`.
- Place each image at the point in the post where its topic is being discussed,
  not in a gallery at the end.
- When images overlap heavily in subject, keep the clearest one and drop the
  rest rather than shipping near-duplicates.
- `heroAlt` is required whenever `heroImage` is set (enforced by
  `src/content.config.ts`), and alt text must describe the content, not say
  "screenshot."
- **Never hand-author a hero image prompt.** `scripts/generate-hero.mjs`
  (`npm run hero`) owns it. Make `title`, `description`, and `tags` accurate and
  let the script drive the image.

## Verify before you say it's done

Package manager is **npm** (`packageManager` is pinned in `package.json`; Node
24+).

```bash
npm ci            # restore, including in a fresh worktree
npm run build     # astro check && astro build — catches schema + type errors
npm run format    # prettier, before committing
npm test          # lockfile check + api tests + build + check:site
```

`npm run build` is the minimum for any content or component change; a bad
frontmatter field fails there, not at review. For visual changes, run
`npm run dev` and actually look at the page in light and dark mode, at a narrow
width, and with long titles — text that overlaps, truncates, or gets clipped is
a defect, and "it should render fine" is not verification.

## Publishing is Russ's call

- Leave `draft: true` until Russ says otherwise. Never flip `draft` or `featured`
  yourself.
- Set `updatedDate` when meaningfully revising an already-published post.
- Only link to internal posts that actually exist in `src/content/blog`; check
  first.
- Don't open pull requests, merge, or trigger the publish workflows unless asked.
