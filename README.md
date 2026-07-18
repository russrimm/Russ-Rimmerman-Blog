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
- 🖼️ AI-generated, topic-aware post hero images from your headshot (Entra ID / OIDC — no API key)
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
| `npm run preview` | Preview the production build locally            || `npm run hero`    | Generate topic-aware post hero images (see below) || `npm run format`  | Format the codebase with Prettier               |

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

A post can carry its own `heroImage` (used on cards and the article header). You
can supply one yourself, or **auto-generate a topic-aware illustration from your
headshot** — see [Auto-generating blog hero images](#auto-generating-blog-hero-images).
Posts without an image fall back to a branded placeholder, so nothing looks
broken in the meantime.

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


## Auto-generating blog hero images

Each blog post can have a `heroImage`. Instead of designing one by hand, the
`npm run hero` generator turns your **headshot** into a topic-aware editorial
illustration: it reads the post's title and tags, maps them to a scene (e.g.
Copilot → pair-programming with an AI copilot; Intune → a bouncer checking API
permission scopes), sends the headshot + prompt to **Azure OpenAI
(`gpt-image-1`)**, optimizes the result to a WebP in `src/assets/blog/`, and
writes the `heroImage` + `heroAlt` frontmatter for you.

> **Why this is more secure:** authentication is **Microsoft Entra ID (OIDC)**,
> not an API key. `DefaultAzureCredential` obtains a **short-lived, RBAC-scoped
> access token** (`az login` locally; federated OIDC in CI). There is no
> long-lived key to commit, leak, or rotate, and access is governed by a role
> assignment you can revoke at any time. It also works in tenants where
> key-based auth is disabled.

This is deliberately a **local / CI generator, never a page-build step** \u2014 image
generation costs money per call and is non-deterministic. Generate once, commit
the static WebP, and every site build just serves the file.

### One-time setup

1. **Add your headshot** at `src/assets/author/headshot.jpg` (or point
   `HEADSHOT_PATH` elsewhere).
2. **Configure the endpoint + deployment** (non-secret). Locally, add them to
   `.env` (already gitignored):

   ```bash
   AZURE_OPENAI_ENDPOINT=https://<resource>.openai.azure.com
   AZURE_OPENAI_IMAGE_DEPLOYMENT=<your-gpt-image-1-deployment-name>
   ```

3. **Grant access.** Assign the identity you sign in as the **`Cognitive
   Services OpenAI User`** role on the Azure OpenAI resource. No key required.
4. **Sign in:** `az login` (device code in headless environments:
   `az login --use-device-code`).

### Generating images

```bash
npm run hero -- <post-slug>          # one post, e.g. vibe-coding-lessons
npm run hero -- <post-slug> --dry-run  # preview the prompt only (no token/API call)
npm run hero -- <post-slug> --force  # overwrite an existing image
npm run hero -- --missing            # every published post that lacks an image
npm run hero -- --missing --include-drafts   # ...including drafts
npm run hero -- --list-missing       # just list posts without an image
```

Review the generated WebP, then commit it alongside the post. To change a
post's scene, edit the `TOPIC_SCENES` map in
[`scripts/generate-hero.mjs`](scripts/generate-hero.mjs) or reorder the post's
tags (the most specific matching topic wins).

### Fully automated (GitHub Actions)

The workflow at
[`.github/workflows/generate-hero-images.yml`](.github/workflows/generate-hero-images.yml)
runs whenever a post is pushed to `main` without a `heroImage` (or on demand via
**Run workflow**). It logs in with the **same Entra ID / OIDC federated identity
as the deploy workflow** \u2014 no secrets \u2014 generates the missing images, and commits
them back.

To enable it:

1. Reuse the deploy identity (see [Deploying to Azure Static Web Apps](#deploying-to-azure-static-web-apps))
   and additionally grant it the **`Cognitive Services OpenAI User`** role on the
   Azure OpenAI resource:

   ```bash
   OPENAI_ID=$(az cognitiveservices account show --name "<openai-resource>" --resource-group "<rg>" --query id -o tsv)
   APP_ID=$(az ad app list --display-name "russrimmerman-blog-deploy" --query "[0].appId" -o tsv)
   az role assignment create --assignee "$APP_ID" --role "Cognitive Services OpenAI User" --scope "$OPENAI_ID"
   ```

2. Add two repo **Variables** (not secrets \u2014 they're not sensitive) under
   **Settings \u2192 Secrets and variables \u2192 Actions \u2192 Variables**:
   `AZURE_OPENAI_ENDPOINT` and `AZURE_OPENAI_IMAGE_DEPLOYMENT`. The identity
   secrets (`AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`) are
   shared with the deploy workflow.

> The auto-commit is made with the built-in `GITHUB_TOKEN`, which by design does
> **not** re-trigger other workflows \u2014 so the deploy workflow won't run on that
> commit. Re-run the deploy manually, or push any follow-up change, to publish
> the new images.


## Deploying to Azure Static Web Apps

A GitHub Actions workflow is included at
[`.github/workflows/azure-static-web-apps.yml`](.github/workflows/azure-static-web-apps.yml).
It authenticates to Azure with **Microsoft Entra ID via OIDC** (federated
credentials) instead of a deployment token — so it works even when access-key /
deployment-token auth is disabled on the subscription, and there's no long-lived
secret to rotate.

1. Create an **Azure Static Web App** resource (build preset: **Astro**, or use
   the custom values `app_location: "/"`, `api_location: "api"`,
   `output_location: "dist"`).
2. Create an **Entra ID identity** (app registration or user-assigned managed
   identity) with a **federated credential** for this repo, then grant it the
   **Website Contributor** role on the Static Web App. See the CLI below.
3. Add three repo secrets — `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, and
   `AZURE_SUBSCRIPTION_ID` (these are identifiers, not access keys).
4. Push to `main` — the workflow logs in with OIDC, builds, and deploys
   automatically.

> Forked-PR preview environments still won't deploy: pull requests from forks
> can't obtain an OIDC token. Pushes to `main` and PRs from branches in this repo
> work.

#### One-time identity setup — let your coding agent do it

You don't have to run these commands by hand. Paste the prompt below into your
coding agent (GitHub Copilot, etc.) and let it execute the CLI for you. First do
the two things an agent **cannot** do for you (see
[What the agent can't do](#what-the-agent-cant-do-and-how-to-unblock-it) below):
sign in to Azure and GitHub. Once you're signed in, the agent can run everything
else.

> **Prompt to give your agent:**
>
> "Set up OIDC deployment for this repo's Azure Static Web App. I've already run
> `az login` and `gh auth login`. Using the Azure CLI and GitHub CLI, create an
> Entra app registration named `russrimmerman-blog-deploy`, add federated
> credentials for the `main` branch and pull requests of
> `russrimm/Russ-Rimmerman-Blog`, assign it the **Website Contributor** role on
> my Static Web App (ask me for the resource group and Static Web App name if you
> don't know them), then set the `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, and
> `AZURE_SUBSCRIPTION_ID` GitHub Actions secrets. Show me each command before you
> run it and stop if any command fails."

The commands the agent will run (the same ones you'd run manually):

```bash
APP_NAME="russrimmerman-blog-deploy"
RESOURCE_GROUP="<your-resource-group>"
SWA_NAME="<your-static-web-app-name>"

# 1. Create the app registration + service principal
az ad app create --display-name "$APP_NAME"
APP_ID=$(az ad app list --display-name "$APP_NAME" --query "[0].appId" -o tsv)
az ad sp create --id "$APP_ID"

# 2. Federated credentials — one for the main branch, one for pull requests
az ad app federated-credential create --id "$APP_ID" --parameters '{
  "name": "github-main-branch",
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "repo:russrimm/Russ-Rimmerman-Blog:ref:refs/heads/main",
  "audiences": ["api://AzureADTokenExchange"]
}'
az ad app federated-credential create --id "$APP_ID" --parameters '{
  "name": "github-pull-requests",
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "repo:russrimm/Russ-Rimmerman-Blog:pull_request",
  "audiences": ["api://AzureADTokenExchange"]
}'

# 3. Grant the identity least-privilege access to the Static Web App
SWA_ID=$(az staticwebapp show --name "$SWA_NAME" --resource-group "$RESOURCE_GROUP" --query id -o tsv)
az role assignment create --assignee "$APP_ID" --role "Website Contributor" --scope "$SWA_ID"

# 4. Store the identifiers as GitHub Actions secrets
gh secret set AZURE_CLIENT_ID --body "$APP_ID"
gh secret set AZURE_TENANT_ID --body "$(az account show --query tenantId -o tsv)"
gh secret set AZURE_SUBSCRIPTION_ID --body "$(az account show --query id -o tsv)"
```

If the old `AZURE_STATIC_WEB_APPS_API_TOKEN` secret still exists, tell the agent
to delete it (`gh secret delete AZURE_STATIC_WEB_APPS_API_TOKEN`) — the workflow
no longer uses it.

##### What the agent can't do (and how to unblock it)

A few steps need a human because they're interactive or depend on your account's
privileges. Handle these and the agent can run the rest unattended.

- **Signing in to Azure and GitHub.** `az login` and `gh auth login` open a
  browser (or ask you to paste a device code) — an agent can't complete that
  handshake. **Unblock it:** run them yourself first. In a headless environment
  (Codespaces, containers), use `az login --use-device-code` and
  `gh auth login` and complete the browser step. After that, the CLIs stay
  authenticated for the agent's session.
- **Creating the app registration.** `az ad app create` needs a directory role
  that can register applications — **Application Developer** (or higher, e.g.
  **Application Administrator**), or a tenant that hasn't restricted app
  registration to admins. **If it fails** with an authorization error, either ask
  a Global/Application Administrator to grant you the role (or to run step 1 and
  hand you the resulting `appId`), then let the agent continue from step 2.
- **Assigning the RBAC role.** `az role assignment create` requires **Owner** or
  **User Access Administrator** on the Static Web App (or its resource group /
  subscription). **If it fails** with `AuthorizationFailed`, ask an owner of that
  scope to run just step 3 with your `APP_ID`, then let the agent finish step 4.
- **Setting GitHub secrets.** `gh secret set` needs **admin** on the repo and a
  `gh` session with the `repo` scope. **If it fails**, run
  `gh auth refresh -h github.com -s repo` (or add the secrets manually under
  **Settings → Secrets and variables → Actions**), then re-run step 4.

Tell your agent to **show each command before running it and stop on the first
failure** — that way an authorization error surfaces immediately with the exact
step to hand off, instead of leaving a half-configured identity.

#### Troubleshooting the deploy

**`azure/login@v2` fails with "Not all values are present. Ensure 'client-id' and
'tenant-id' are supplied."**

The login step received empty `client-id`/`tenant-id` values, which means one or
more of the `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` repo
secrets is **missing or empty**. Fix it:

1. Confirm which secrets exist — repo **Settings → Secrets and variables →
   Actions**, or run `gh secret list`. You need all three.
2. If the Entra identity already exists, just (re)set the secrets — you don't need
   to recreate the app registration:

   ```bash
   APP_ID=$(az ad app list --display-name "russrimmerman-blog-deploy" --query "[0].appId" -o tsv)
   gh secret set AZURE_CLIENT_ID --body "$APP_ID"
   gh secret set AZURE_TENANT_ID --body "$(az account show --query tenantId -o tsv)"
   gh secret set AZURE_SUBSCRIPTION_ID --body "$(az account show --query id -o tsv)"
   ```

   If the app registration doesn't exist yet, run the full
   [one-time identity setup](#one-time-identity-setup--let-your-coding-agent-do-it)
   above first.
3. If `gh secret set` fails with a permission error, run
   `gh auth refresh -h github.com -s repo` (needs repo admin) or add the secrets
   manually in the Actions secrets UI, then re-run.
4. Re-run the failed run from **Actions → Re-run jobs**, or push a new commit to
   `main`.

> Pull requests from **forks** can't obtain an OIDC token, so this step will
> always fail for them by design. Only pushes to `main` and PRs from branches in
> this repo can deploy.

### Custom domain (www.russrimmerman.com)

In the Static Web App → **Custom domains**, add `www.russrimmerman.com` and
create the `CNAME` record your DNS provider requires. For the apex
(`russrimmerman.com`), add it as well and set up the apex/ALIAS record or a
redirect to `www`. SSL certificates are provisioned automatically.

## License

MIT © Russ Rimmerman
