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
// image. Each keeps a large, clean area for a title overlay while placing the
// author and the marker board naturally in the training room.
const COMPOSITIONS = [
  "Medium-wide three-quarter angle from the audience side of the room, camera slightly low: the author stands to the LEFT of frame at the whiteboard mid-drawing, the finished illustration fills the RIGHT two-thirds of the board, seated attendees blur softly in the foreground. Leave clean, quiet space in the UPPER-LEFT for a title overlay.",
  "Medium-wide three-quarter angle from behind and to the side of a few attendees, camera at seated eye-level: the author stands to the RIGHT of frame at the marker board, the completed diagram anchors the LEFT half of the board, out-of-focus heads and shoulders line the lower-foreground. Leave clean space in the UPPER-RIGHT for a title overlay.",
  "Wider training-room shot, camera slightly elevated near the back of the room: the author and the whiteboard fill the center-left, rows of engaged attendees fan out in the mid-ground, warm room lighting overhead. Leave open architectural space along the TOP of the frame for a title overlay.",
  "Cinematic medium shot centered on the whiteboard from an oblique angle: the author is turned partially toward the audience mid-explanation, marker in hand, the finished illustration dominates the board; two or three attentive attendees are visible in soft-focus profile on one side. Keep the LEFT third clean and uncluttered for a title overlay.",
];

// Wardrobe variety so the author is not wearing the same outfit in every hero.
// Each entry is a self-contained wardrobe brief that reads as one confident,
// modern, professional look for a Microsoft-adjacent cloud architect — never
// costumey, never repeating the same silhouette twice.
const OUTFITS = [
  "a fitted charcoal wool blazer over a crisp white oxford shirt, open collar, no tie",
  "a slate-blue merino crewneck sweater layered over a light grey collared shirt",
  "a heather grey quarter-zip pullover in soft technical fabric over a plain tee",
  "a navy Oxford button-down, sleeves rolled once, worn with a matte black analog watch",
  "a black turtleneck under an unstructured deep-navy overcoat draped naturally over one shoulder",
  "a warm cognac-brown suede bomber jacket over a black henley",
  "a matte black merino polo shirt with a subtle woven texture",
  "a deep forest green flannel overshirt worn open over a charcoal tee",
  "a soft cream cable-knit sweater with rolled sleeves",
  "a two-tone technical vest in dark navy and slate over a long-sleeve grey shirt",
  "a fitted denim jacket in washed indigo over a plain white tee, with dark selvedge jeans",
  "a slim dark plum blazer over a black crewneck",
  "a lightweight steel-blue chambray shirt, sleeves cuffed, worn untucked over dark chinos",
  "a chunky ribbed oatmeal cardigan over a soft heather tee, casually unbuttoned",
  "a black bomber jacket with a subtle olive undertone over a slim grey henley",
  "a warm terracotta sweatshirt in premium French terry, layered over a white tee",
];

// Deterministic pick from a slug hash so re-runs of the same post get the same
// look, but each post in the series gets its own outfit.
function hashSlug(slug) {
  let h = 0;
  for (let i = 0; i < slug.length; i += 1) {
    h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  }
  return h;
}

function pickComposition(slug) {
  return COMPOSITIONS[hashSlug(`${slug}::composition`) % COMPOSITIONS.length];
}

function pickOutfit(slug) {
  return OUTFITS[hashSlug(`${slug}::outfit`) % OUTFITS.length];
}

// Assemble the full art-direction prompt for one post. The scene is fixed:
// the author teaching a small training room, drawing the article's core idea
// on a large whiteboard so a completed hand-drawn diagram is already visible.
function buildPrompt({
  title,
  primaryTopic,
  secondaryTopics,
  summary,
  technologies,
  brief,
  composition,
  withHeadshot,
  outfit,
  hasReferenceImages,
}) {
  return [
    "You are a world-class editorial photographer and visual storyteller shooting a hero image for a technical blog post.",
    "The scene, style, and setting are FIXED across every post in this series \u2014 only the content of the whiteboard drawing and the specific topic-driven details change.",
    "SCENE (mandatory, do not reinterpret): a bright, modern corporate training room. The author stands at a large, clean white marker board (dry-erase whiteboard) at the front of the room, mid-explanation, holding a dry-erase marker in one hand with the marker cap in the other or tucked into a pocket. The author is turned partially toward a small audience of engaged adult professionals seated at rows of tables or chairs. Attendees are clearly listening, leaning in, some taking notes on laptops or notebooks \u2014 attentive, interested, respectful body language, no phones out, no bored expressions. Warm, even overhead lighting; a hint of morning window light from one side; realistic contemporary training-room details (subtle acoustic ceiling, simple modern chairs, a table with water glasses or coffee cups in the mid-ground).",
    "MARKER BOARD CONTENT: on the whiteboard, render a fully COMPLETED, confident, hand-drawn illustration in dry-erase marker that visually explains the topic of this specific blog post. It must look drawn BY HAND with a real marker \u2014 slightly imperfect strokes, natural marker weight variation, small ink bleed at line ends, occasional wobble \u2014 not printed, not vector, not a projected slide. Use only black, blue, and red (or orange) dry-erase colors. The drawing should read as a real, useful teaching diagram: boxes, arrows, flow lines, simple icons, small stick-figures, cloud/server shapes, layered rectangles, callout circles, and connecting arrows with arrowheads showing relationships between components. The author appears to be actively completing one part of it (marker touching the board), while most of the diagram is already finished.",
    "MARKER BOARD LABELS AND LOGOS (required): the diagram must include hand-drawn text labels next to the components they describe \u2014 topic names, service names, action names, table names, short arrow verbs \u2014 written as if by a person with a dry-erase marker (slightly uneven letters, mixed case, occasional underline or box around a key term). Where a real brand, product, or service from this post's tags is depicted, draw a small, recognizable, sketched approximation of that product's official logo in marker next to its label (for example: Microsoft, Azure, Copilot, Copilot Studio, Power Platform, Dataverse, GitHub, VS Code, Teams, SharePoint, Dynamics 365, Foundry, Intune, Entra, ServiceNow). Sketched logos and short official product names on the board are explicitly ALLOWED and encouraged \u2014 they make the diagram feel like something a practitioner actually drew while explaining this post.",
    "SPELLING RULE (critical): every visible word on the whiteboard must be a real, correctly spelled English or product word taken from this post's title, tags, or summary. Prefer short, common words and short official product names (one to three words each) so the model reliably spells them correctly. Do NOT invent words, do NOT produce jumbled or partial letters, and do NOT leave squiggle-text where a label belongs. If a phrase cannot be rendered legibly and correctly spelled, replace it with a shorter labeled box or a simple icon rather than garbled text. Only render labels the model can spell perfectly.",
    `Article title: ${title}.`,
    `Primary idea to draw on the board: ${primaryTopic}.`,
    secondaryTopics ? `Secondary themes that can appear as smaller connected diagram fragments on the board: ${secondaryTopics}.` : "",
    summary ? `What the article is really about (use this to decide what the diagram depicts): ${summary}.` : "",
    technologies
      ? `Underlying technologies to reference in the diagram \u2014 draw each as a small labeled component with its short official product name (spelled exactly as given) and a hand-sketched approximation of its logo where recognizable: ${technologies}.`
      : "",
    `Scene seed \u2014 subject matter to depict on the board: ${brief.subjects}.`,
    `Scene seed \u2014 technology focus for the board diagram (treat as metaphor, not literal UI): ${brief.technology}.`,
    "Subject handling for the drawing: if the article discusses architecture, draw a layered system diagram with connected components; if it discusses automation, draw a flow diagram with steps, arrows, and gears; if it discusses AI agents, draw distinct stick-figure agents with roles and arrows between them; if it discusses security or permissions, draw locks, keys, boundaries, and gates; if it discusses data, draw databases, pipelines, and flow lines. Pick whichever best fits THIS post.",
    `Composition: single 16:9 hero frame. ${composition}`,
    "Style direction: contemporary editorial photography, natural but flattering lighting, shallow-to-medium depth of field so the author and the board are the sharpest elements while attendees soften slightly in the foreground/mid-ground. Real-world materials and textures: marker sheen on the board, subtle glare, matte fabric, warm wood or neutral carpet, realistic skin tones. Not stylized, not illustrated, not cartoon \u2014 this is a real-photograph aesthetic.",
    "Color language accent (keep consistent across the series): deep navy, electric cyan, and soft violet appear in room accents (chair backs, wall art, window film, a subtle wall stripe), with one warm accent (amber or soft coral) used sparingly in the lighting or a small object. The whiteboard drawing itself uses only marker colors (black, blue, red/orange). Logos and product names appear ONLY on the whiteboard \u2014 never on the author's clothing, never on walls, never on window film, and never as room signage or watermarks.",
    "Tone: warm, credible, and human. The author looks confident and mid-thought \u2014 not smug, not stiff, not a stock \"presenter smile.\" The audience looks like a real, mixed group of adult professionals genuinely interested in the topic.",
    withHeadshot
      ? `IMPORTANT: the author is the single named human in this scene. Render that person to closely resemble the individual in the provided reference headshot photograph \u2014 matching their facial features, hair, skin tone, glasses (if any), and overall likeness. Dress that person specifically in ${outfit}. Do not default to a generic suit; do not repeat a look from another image in this series. Integrate them with realistic lighting, natural posture (one hand drawing on the board, body angled slightly toward the audience), and matching perspective. Never show the reference headshot photo itself in the frame.`
      : "",
    hasReferenceImages
      ? "Additional attached images are visual context lifted directly from the article (screenshots, diagrams, product shots). Use them to decide WHAT the author is drawing on the whiteboard: mirror their overall structure, relationships, and subject matter as a hand-drawn marker translation, and use them as a reference for the correct spelling and shape of any product names or logos that appear on the board. Do NOT reproduce full UI chrome, dashboards, or long strings of text from them \u2014 translate everything into hand-drawn boxes, arrows, short labels, and sketched logos on the board."
      : "",
    "Strictly avoid: people typing on laptops as the focal point, floating holograms, glowing brains, circuit-board backgrounds, generic robots, blue abstract technology backgrounds, projector screens as the focal point (the whiteboard is the focal point), any misspelled or garbled text on the board, brand logos or product names anywhere OTHER than on the whiteboard, and any cartoon or illustrated rendering style (photographic only).",
    "Describe and render the final scene in rich, specific visual detail: room lighting, atmosphere, composition, materials, the exact hand-drawn diagram on the board that explains this specific post, and the subtle human details in the audience that make the moment feel real.",
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
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
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

// --- Article reference images -------------------------------------------------
// Scan a post's raw MDX for image references (both `import x from "@/assets/..."`
// and markdown `![alt](url)`) so we can pass those images to the image-edit
// endpoint alongside the headshot. The model then uses them as visual context —
// palette, subject matter, mood — without literally reproducing UI or text.
const REF_IMAGE_EXTS = /\.(png|jpe?g|webp|gif|bmp|avif)$/i;
const MAX_REFERENCE_IMAGES = 3;

function collectPostImages(slug, raw) {
  const refs = [];
  const seen = new Set();

  const push = (source) => {
    if (!source) return;
    const key = source.trim();
    if (!key || seen.has(key)) return;
    seen.add(key);
    refs.push(key);
  };

  const importRe =
    /import\s+[^\n;]*?from\s+["'](@\/[^"']+?\.(?:png|jpe?g|webp|gif|bmp|avif))["']/gi;
  for (const m of raw.matchAll(importRe)) push(m[1]);

  const mdRe = /!\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  for (const m of raw.matchAll(mdRe)) push(m[1]);

  return refs.slice(0, MAX_REFERENCE_IMAGES);
}

function resolveImageRef(ref) {
  if (!ref) return null;
  if (ref.startsWith("data:")) return null;
  if (/^https?:\/\//i.test(ref)) return { kind: "remote", value: ref };
  if (ref.startsWith("@/")) {
    return { kind: "local", value: path.join(ROOT, "src", ref.slice(2)) };
  }
  if (ref.startsWith("/")) {
    return { kind: "local", value: path.join(ROOT, "public", ref.replace(/^\/+/, "")) };
  }
  return {
    kind: "local",
    value: path.join(BLOG_DIR, ref.replace(/^\.\//, "")),
  };
}

async function loadReferenceImagePng(ref) {
  const resolved = resolveImageRef(ref);
  if (!resolved) return null;
  const cleanPath = resolved.value.split("?")[0];
  if (!REF_IMAGE_EXTS.test(cleanPath)) return null;

  try {
    let source;
    if (resolved.kind === "remote") {
      const res = await fetch(resolved.value);
      if (!res.ok) {
        console.warn(`  ! reference image ${resolved.value} returned ${res.status} \u2014 skipping.`);
        return null;
      }
      source = Buffer.from(await res.arrayBuffer());
    } else {
      if (!(await exists(resolved.value))) {
        console.warn(`  ! reference image not found: ${path.relative(ROOT, resolved.value)} \u2014 skipping.`);
        return null;
      }
      source = resolved.value;
    }

    const buffer = await sharp(source)
      .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer();
    const base = path
      .basename(cleanPath)
      .replace(/\.[^.]+$/, "")
      .replace(/[^a-z0-9_-]+/gi, "-")
      .slice(0, 40) || "ref";
    return { buffer, filename: `${base}.png` };
  } catch (err) {
    console.warn(`  ! reference image ${ref} failed to load: ${err.message}`);
    return null;
  }
}

async function loadReferenceImages(slug, raw) {
  const refs = collectPostImages(slug, raw);
  if (refs.length === 0) return [];
  const loaded = await Promise.all(refs.map((r) => loadReferenceImagePng(r)));
  return loaded.filter(Boolean);
}

// Request one image from Azure OpenAI. When any reference images are supplied
// (author headshot, article screenshots), use the image-edit endpoint
// (multipart) so the model can lean on them for likeness and visual context;
// otherwise use pure text-to-image generation.
async function requestImage({ cfg, prompt, headshot, refImages = [] }) {
  const token = await getAccessToken();
  const base =
    `${cfg.endpoint.replace(/\/$/, "")}/openai/deployments/${cfg.deployment}`;

  const images = [];
  if (headshot) images.push({ buffer: headshot, filename: "headshot.png" });
  for (const r of refImages) images.push(r);

  if (images.length > 0) {
    const form = new FormData();
    form.append("prompt", prompt);
    form.append("size", "1536x1024");
    form.append("quality", "medium");
    form.append("n", "1");
    const field = images.length > 1 ? "image[]" : "image";
    for (const img of images) {
      form.append(
        field,
        new Blob([img.buffer], { type: "image/png" }),
        img.filename,
      );
    }
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

  const composition = pickComposition(slug);
  const outfit = pickOutfit(slug);
  // The whiteboard/training-room scene always features the author, so we
  // always pass the headshot as a likeness reference regardless of the
  // brief text.
  const withHeadshot = true;
  const refImages = await loadReferenceImages(slug, raw);
  const prompt = buildPrompt({
    title: fm.title,
    primaryTopic,
    secondaryTopics,
    summary: fm.description,
    technologies,
    brief,
    composition,
    withHeadshot,
    outfit,
    hasReferenceImages: refImages.length > 0,
  });
  const alt = `Cinematic enterprise hero image representing ${primaryTopic} \u2014 ${brief.environment}.`;

  console.log(`\n\u25b6 ${fm.title || slug}`);
  console.log(`  tags:   ${fm.tags.join(", ") || "(none)"}`);
  console.log(`  topic:  ${primaryTopic}`);
  if (withHeadshot) console.log(`  outfit: ${outfit}`);
  if (refImages.length > 0) {
    console.log(`  refs:   ${refImages.length} article image(s) attached as visual context.`);
  }
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

  const res = await requestImage({ cfg, prompt, headshot, refImages });

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
