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

### Custom domain (www.russrimmerman.com)

In the Static Web App → **Custom domains**, add `www.russrimmerman.com` and
create the `CNAME` record your DNS provider requires. For the apex
(`russrimmerman.com`), add it as well and set up the apex/ALIAS record or a
redirect to `www`. SSL certificates are provisioned automatically.

## License

MIT © Russ Rimmerman
