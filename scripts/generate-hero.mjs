// Generate topic-aware WebP hero images for blog posts from a headshot.
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
//                                  derive a unique scene from each post's content.
//                                  Without it, a static topic map is used instead.
//   AZURE_OPENAI_API_VERSION       optional, defaults to 2025-04-01-preview
//   HEADSHOT_PATH                  optional, defaults to src/assets/author/headshot.jpg
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

// --- Topic → scene map -------------------------------------------------------
// The most specific matching topic wins (list runs specific → generic). Keys are
// matched case-insensitively as substrings against the post's tags, then title.
const TOPIC_SCENES = [
  ["vibe coding", "the person calmly conducting a small orchestra of friendly AI robot assistants, each holding a different tool"],
  ["copilot studio", "the person holding one master key in front of a row of app-labelled doors"],
  ["copilot", "the person pair-programming beside a glowing, helpful AI copilot floating over a laptop"],
  ["foundry", "the person as an architect in a hard hat assembling a friendly robot agent from labelled blueprint parts"],
  ["agent", "the person directing a small team of specialised robot agents around a holographic project board"],
  ["intune", "the person as a calm bouncer at a velvet-rope API door, checking a clipboard of permission scopes"],
  ["entra", "the person guarding a glowing identity gateway, handing out access badges"],
  ["identity", "the person guarding a glowing identity gateway, handing out access badges"],
  ["security", "the person as a vigilant reviewer shining a flashlight on hidden flaws behind clean-looking code"],
  ["azure", "the person at a mission-control console wiring up glowing Azure cloud services"],
  ["power platform", "the person snapping together low-code building blocks into a working app"],
  ["mcp", "the person plugging live data cables into an AI model to ground it in real sources"],
  ["getting started", "the person crouched at a sprinter's starting line where the running track is a glowing code editor"],
  ["ai", "the person collaborating with a glowing, friendly artificial-intelligence presence"],
  ["microsoft", "the person at a mission-control console surrounded by Microsoft cloud service icons"],
];

const BASE_STYLE =
  "Editorial tech illustration. Dark navy background with a subtle grid and a soft azure-and-teal glow. " +
  "Render the subject as a friendly, semi-realistic caricature that clearly resembles the person in the reference photo. " +
  "Clean flat-vector-meets-cinematic style, warm and approachable, a touch of humour, no text or logos other than the Microsoft emblem noted above.";

// Randomised framing so heroes don't all share the same angle. One is picked per
// image. Every option keeps the wide landscape 3:2 aspect the site crops to.
const COMPOSITIONS = [
  "Wide landscape 3:2 composition; subject on the left third, dramatic low-angle heroic view.",
  "Wide landscape 3:2 composition; subject on the right third, gentle high-angle looking down on the scene.",
  "Wide landscape 3:2 composition; centered subject, strong symmetry and deep background perspective.",
  "Wide landscape 3:2 composition; dynamic slight dutch-angle tilt with the subject caught mid-action.",
  "Wide landscape 3:2 composition; over-the-shoulder view from behind the subject looking into the scene.",
  "Wide landscape 3:2 composition; close three-quarter portrait framing with the scene softly blurred behind.",
  "Wide landscape 3:2 composition; the subject small within an expansive, atmospheric wide shot.",
  "Wide landscape 3:2 composition; eye-level medium shot, subject off-center, props filling the foreground.",
];

function pickComposition() {
  return COMPOSITIONS[Math.floor(Math.random() * COMPOSITIONS.length)];
}

// Pool of distinctive costumes used when a post's topic doesn't clearly imply
// one. Combined with the used-outfit tracking below, every post ends up with a
// visibly different outfit.
const RANDOM_OUTFITS = [
  "a vintage explorer's khaki field jacket",
  "a retro-futuristic astronaut suit",
  "a detective's tan trench coat",
  "a pilot's leather bomber jacket",
  "a professor's tweed blazer with elbow patches",
  "a mechanic's oil-stained coveralls",
  "a deep-sea diver's suit",
  "a mountaineer's insulated expedition gear",
  "a jazz musician's midnight-blue tuxedo",
  "a painter's smock speckled with colour",
  "a safari ranger's outfit and wide-brim hat",
  "a train conductor's pinstripe uniform",
  "a chef's crisp white jacket and toque",
  "a race-car driver's fitted racing suit",
  "a lighthouse keeper's rugged raincoat",
  "a 1920s newsreel reporter's suit and press hat",
  "a cyberpunk techwear jacket with neon trim",
  "a botanist's linen gardening apron",
  "a snowboarder's bright winter shell",
  "a stage magician's cape and waistcoat",
];

// Slugs are generated in one process, but single-post runs happen separately, so
// uniqueness is tracked in each post's `heroOutfit` frontmatter as well as this
// in-memory set for the current batch.
const usedOutfits = new Set();

async function loadUsedOutfits() {
  const slugs = await listPosts();
  for (const slug of slugs) {
    const p = await resolvePostPath(slug);
    if (!p) continue;
    const fm = parseFrontmatter(await readFile(p, "utf8"));
    if (fm?.heroOutfit) usedOutfits.add(fm.heroOutfit.toLowerCase());
  }
}

function pickUnusedOutfit() {
  const available = RANDOM_OUTFITS.filter(
    (o) => !usedOutfits.has(o.toLowerCase()),
  );
  const pool = available.length ? available : RANDOM_OUTFITS;
  return pool[Math.floor(Math.random() * pool.length)];
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
    heroOutfit: (body.match(/^heroOutfit:\s*(.+)$/m)?.[1] || "")
      .trim()
      .replace(/^['"]|['"]$/g, ""),
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
  for (const [key, scene] of TOPIC_SCENES) {
    if (haystacks.some((h) => h.includes(key))) return scene;
  }
  return "the person sharing what they have learned from a glowing laptop, ideas taking flight around them";
}

// Ask a chat model to turn THIS post into one concrete, unique visual scene so
// every hero looks different. Returns null on any failure so callers fall back
// to the static topic map.
async function deriveScene({ title, description, body }, cfg) {
  if (!cfg?.chatDeployment) return null;

  const url =
    `${cfg.endpoint.replace(/\/$/, "")}/openai/deployments/${cfg.chatDeployment}` +
    `/chat/completions?api-version=${cfg.apiVersion}`;

  const system =
    "You design editorial hero illustrations for a technical blog. Given a post, respond with ONLY a " +
    'compact JSON object: {"scene": string, "outfit": string|null}. ' +
    '"scene" is ONE vivid, concrete visual metaphor for what the recurring author is DOING, specific to ' +
    "this post's exact topic and story: a single clause that starts with 'the person', names concrete " +
    "objects/actions, 12-30 words. Make different posts look clearly different. Do NOT default to robots " +
    "surrounding someone, holding a pointer, or presenting slides. " +
    '"outfit" is a short (2-8 word) themed costume that clearly fits the post topic (e.g. a detective ' +
    "trench coat for a security investigation, an architect's hard hat and blueprints for building " +
    "something, a race kit for a getting-started sprint, a lab coat for experiments). Use null when the " +
    "topic does not clearly suggest a costume. No text, logos, camera terms, markdown, or commentary.";
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
        max_tokens: 160,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn(`  ! scene model returned ${res.status} ${res.statusText}; using topic fallback.\n${text}`);
      return null;
    }
    const json = await res.json();
    const content = json?.choices?.[0]?.message?.content?.trim();
    if (!content) return null;

    // Strip any accidental code fences, then parse. Fall back to treating the
    // whole reply as the scene with no outfit.
    const cleaned = content
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/, "")
      .trim();
    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const scene = cleaned.replace(/^["']|["']$/g, "").replace(/\.$/, "").trim();
      return scene ? { scene, outfit: null } : null;
    }

    const scene = (parsed.scene || "").toString().replace(/\.$/, "").trim();
    if (!scene) return null;
    let outfit = parsed.outfit;
    outfit = typeof outfit === "string" ? outfit.trim() : "";
    if (!outfit || /^(null|none|n\/a)$/i.test(outfit)) outfit = null;
    return { scene, outfit };
  } catch (err) {
    console.warn(`  ! scene model failed (${err.message}); using topic fallback.`);
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

  const derived = await deriveScene(
    { title: fm.title, description: fm.description, body: extractBody(raw) },
    cfg,
  );
  const scene = derived?.scene || pickScene(fm.tags, fm.title);

  // Prefer an outfit derived from the topic/content; otherwise assign a random
  // one. Either way it must be unique across posts, so don't count this post's
  // own existing outfit against itself when regenerating.
  if (fm.heroOutfit) usedOutfits.delete(fm.heroOutfit.toLowerCase());
  let outfit = derived?.outfit || null;
  if (!outfit || usedOutfits.has(outfit.toLowerCase())) {
    outfit = pickUnusedOutfit();
  }
  usedOutfits.add(outfit.toLowerCase());

  const composition = pickComposition();
  const outfitLine =
    `Dress the subject as ${outfit}, keeping their face clearly recognisable. ` +
    "Place a small, tasteful Microsoft logo (the four coloured squares) in an appropriate spot on " +
    "the subject's shirt or outerwear, such as a chest emblem or sleeve patch, correctly proportioned.";
  const prompt = `Scene: ${scene}. ${outfitLine} ${BASE_STYLE} ${composition}`;
  const alt = `Illustration of Russ Rimmerman \u2014 ${scene}.`;

  console.log(`\n\u25b6 ${fm.title || slug}`);
  console.log(`  tags:   ${fm.tags.join(", ") || "(none)"}`);
  console.log(`  outfit: ${outfit}`);
  console.log(`  prompt: ${prompt}`);

  if (dryRun) {
    console.log("  (dry run \u2014 no image generated)");
    return "dry-run";
  }

  const headshot = await readFile(cfg.headshotPath);
  const form = new FormData();
  form.append("prompt", prompt);
  form.append("size", "1536x1024");
  form.append("quality", "medium");
  form.append("n", "1");
  form.append(
    "image",
    new Blob([headshot], { type: "image/jpeg" }),
    path.basename(cfg.headshotPath),
  );

  const url =
    `${cfg.endpoint.replace(/\/$/, "")}/openai/deployments/${cfg.deployment}` +
    `/images/edits?api-version=${cfg.apiVersion}`;

  const token = await getAccessToken();
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

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
    .replace(/^heroAlt:.*$\n?/m, "")
    .replace(/^heroOutfit:.*$\n?/m, "");
  const patched = cleaned.replace(
    /^(title:.*)$/m,
    `$1\nheroImage: ${relFromPost}\nheroAlt: ${JSON.stringify(alt)}\nheroOutfit: ${JSON.stringify(outfit)}`,
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
  const headshotPath = path.resolve(
    ROOT,
    process.env.HEADSHOT_PATH || "src/assets/author/headshot.jpg",
  );
  if (!endpoint || !deployment) {
    fail(
      "Missing Azure OpenAI config. Set AZURE_OPENAI_ENDPOINT and " +
        "AZURE_OPENAI_IMAGE_DEPLOYMENT (in .env locally, or as CI env vars).",
    );
  }
  if (!(await exists(headshotPath))) {
    fail(`Headshot not found at ${headshotPath}. Add it or set HEADSHOT_PATH.`);
  }
  if (!chatDeployment) {
    console.warn(
      "! AZURE_OPENAI_CHAT_DEPLOYMENT is not set \u2014 falling back to the static " +
        "topic map, so hero scenes will be less content-specific.",
    );
  }
  cfg = { endpoint, deployment, chatDeployment, apiVersion, headshotPath };
}

const results = { generated: 0, skipped: 0, failed: 0, "dry-run": 0 };
await loadUsedOutfits();
for (const slug of targets) {
  const status = await generatePost(slug, { force, dryRun, cfg });
  results[status] = (results[status] ?? 0) + 1;
}

console.log(
  `\nDone. generated: ${results.generated}, skipped: ${results.skipped}, failed: ${results.failed}` +
    (dryRun ? `, dry-run: ${results["dry-run"]}` : ""),
);
if (results.failed > 0) process.exit(1);
