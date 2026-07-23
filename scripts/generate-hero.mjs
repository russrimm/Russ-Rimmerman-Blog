// Generate premium, photorealistic enterprise WebP hero images for blog posts.
// Each post becomes a cinematic "Portal 360" enterprise scene themed to its
// topic. When a scene includes a human figure, the author's headshot
// (src/assets/author/headshot.jpg) is passed to the image-edit endpoint as a
// likeness reference so the person in the hero resembles the author.
//
// Usage:
//   npm run hero -- <slug>              generate one post's image
//   npm run hero -- <slug> --force      overwrite an existing image / frontmatter
//   npm run hero -- --missing           generate for every published post lacking one
//   npm run hero -- --missing --include-drafts   ...including drafts
//   npm run hero -- <slug> --dry-run    print the prompt only, no token / API call
//   npm run hero -- --list-missing      list slugs that have no heroImage (no calls)
//
// This is a LOCAL / CI generator — never run it at page-build time. It calls a
// paid image API, is non-deterministic, and needs Entra ID auth. Generate once,
// commit the resulting .webp, and every site build just uses the static file.
//
// Configuration (via .env locally, or environment variables in CI):
//   AZURE_OPENAI_ENDPOINT          https://<resource>.openai.azure.com
//   AZURE_OPENAI_IMAGE_DEPLOYMENT  deployment name for a gpt-image-1 model
//   AZURE_OPENAI_CHAT_DEPLOYMENT   optional, a chat model (e.g. gpt-4o) used to
//                                  art-direct a unique enterprise brief from each
//                                  post's content. Without it, a static topic map
//                                  is used instead.
//   AZURE_OPENAI_API_VERSION       optional, defaults to 2025-04-01-preview
//
// Auth is Microsoft Entra ID — NO API KEY. DefaultAzureCredential resolves a
// token from, in order: environment / workload identity / managed identity, the
// Azure CLI (`az login`), Azure Developer CLI, and VS Code. Locally, run
// `az login`; in CI, use federated OIDC (azure/login). The signed-in principal
// needs the "Cognitive Services OpenAI User" role on the Azure OpenAI resource.
// This is more secure than an API key: tokens are short-lived and scoped, there
// is no long-lived secret to leak or rotate, and access is governed by RBAC.

import { readFile, writeFile, readdir, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";
import { DefaultAzureCredential } from "@azure/identity";

const ROOT = path.resolve(fileURLToPath(import.meta.url), "../..");
const BLOG_DIR = path.join(ROOT, "src/content/blog");
const HEADSHOT_PATH = path.join(ROOT, "src/assets/author/headshot.jpg");

// Words that indicate a human figure is part of a scene's subjects. When a hero
// scene includes a person, we render that person to resemble the site author by
// passing headshot.jpg as a reference image to the image-edit endpoint. Short
// words use word boundaries so "man" doesn't match "command"/"human", etc.
const HUMAN_RE =
  /\b(developer|architect|analyst|engineer|maker|person|people|human|professional|team|worker|woman|women|man|men|employee|executive|colleague|designer|specialist|technician|scientist|operator|staff|leader|manager|pairing|collaborating)\b/i;

function sceneHasHuman(brief) {
  return HUMAN_RE.test(brief?.subjects || "");
}

// --- Topic → enterprise scene map --------------------------------------------
// The most specific matching topic wins (list runs specific → generic). Keys are
// matched case-insensitively as substrings against the post's tags, then title.
// Each entry supplies an enterprise ENVIRONMENT, SUBJECTS, and the TECHNOLOGY to
// make the visual centerpiece — all rendered abstractly, never as logos.
const TOPIC_SCENES = [
  ["vibe coding", {
    environment: "an AI innovation lab bathed in soft volumetric light",
    subjects: "a developer collaborating with a generative-AI presence that assembles glowing, weightless code structures in mid-air",
    technology: "generative AI systems and intelligent, conversational code generation",
  }],
  ["copilot studio", {
    environment: "an intelligent business operations center",
    subjects: "an architect orchestrating conversational AI agents that route glowing request threads to the right business systems",
    technology: "low-code AI agent orchestration and secured connections to enterprise data sources",
  }],
  ["copilot", {
    environment: "a modern enterprise architecture workspace",
    subjects: "a developer pairing with an ambient AI assistant that surfaces suggestions as luminous, structured guidance",
    technology: "AI copilots grounded in enterprise knowledge and context",
  }],
  ["foundry", {
    environment: "an AI model factory visualized as a clean, cathedral-like assembly hall",
    subjects: "an architect assembling an AI agent from modular, glowing building blocks on a holographic blueprint",
    technology: "AI model deployment, agent building, and orchestration pipelines",
  }],
  ["agent", {
    environment: "a digital transformation command center",
    subjects: "autonomous AI agents depicted as coordinated points of light orchestrating workflows across a layered architecture",
    technology: "agentic automation and event-driven workflow orchestration",
  }],
  ["intune", {
    environment: "a secure enterprise access gateway visualization",
    subjects: "a stream of device and permission tokens passing through a precise, glowing policy checkpoint",
    technology: "endpoint governance, scoped permissions, and least-privilege access control",
  }],
  ["entra", {
    environment: "a secure identity gateway rendered as a luminous architectural threshold",
    subjects: "identity tokens flowing through a trust boundary where each request is verified before it proceeds",
    technology: "enterprise identity, single sign-on, and per-user authentication trust chains",
  }],
  ["identity", {
    environment: "a secure identity gateway rendered as a luminous architectural threshold",
    subjects: "identity tokens flowing through a trust boundary where each request is verified before it proceeds",
    technology: "enterprise identity, single sign-on, and per-user authentication trust chains",
  }],
  ["servicenow", {
    environment: "a hybrid enterprise integration hub",
    subjects: "two large enterprise platforms connected by a verified, per-user identity bridge carrying glowing request threads",
    technology: "cross-platform integration governed by user identity, roles, and audit trails",
  }],
  ["security", {
    environment: "a secure cloud operations center with a calm, watchful atmosphere",
    subjects: "an analyst reviewing a layered defense architecture where a subtle flaw is caught and isolated before it spreads",
    technology: "defense-in-depth, threat detection, and secure-by-default architecture",
  }],
  ["power platform", {
    environment: "an enterprise low-code studio",
    subjects: "a maker snapping together modular low-code building blocks into a working automated business process",
    technology: "low-code app building, automation, and connected business data",
  }],
  ["mcp", {
    environment: "a data-grounding operations center",
    subjects: "live data conduits connecting an AI model to trusted enterprise sources so its answers stay grounded",
    technology: "model context grounding, tool connections, and retrieval over enterprise data",
  }],
  ["azure", {
    environment: "a modern cloud operations center",
    subjects: "an architect wiring together glowing cloud services across a layered, interconnected digital architecture",
    technology: "cloud infrastructure, connected services, and scalable enterprise architecture",
  }],
  ["ai", {
    environment: "an AI innovation lab bathed in soft volumetric light",
    subjects: "an engineer shaping a luminous generative-AI system that turns raw data into structured intelligence",
    technology: "generative AI systems, models, and knowledge graphs",
  }],
  ["microsoft", {
    environment: "a modern cloud operations center",
    subjects: "an architect at a mission-control console coordinating a connected estate of glowing cloud services",
    technology: "an integrated enterprise cloud platform and its connected services",
  }],
];

const GENERIC_SCENE = {
  environment: "a modern enterprise architecture workspace",
  subjects: "an architect reviewing a large holographic architecture diagram that maps ideas into a clean, connected system",
  technology: "enterprise cloud architecture and connected digital services",
};

// Randomised framing so heroes don't all share the same angle. One is picked per
// image. Each keeps large negative space on one side for a title overlay.
const COMPOSITIONS = [
  "Keep large, clean negative space on the LEFT for a title overlay; anchor the focal point in the right two-thirds with strong leading lines.",
  "Keep large, clean negative space on the RIGHT for a title overlay; anchor the focal point in the left two-thirds with strong leading lines.",
  "Keep generous open sky/atmosphere in the UPPER-LEFT for a title overlay; ground the architecture in the lower two-thirds.",
  "Keep generous open atmosphere in the UPPER-RIGHT for a title overlay; ground the architecture in the lower-left with layered depth.",
];

function pickComposition() {
  return COMPOSITIONS[Math.floor(Math.random() * COMPOSITIONS.length)];
}

// Assemble the full art-direction prompt for one post from its filled-in brief.
function buildPrompt({
  title,
  primaryTopic,
  secondaryTopics,
  summary,
  technologies,
  brief,
  composition,
  withHeadshot,
}) {
  return [
    'Award-winning enterprise technology photography and concept art. Generate a premium, photorealistic, cinematic 16:9 hero image for "Portal 360", a Microsoft Cloud Solution Architect technical blog. The image must visually represent the article\'s primary topic and read like the cover of a premium Microsoft architecture whitepaper or keynote — it tells a story, it is NOT generic AI art.',
    `Article title: ${title}.`,
    `Primary topic and visual centerpiece: ${primaryTopic}.`,
    secondaryTopics ? `Secondary topics: ${secondaryTopics}.` : "",
    summary ? `The image must communicate: ${summary}.` : "",
    technologies
      ? `Key technologies (represent abstractly — never as logos, product names, or readable UI): ${technologies}.`
      : "",
    `Environment: ${brief.environment}.`,
    `Subjects: ${brief.subjects}.`,
    withHeadshot
      ? "IMPORTANT: A single human figure is present in this scene. Render that one person to closely resemble the individual in the provided reference photograph \u2014 matching their facial features, hair, skin tone, and overall likeness \u2014 as a natural, candid part of the scene, shown in professional enterprise attire and integrated realistically with matching lighting and perspective. Do not add any other recognizable human faces, and never show the reference photo itself."
      : "",
    `Technology focus: ${brief.technology}, depicted as abstract architectural forms — flowing data, connected cloud services, holographic architecture diagrams, digital workflows, knowledge graphs — never literal UI or screenshots.`,
    "Style: photorealistic, ultra high detail, editorial quality, modern architecture visualization, Microsoft-inspired, subtly futuristic but not science fiction or cyberpunk.",
    `Composition: wide cinematic 16:9 shot, one strong focal point, leading lines, layered foreground/midground/background, clean visual hierarchy, no clutter. ${composition}`,
    "Lighting: professional cinematic lighting, cool Azure-inspired blues, subtle indigo/purple AI accents, clean white enterprise light, soft volumetric light, natural reflections, premium studio quality.",
    "Color palette: Azure blue, indigo, white, slate gray, glass and steel, small accents of cyan with occasional AI-purple highlights, minimal warm color.",
    "Camera: 35mm lens, wide shot, slightly elevated perspective, photorealistic depth of field, high dynamic range, professional architectural photography.",
    "Mood: innovative, confident, intelligent, trustworthy, enterprise-ready, visionary.",
    "Absolutely NO text, words, letters, numbers, logos, brand names, watermarks, UI screenshots, fake dashboards, clip art, cartoons, or anime. No robots unless robotics is the topic. No distorted hands, duplicated objects, oversaturated colors, neon cyberpunk look, fantasy, or stock-photo appearance.",
  ]
    .filter(Boolean)
    .join(" ");
}

// --- Helpers -----------------------------------------------------------------
function fail(message) {
  console.error(`\n\u2716 ${message}\n`);
  process.exit(1);
}

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

function parseFrontmatter(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  const body = match[1];

  const titleMatch = body.match(/^title:\s*(.+)$/m);
  const title = titleMatch
    ? titleMatch[1].trim().replace(/^['"]|['"]$/g, "")
    : "";

  const descMatch = body.match(/^description:\s*(.+)$/m);
  const description = descMatch
    ? descMatch[1].trim().replace(/^['"]|['"]$/g, "")
    : "";

  const tagsBlock = body.match(/^tags:\s*([\s\S]*?)(?=^\w|\Z)/m);
  const tags = tagsBlock
    ? [...tagsBlock[1].matchAll(/["']([^"']+)["']/g)].map((m) => m[1])
    : [];

  return {
    title,
    description,
    tags,
    hasHero: /^heroImage:\s*\S/m.test(body),
    draft: /^draft:\s*true\s*$/m.test(body),
  };
}

// Strip frontmatter, imports, JSX tags and code fences to get readable prose
// for the scene model to reason about.
function extractBody(raw) {
  return raw
    .replace(/^---\n[\s\S]*?\n---\n?/, "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^import .*$/gm, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/[#>*_`]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pickScene(tags, title) {
  const haystacks = [...tags, title].map((t) => t.toLowerCase());
  for (const [key, brief] of TOPIC_SCENES) {
    if (haystacks.some((h) => h.includes(key))) return brief;
  }
  return GENERIC_SCENE;
}

// Ask a chat model to art-direct THIS post into one concrete enterprise brief so
// every hero looks different. Returns null on any failure so callers fall back
// to the static topic map.
async function deriveBrief({ title, description, body }, cfg) {
  if (!cfg?.chatDeployment) return null;

  const url =
    `${cfg.endpoint.replace(/\/$/, "")}/openai/deployments/${cfg.chatDeployment}` +
    `/chat/completions?api-version=${cfg.apiVersion}`;

  const system =
    "You art-direct premium, photorealistic enterprise technology hero images for a Microsoft " +
    "cloud architecture blog. Given a post, respond with ONLY a compact JSON object: " +
    '{"primaryTopic": string, "environment": string, "subjects": string, "technology": string}. ' +
    '"primaryTopic" is 2-6 words naming the article\'s core subject. ' +
    '"environment" is ONE enterprise setting that fits (e.g. modern cloud operations center, AI ' +
    "innovation lab, enterprise architecture workspace, secure datacenter visualization, executive " +
    'briefing room). "subjects" is the concrete focal elements/people/architecture in the scene, ' +
    '8-20 words, specific to this post. "technology" is the single technology or concept to make the ' +
    "visual centerpiece, described abstractly with NO product logos, names, or readable UI. Make " +
    "different posts look clearly different. No text, logos, camera terms, markdown, or commentary.";
  const user =
    `Title: ${title}\n\nSummary: ${description}\n\nExcerpt:\n${body.slice(0, 2000)}`;

  try {
    const token = await getAccessToken();
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.9,
        max_tokens: 220,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn(`  ! brief model returned ${res.status} ${res.statusText}; using topic fallback.\n${text}`);
      return null;
    }
    const json = await res.json();
    const content = json?.choices?.[0]?.message?.content?.trim();
    if (!content) return null;

    const cleaned = content
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/, "")
      .trim();
    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return null;
    }

    const clean = (v) => (typeof v === "string" ? v.trim().replace(/\.$/, "") : "");
    const environment = clean(parsed.environment);
    const subjects = clean(parsed.subjects);
    const technology = clean(parsed.technology);
    const primaryTopic = clean(parsed.primaryTopic);
    if (!environment && !subjects && !technology) return null;
    return { primaryTopic, environment, subjects, technology };
  } catch (err) {
    console.warn(`  ! brief model failed (${err.message}); using topic fallback.`);
    return null;
  }
}

async function resolvePostPath(slug) {
  for (const ext of [".mdx", ".md"]) {
    const p = path.join(BLOG_DIR, `${slug}${ext}`);
    if (await exists(p)) return p;
  }
  return null;
}

async function listPosts() {
  const files = await readdir(BLOG_DIR);
  return files
    .filter((f) => f.endsWith(".mdx") || f.endsWith(".md"))
    .map((f) => f.replace(/\.mdx?$/, ""));
}

// --- Auth --------------------------------------------------------------------
let cachedToken = null;
async function getAccessToken() {
  if (cachedToken) return cachedToken;
  try {
    const credential = new DefaultAzureCredential();
    const token = await credential.getToken(
      "https://cognitiveservices.azure.com/.default",
    );
    cachedToken = token?.token;
  } catch (err) {
    fail(`Could not get an Entra ID token: ${err.message}\nRun \`az login\` first.`);
  }
  if (!cachedToken) fail("Entra ID token was empty. Run `az login` and retry.");
  return cachedToken;
}

// --- Headshot reference ------------------------------------------------------
// Load the author headshot once and normalise it to a PNG buffer suitable as a
// reference image for the image-edit endpoint. Returns null (with a warning) if
// the file is missing so generation can still proceed without a likeness.
let cachedHeadshot;
async function loadHeadshotPng() {
  if (cachedHeadshot !== undefined) return cachedHeadshot;
  if (!(await exists(HEADSHOT_PATH))) {
    console.warn(
      `  ! headshot not found at ${path.relative(ROOT, HEADSHOT_PATH)} \u2014 ` +
        "generating without author likeness.",
    );
    cachedHeadshot = null;
    return cachedHeadshot;
  }
  cachedHeadshot = await sharp(HEADSHOT_PATH)
    .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer();
  return cachedHeadshot;
}

// Request one image from Azure OpenAI. When a headshot buffer is supplied, use
// the image-edit endpoint (multipart) so the person in the scene resembles the
// author; otherwise use pure text-to-image generation.
async function requestImage({ cfg, prompt, headshot }) {
  const token = await getAccessToken();
  const base =
    `${cfg.endpoint.replace(/\/$/, "")}/openai/deployments/${cfg.deployment}`;

  if (headshot) {
    const form = new FormData();
    form.append("prompt", prompt);
    form.append("size", "1536x1024");
    form.append("quality", "medium");
    form.append("n", "1");
    form.append(
      "image",
      new Blob([headshot], { type: "image/png" }),
      "headshot.png",
    );
    return fetch(`${base}/images/edits?api-version=${cfg.apiVersion}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
  }

  return fetch(`${base}/images/generations?api-version=${cfg.apiVersion}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt, size: "1536x1024", quality: "medium", n: 1 }),
  });
}

// --- Generation --------------------------------------------------------------
async function generatePost(slug, { force, dryRun, cfg }) {
  const postPath = await resolvePostPath(slug);
  if (!postPath) {
    console.warn(`\u2716 No post found for "${slug}" — skipping.`);
    return "skipped";
  }

  const raw = await readFile(postPath, "utf8");
  const fm = parseFrontmatter(raw);
  if (!fm) {
    console.warn(`\u2716 "${slug}" has no frontmatter — skipping.`);
    return "skipped";
  }

  if (fm.hasHero && !force && !dryRun) {
    console.log(`\u2013 "${slug}" already has a heroImage — skipping (use --force to overwrite).`);
    return "skipped";
  }

  const derived = await deriveBrief(
    { title: fm.title, description: fm.description, body: extractBody(raw) },
    cfg,
  );
  const fallback = pickScene(fm.tags, fm.title);
  const brief = {
    environment: derived?.environment || fallback.environment,
    subjects: derived?.subjects || fallback.subjects,
    technology: derived?.technology || fallback.technology,
  };
  const primaryTopic = derived?.primaryTopic || fm.tags[0] || fm.title;
  const secondaryTopics = fm.tags
    .filter((t) => t.toLowerCase() !== primaryTopic.toLowerCase())
    .join(", ");
  const technologies = fm.tags.join(", ");

  const composition = pickComposition();
  const withHeadshot = sceneHasHuman(brief);
  const prompt = buildPrompt({
    title: fm.title,
    primaryTopic,
    secondaryTopics,
    summary: fm.description,
    technologies,
    brief,
    composition,
    withHeadshot,
  });
  const alt = `Cinematic enterprise hero image representing ${primaryTopic} \u2014 ${brief.environment}.`;

  console.log(`\n\u25b6 ${fm.title || slug}`);
  console.log(`  tags:   ${fm.tags.join(", ") || "(none)"}`);
  console.log(`  topic:  ${primaryTopic}`);
  console.log(`  prompt: ${prompt}`);

  if (dryRun) {
    console.log("  (dry run \u2014 no image generated)");
    return "dry-run";
  }

  const headshot = withHeadshot ? await loadHeadshotPng() : null;
  if (withHeadshot) {
    console.log(
      headshot
        ? "  human:  yes \u2014 using headshot.jpg as the person's likeness reference."
        : "  human:  yes \u2014 headshot unavailable, generating without likeness.",
    );
  }

  const res = await requestImage({ cfg, prompt, headshot });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`\u2716 "${slug}": image API returned ${res.status} ${res.statusText}\n${text}`);
    return "failed";
  }

  const json = await res.json();
  const b64 = json?.data?.[0]?.b64_json;
  if (!b64) {
    console.error(`\u2716 "${slug}": API response had no image data.`);
    return "failed";
  }

  const outRel = `src/assets/blog/${slug}.webp`;
  await sharp(Buffer.from(b64, "base64"))
    .resize(1200, 800, { fit: "cover" })
    .webp({ quality: 82 })
    .toFile(path.join(ROOT, outRel));
  console.log(`  \u2714 wrote ${outRel}`);

  const relFromPost = `../../assets/blog/${slug}.webp`;
  const cleaned = raw
    .replace(/^heroImage:.*$\n?/m, "")
    .replace(/^heroAlt:.*$\n?/m, "");
  const patched = cleaned.replace(
    /^(title:.*)$/m,
    `$1\nheroImage: ${relFromPost}\nheroAlt: ${JSON.stringify(alt)}`,
  );
  await writeFile(postPath, patched);
  console.log(`  \u2714 set heroImage + heroAlt in ${path.relative(ROOT, postPath)}`);
  return "generated";
}

// --- Main --------------------------------------------------------------------
const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith("--")));
const positional = args.filter((a) => !a.startsWith("--"));
const force = flags.has("--force");
const dryRun = flags.has("--dry-run");
const missing = flags.has("--missing");
const includeDrafts = flags.has("--include-drafts");

async function missingSlugs() {
  const slugs = await listPosts();
  const out = [];
  for (const slug of slugs) {
    const p = await resolvePostPath(slug);
    const fm = parseFrontmatter(await readFile(p, "utf8"));
    if (!fm || fm.hasHero) continue;
    if (fm.draft && !includeDrafts) continue;
    out.push(slug);
  }
  return out;
}

if (flags.has("--list-missing")) {
  const list = await missingSlugs();
  console.log(list.length ? list.join("\n") : "(all posts have a heroImage)");
  process.exit(0);
}

let targets;
if (missing) {
  targets = await missingSlugs();
  if (!targets.length) {
    console.log("\u2714 Every eligible post already has a heroImage. Nothing to do.");
    process.exit(0);
  }
} else if (positional.length) {
  targets = positional;
} else {
  fail("Provide a post slug, or use --missing. See the header of this file for usage.");
}

// Config is only needed for real generation (not dry runs).
let cfg = null;
if (!dryRun) {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const deployment = process.env.AZURE_OPENAI_IMAGE_DEPLOYMENT;
  const chatDeployment = process.env.AZURE_OPENAI_CHAT_DEPLOYMENT || null;
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION || "2025-04-01-preview";
  if (!endpoint || !deployment) {
    fail(
      "Missing Azure OpenAI config. Set AZURE_OPENAI_ENDPOINT and " +
        "AZURE_OPENAI_IMAGE_DEPLOYMENT (in .env locally, or as CI env vars).",
    );
  }
  if (!chatDeployment) {
    console.warn(
      "! AZURE_OPENAI_CHAT_DEPLOYMENT is not set \u2014 falling back to the static " +
        "topic map, so hero scenes will be less content-specific.",
    );
  }
  cfg = { endpoint, deployment, chatDeployment, apiVersion };
}

const results = { generated: 0, skipped: 0, failed: 0, "dry-run": 0 };
for (const slug of targets) {
  const status = await generatePost(slug, { force, dryRun, cfg });
  results[status] = (results[status] ?? 0) + 1;
}

console.log(
  `\nDone. generated: ${results.generated}, skipped: ${results.skipped}, failed: ${results.failed}` +
    (dryRun ? `, dry-run: ${results["dry-run"]}` : ""),
);
if (results.failed > 0) process.exit(1);
