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
- 🖼️ AI-generated, topic-aware photorealistic enterprise post hero images (Entra ID / OIDC — no API key)
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
tags: ["Azure", "AI", "AI Foundry", "Agents", "MCP", "Copilot", "Copilot Studio", "Microsoft Graph", "Intune", "Power Platform", "Identity", "Security", "Vibe Coding", "Tools", "Design", "Microsoft", "Getting Started", "Projects"]
featured: false # set true to surface on the home page
draft: false # set true to hide from the site
---

Your content here…
```

A post can carry its own `heroImage` (used on cards and the article header). You
can supply one yourself, or **auto-generate a topic-aware photorealistic
enterprise image** — see [Auto-generating blog hero images](#auto-generating-blog-hero-images).
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
`npm run hero` generator produces a topic-aware, photorealistic **"Portal 360"
enterprise hero image**: it reads the post's title, summary, and tags, maps them
to a cinematic enterprise scene (e.g. Copilot Studio → an intelligent business
operations center orchestrating AI agents; Identity → a secure identity gateway
verifying tokens), sends the prompt to **Azure OpenAI (`gpt-image-1`)**, optimizes
the result to a WebP in `src/assets/blog/`, and writes the `heroImage` +
`heroAlt` frontmatter for you. Images are pure text-to-image — no headshot,
logos, or on-image text.

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

1. **Configure the endpoint + deployment** (non-secret). Locally, add them to
   `.env` (already gitignored):

   ```bash
   AZURE_OPENAI_ENDPOINT=https://<resource>.openai.azure.com
   AZURE_OPENAI_IMAGE_DEPLOYMENT=<your-gpt-image-1-deployment-name>
   ```

2. **Grant access.** Assign the identity you sign in as the **`Cognitive
   Services OpenAI User`** role on the Azure OpenAI resource. No key required.
3. **Sign in:** `az login` (device code in headless environments:
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
It signs in to Azure with **Microsoft Entra ID via OIDC** (federated
credentials) — so **no long-lived secret is ever stored in GitHub**. It then
uses that short-lived, least-privilege sign-in to read the Static Web App's
deployment token **at runtime** and publish. Nothing sensitive is committed,
stored as a repo secret, or left to rotate.

### The easy way — one command

Sign in to Azure and GitHub, then run the provisioning script. It's idempotent
(safe to re-run) and creates **everything**: the resource group, the Static Web
App, the deployment identity, its federated credentials, a custom
least-privilege role, and all the GitHub configuration.

```bash
az login        # or: az login --use-device-code   (Codespaces/containers)
gh auth login   # needs the `repo` scope + repo admin

./scripts/setup-azure-swa.sh
```

Override any default with an environment variable:

```bash
SWA_NAME=my-blog RESOURCE_GROUP=my-blog-rg LOCATION=westeurope \
  ./scripts/setup-azure-swa.sh
```

Then push to `main` — the workflow builds and deploys automatically. That's it.

> Forked-PR preview environments still won't deploy: pull requests from forks
> can't obtain an OIDC token. Pushes to `main` and PRs from branches in this repo
> work.

### What the script sets up (and why)

| # | Resource | Why it exists |
|---|----------|---------------|
| 1 | Resource group | A container so every resource is managed and deleted together. |
| 2 | Static Web App (Free) | Hosts the built site and the `/api` functions. |
| 3 | Entra app registration + service principal | The identity GitHub Actions "becomes" — scoped, auditable, revocable. |
| 4 | Two federated credentials | Let GitHub prove its identity to Azure with a short-lived OIDC token instead of a secret. One trusts the `main` branch, one trusts pull requests. |
| 5 | Custom least-privilege role | Grants the identity exactly one permission — read this one SWA's deployment token — and nothing else. |
| 6 | 3 secrets + 2 variables | Non-sensitive identifiers telling the workflow which identity to use and which SWA to deploy to. |

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
> `az login` and `gh auth login`. Run `./scripts/setup-azure-swa.sh` (ask me for
> the Static Web App name, resource group, and region first if they aren't the
> defaults). Show me each command before you run it and stop if any command
> fails."

If you'd rather run the steps by hand instead of the script, these are the exact
commands it runs:

```bash
APP_NAME="russrimmerman-blog-deploy"
RESOURCE_GROUP="<your-resource-group>"
SWA_NAME="<your-static-web-app-name>"
REPO="russrimm/Russ-Rimmerman-Blog"

# 1. Create the app registration + service principal (the CI/CD identity)
az ad app create --display-name "$APP_NAME"
APP_ID=$(az ad app list --display-name "$APP_NAME" --query "[0].appId" -o tsv)
az ad sp create --id "$APP_ID"

# 2. Federated credentials — one for the main branch, one for pull requests.
#    This is how GitHub proves its identity to Azure with no stored secret.
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

# 3. Custom least-privilege role — the identity can ONLY read this one SWA's
#    deployment token, nothing else. The workflow reads that token at runtime.
SWA_ID=$(az staticwebapp show --name "$SWA_NAME" --resource-group "$RESOURCE_GROUP" --query id -o tsv)
az role definition create --role-definition "{
  \"Name\": \"SWA Deployment Token Reader ($SWA_NAME)\",
  \"IsCustom\": true,
  \"Description\": \"Read one Static Web App's deployment token for CI/CD.\",
  \"Actions\": [\"Microsoft.Web/staticSites/read\", \"Microsoft.Web/staticSites/listSecrets/action\"],
  \"AssignableScopes\": [\"$SWA_ID\"]
}"
az role assignment create --assignee "$APP_ID" --role "SWA Deployment Token Reader ($SWA_NAME)" --scope "$SWA_ID"

# 4. Store identifiers (not access keys) as GitHub Actions secrets + variables
gh secret set AZURE_CLIENT_ID       --repo "$REPO" --body "$APP_ID"
gh secret set AZURE_TENANT_ID       --repo "$REPO" --body "$(az account show --query tenantId -o tsv)"
gh secret set AZURE_SUBSCRIPTION_ID --repo "$REPO" --body "$(az account show --query id -o tsv)"
gh variable set SWA_NAME            --repo "$REPO" --body "$SWA_NAME"
gh variable set SWA_RESOURCE_GROUP  --repo "$REPO" --body "$RESOURCE_GROUP"
```

If the old `AZURE_STATIC_WEB_APPS_API_TOKEN` secret still exists, delete it
(`gh secret delete AZURE_STATIC_WEB_APPS_API_TOKEN`) — the workflow no longer
uses it, and an unused secret is needless attack surface.

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
- **Creating and assigning the custom role.** `az role definition create` and
  `az role assignment create` both require **Owner** or **User Access
  Administrator** on the Static Web App (or its resource group / subscription).
  **If either fails** with `AuthorizationFailed`, ask an owner of that scope to
  run step 3 with your `APP_ID`, then let the agent finish step 4.
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
