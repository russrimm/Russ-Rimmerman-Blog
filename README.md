# russrimmerman.com

The personal blog and portfolio of **Russ Rimmerman**, Microsoft Cloud Solution
Architect. Built with [Astro](https://astro.build) and [Tailwind CSS](https://tailwindcss.com),
deployed to [Azure Static Web Apps](https://learn.microsoft.com/azure/static-web-apps/).

## Features

- ⚡ Astro static site — near-zero JavaScript, fast and SEO-friendly
- ✍️ Blog authored in Markdown/MDX via Astro Content Collections
- 🗂️ Projects/portfolio showcase
- 🏷️ Tags & topic pages
- 🌗 Dark/light mode with no-flash theme loading
- 💬 Giscus comments on blog posts (GitHub Discussions)
- 📰 RSS feed + sitemap + Open Graph/SEO meta tags
- 📧 Newsletter signup (placeholder — wire to a provider when ready)
- 🎨 Azure-inspired design system

## Getting started

```bash
npm install
npm run dev      # start the dev server at http://localhost:4321
```

## Scripts

| Command           | Description                                     |
| ----------------- | ----------------------------------------------- |
| `npm run dev`     | Start the local dev server                      |
| `npm run build`   | Type-check (`astro check`) and build to `dist/` |
| `npm run preview` | Preview the production build locally            |
| `npm run format`  | Format the codebase with Prettier               |

## Writing a blog post

Create a Markdown file in `src/content/blog/`:

```md
---
title: "My Post Title"
description: "A short summary used for cards, SEO, and RSS."
pubDate: 2026-07-08
tags: ["Azure", "AI"]
featured: false # set true to surface on the home page
draft: false # set true to hide from the site
---

Your content here…
```

Add a project by creating a Markdown file in `src/content/projects/`.

## Configuration

Site-wide values live in [`src/consts.ts`](src/consts.ts): title, tagline,
social links, and **Giscus** settings.

### Enabling Giscus comments

1. Push this repo to GitHub as a **public** repository.
2. Enable **Discussions** on the repo (Settings → General → Features).
3. Install the [giscus GitHub App](https://github.com/apps/giscus) on the repo.
4. Visit [giscus.app](https://giscus.app), enter your repo, and copy the
   generated `repo`, `repoId`, `category`, and `categoryId` values.
5. Paste them into the `GISCUS` object in `src/consts.ts`.

Until configured, blog posts show a friendly placeholder instead of comments.

### Newsletter

The signup form (`src/components/NewsletterSignup.astro`) posts to an Azure
Static Web Apps **managed API function** at `/api/subscribe`
(`api/src/functions/subscribe.js`), which forwards the address to your provider.
The provider API key stays server-side and is never exposed to the browser.

Configure **one** provider by adding these values in the Static Web App under
**Settings → Environment variables** (Application settings):

**Buttondown**

| Name                 | Value                     |
| -------------------- | ------------------------- |
| `NEWSLETTER_PROVIDER` | `buttondown`             |
| `BUTTONDOWN_API_KEY`  | your Buttondown API token |

**Mailchimp**

| Name                 | Value                                          |
| -------------------- | ---------------------------------------------- |
| `NEWSLETTER_PROVIDER` | `mailchimp`                                    |
| `MAILCHIMP_API_KEY`   | API key incl. datacenter suffix (`…-us21`)     |
| `MAILCHIMP_LIST_ID`   | audience / list ID                             |

Until a provider is configured the endpoint returns a friendly "not available
yet" message rather than silently discarding the signup. The form validates the
email, includes a honeypot for bots, shows accessible loading/success/error
states, and only reports success when the provider confirms it.

To test the function locally, run the SWA CLI (`swa start dist --api-location
api`) after `npm run build`; the plain `astro dev` server does not serve `/api`.


## Deploying to Azure Static Web Apps

A GitHub Actions workflow is included at
[`.github/workflows/azure-static-web-apps.yml`](.github/workflows/azure-static-web-apps.yml).

1. Create an **Azure Static Web App** resource (build preset: **Astro**, or use
   the custom values `app_location: "/"`, `api_location: "api"`,
   `output_location: "dist"`).
2. Add the deployment token as a repo secret named
   `AZURE_STATIC_WEB_APPS_API_TOKEN`.
3. Push to `main` — the workflow builds and deploys automatically.

### Custom domain (www.russrimmerman.com)

In the Static Web App → **Custom domains**, add `www.russrimmerman.com` and
create the `CNAME` record your DNS provider requires. For the apex
(`russrimmerman.com`), add it as well and set up the apex/ALIAS record or a
redirect to `www`. SSL certificates are provisioned automatically.

## License

MIT © Russ Rimmerman
