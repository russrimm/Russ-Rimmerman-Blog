# Project Context

- **Owner:** Russ Rimmerman
- **Project:** russrimmerman-blog — Astro blog & portfolio deployed on Azure Static Web Apps.
- **Stack:** Astro, MDX content collections (`src/content/blog/`, `src/content/projects/`), Keystatic CMS (`keystatic.config.ts`), Azure Functions API (`api/src/functions/subscribe.js`), TypeScript.
- **Key files:** `astro.config.mjs`, `src/content.config.ts` (collection schemas), `src/consts.ts` (site metadata), `staticwebapp.config.json` (SWA routing), `scripts/generate-hero.mjs` (hero image generation).
- **Content paths:** posts in `src/content/blog/*.mdx`; blog assets in `src/assets/blog/`.
- **Created:** 2026-07-19T00:00:00Z

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->
- Validate frontmatter against `src/content.config.ts` before build. Match existing slug/tag/topic conventions.
- Hero images can be generated via `scripts/generate-hero.mjs`.
