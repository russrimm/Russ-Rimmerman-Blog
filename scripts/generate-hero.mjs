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

// Randomised framing so heroes don't all share the same angle and pose. One is
// picked per image. The mix intentionally alternates:
//   - INTIMATE PORTRAITS: tight medium/close-up of the author alone at a large
//     dry-erase board, sometimes actively drawing, sometimes standing back to
//     study or gesture at the completed diagram (marker capped or held loose).
//   - PRESENTING TO A SMALL ROOM: wider frames where three to eight
//     professional attendees are visible (seated or standing, softly out of
//     focus) while the author presents at the whiteboard. The author still
//     dominates the composition; the audience reads as a small, natural
//     meeting, never a lecture hall.
// Every variant leaves a clean, quiet region for a title overlay.
const COMPOSITIONS = [
  // --- Intimate portrait, mid-drawing ---
  "Tight editorial medium close-up from the LEFT side of the author, camera at eye level: the author's head and shoulders occupy the LEFT third of the frame in sharp profile, glasses catching the light, one hand actively drawing on the whiteboard with a black dry-erase marker mid-stroke. The clean white marker board fills the RIGHT two-thirds of the frame, with the completed hand-drawn diagram already covering most of it. Background beyond the board is a soft, out-of-focus modern office wall (warm wood panel or neutral matte plaster). No other people in the frame. Leave quiet negative space in the UPPER-RIGHT of the whiteboard for a title overlay.",
  "Cinematic close portrait shot from a low three-quarter angle behind the author's opposite shoulder, camera just above waist height: the author is in the RIGHT foreground, softly framed, one hand raised drawing on the board with a dry-erase marker mid-stroke; the whiteboard dominates the frame from a slight perspective angle, the completed diagram wrapping most of its surface in hand-drawn marker. Shallow depth of field, warm studio-office lighting. No other people in the frame. Leave quiet negative space in the UPPER-LEFT of the whiteboard for a title overlay.",

  // --- Intimate portrait, NOT drawing (natural in-between moment) ---
  "Editorial medium shot from the RIGHT side of the author, camera at eye level: the author stands relaxed a small step back from the whiteboard, marker CAPPED and held loosely at their side, weight on one leg, head tilted slightly as they study the completed diagram they just finished drawing. The whiteboard fills the LEFT two-thirds of the frame with a fully finished hand-drawn diagram; no hand touches the board. Background is a soft, out-of-focus modern office (neutral wall, hint of warm wood). No other people in the frame. Leave quiet negative space in the UPPER-LEFT of the whiteboard for a title overlay.",
  "Editorial medium close-up from the LEFT side of the author, camera at eye level: the author stands facing the completed whiteboard in three-quarter profile, one open hand gesturing toward a labeled section of the diagram as if walking through it, the other hand holding the dry-erase marker capped at their side (NOT touching the board). Glasses catch the light, expression thoughtful mid-thought. The whiteboard fills the RIGHT two-thirds of the frame with the completed hand-drawn diagram. Background is soft, out-of-focus warm wood or matte plaster. No other people in the frame. Leave quiet negative space in the UPPER-RIGHT of the whiteboard for a title overlay.",

  // --- Presenting to a small room ---
  "Wide editorial three-quarter shot of a small modern meeting room, camera positioned at the back of the room at seated eye level: three to five professional attendees (mixed genders, business casual, softly out of focus) sit in comfortable modern chairs in the FOREGROUND with their backs partly to the camera, facing away toward the author. The author stands at the large whiteboard in the BACKGROUND center-left, in sharp focus, mid-explanation with one hand gesturing openly toward the completed diagram and the dry-erase marker held (capped or open) in the other hand. The whiteboard shows the fully completed hand-drawn diagram. Warm, natural meeting-room light from soft ceiling fixtures. Leave quiet negative space in the UPPER-RIGHT of the frame near the whiteboard for a title overlay.",
  "Wide editorial side shot of a small modern conference room, camera at standing eye level along the side wall: the author stands at the whiteboard on the LEFT side of the frame, sharp focus, one hand mid-stroke actively drawing a final connecting arrow on an otherwise completed hand-drawn diagram. Four to six professional attendees sit or stand along the RIGHT side of the frame in soft focus, listening attentively, some with open notebooks or coffee cups. The completed hand-drawn diagram covers most of the whiteboard behind the author. Warm indirect lighting, out-of-focus wood-paneled wall in the deep background. Leave quiet negative space in the UPPER-CENTER above the whiteboard for a title overlay.",
  "Medium-wide over-the-shoulder shot from an attendee's point of view, camera at seated eye level: the softly out-of-focus back of one attendee's head and shoulder fills the BOTTOM-LEFT corner of the foreground. Beyond them, the author stands in sharp focus at the whiteboard on the RIGHT, body angled three-quarter toward the completed diagram and slightly toward the room, marker capped in one hand, the other hand relaxed at their side — mid-pause between thoughts, not currently drawing. Two or three additional attendees are visible in soft focus in the mid-ground. The whiteboard behind the author shows the fully completed hand-drawn diagram. Warm, natural meeting-room lighting. Leave quiet negative space in the UPPER-RIGHT of the frame near the whiteboard for a title overlay.",
  "Editorial wide shot from a low front-of-room angle, camera just above seated eye level: the author stands at the whiteboard in the LEFT-CENTER of the frame, turned partway from the board toward the room mid-explanation, one hand gesturing openly at the completed diagram behind them, the other hand holding the dry-erase marker at waist height (NOT touching the board). Five to eight professional attendees are visible in soft focus along the RIGHT half of the frame, seated in a comfortable modern arrangement, engaged and listening. The completed hand-drawn diagram fills the whiteboard behind the author. Warm, natural indirect lighting. Leave quiet negative space in the UPPER-LEFT of the frame near the whiteboard for a title overlay.",
];

// Wardrobe variety so the author is not wearing the same outfit in every hero.
// Weighted heavily toward BUSINESS CASUAL (blazer with open collar, sweater
// over collared shirt, quality knit, chambray, quarter-zip, etc.) with only an
// OCCASIONAL BUSINESS PROFESSIONAL look (tailored suit or sport coat with
// dress shirt and tie). Because outfit selection is a deterministic hash over
// this array, the ratio here IS the ratio you'll see across the series.
// Every entry reads as one confident, modern, workplace-appropriate look —
// never costumey, never repeating the same silhouette twice.
const OUTFITS = [
  // Business professional (occasional — keep short)
  "a tailored navy two-piece suit worn with a light blue dress shirt and a burgundy silk tie",
  "a charcoal grey wool suit with a subtle pinstripe, worn with a crisp white dress shirt and a deep navy silk tie",
  "a medium grey sport coat over a pale blue dress shirt with a woven forest-green tie",

  // Business casual (the everyday look — kept long)
  "a fitted charcoal wool blazer over a crisp white oxford shirt, open collar, no tie",
  "a slate-blue merino crewneck sweater layered over a light grey collared shirt, collar peeking out cleanly",
  "a navy Oxford button-down, sleeves rolled once, worn with a matte black analog watch",
  "a matte black merino quarter-zip pullover over a plain white tee, worn with dark chinos",
  "a heather grey merino v-neck sweater layered over a light blue collared shirt",
  "a lightweight steel-blue chambray shirt, sleeves cuffed, worn untucked over dark chinos",
  "a slim dark plum blazer over a black crewneck sweater",
  "a soft cream cable-knit sweater with a collared shirt peeking out at the neck, sleeves rolled",
  "a black turtleneck under an unstructured deep-navy overcoat draped naturally over one shoulder",
  "a soft camel unstructured blazer over a plain white tee, worn with dark chinos",
  "a fine-gauge navy merino sweater with a light grey collared shirt showing at the neck and cuffs",
  "a charcoal quarter-zip fleece over a light chambray shirt, collar out",
  "an olive-green field jacket worn open over a cream henley and dark selvedge denim",
  "a warm oatmeal-beige crewneck sweatshirt in soft heavyweight cotton over a white collared shirt, sleeves pushed up",
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
// a tight editorial portrait of the author at a large whiteboard, actively
// drawing the article's core idea, with the completed hand-drawn diagram
// already visible on the board.
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
    "SCENE (mandatory, do not reinterpret): an editorial photograph of the author at a large, clean white dry-erase marker board in a modern, softly-lit office, studio, or small conference room. The author is always the primary SUBJECT of the frame. Some frames are tight, intimate portraits of the author alone at the board; other frames are wider and show the author presenting to a small professional audience (three to eight attendees, softly out of focus, seated or standing in a modern meeting room). The author's pose varies naturally between images: sometimes actively drawing on the board mid-stroke with a black dry-erase marker, sometimes standing back to study the finished diagram, sometimes gesturing at the board with the marker capped in one hand, sometimes turned partway toward the audience mid-explanation. The whiteboard is clean and matte-white and always shows a completed hand-drawn diagram relevant to this post. The background beyond the board is a soft, out-of-focus modern interior — warm wood panel, wood door, matte plaster wall, or a softly-blurred meeting room — never a training room with rows of student desks, never a classroom, never a lecture hall. Natural, flattering studio-quality light falls from the front and slightly to one side, catching the author's glasses and the sheen of the marker board. Follow the Composition line below to decide whether the frame is an intimate portrait or a room shot with an audience, and to decide the author's exact pose.",
    "MARKER BOARD CONTENT (must reflect THIS specific post): on the whiteboard, render a fully COMPLETED, confident, hand-drawn illustration in dry-erase marker that visually explains the topic of THIS specific blog post \u2014 not a generic tech diagram. The drawing must clearly correspond to the post's title, primary idea, summary, and technologies below: pick the shapes, arrows, labels, and icons that a practitioner would actually sketch while teaching this exact article. It must look drawn BY HAND with a real marker \u2014 slightly imperfect strokes, natural marker weight variation, small ink bleed at line ends, occasional wobble \u2014 not printed, not vector, not a projected slide. Use primarily black dry-erase marker with restrained accents of blue and red (or orange) to highlight key elements. Include a short hand-lettered TITLE at the top of the board (derived from this post's title), a small labeled sequence of boxes or icons with connecting arrows showing the main flow, a short numbered or bulleted list of key steps or concepts down one side, and a small callout cloud with a memorable summary phrase from the post. Whether the author is currently drawing, gesturing, standing back, or turned partly toward an audience is dictated by the Composition line below; regardless of that pose, the diagram itself must always appear finished and readable on the board.",
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
    "Style direction: contemporary editorial portrait photography, natural but flattering studio-quality lighting, shallow-to-medium depth of field so the author's face and the whiteboard content are the sharpest elements while the background wall softens into a gentle blur. Real-world materials and textures: marker sheen on the board, subtle glare, matte fabric, warm wood grain, realistic skin tones and hair detail. Not stylized, not illustrated, not cartoon \u2014 this is a real-photograph aesthetic.",
    "Color language accent (keep consistent across the series): the background allows quiet accents of warm wood, deep navy, or soft neutral plaster; there is no colored wall art, window film, or signage in the frame. The whiteboard drawing itself uses primarily black marker with restrained blue and red (or orange) highlights. Logos and product names appear ONLY on the whiteboard \u2014 never on the author's clothing, never on walls, and never as room signage or watermarks.",
    "Tone: warm, credible, and human. The author looks confident and mid-thought \u2014 focused on the board, not the camera; not smug, not stiff, not a stock \"presenter smile.\"",
    withHeadshot
      ? `IMPORTANT: the author is the named human presenter in this scene. Render that person to closely resemble the individual in the provided reference headshot photograph \u2014 matching their facial features, hair, skin tone, glasses (if any), facial hair, and overall likeness. Dress that person specifically in ${outfit}. Do not default to a random look; do not repeat a look from another image in this series. The author's exact pose (drawing on the board, standing back to study it, gesturing at it with the marker capped, or turned partway toward a small audience) is dictated by the Composition line \u2014 follow that composition precisely and do not force the author into a mid-stroke drawing pose if the composition says otherwise. Integrate the author with realistic lighting and matching perspective. Never show the reference headshot photo itself in the frame. Any additional people in the frame (attendees, audience) must be believable, generic, softly out-of-focus adults \u2014 never other named individuals, never anyone resembling the reference headshot.`
      : "",
    hasReferenceImages
      ? "Additional attached images are visual context lifted directly from the article (screenshots, diagrams, product shots). Use them to decide WHAT the author is drawing on the whiteboard: mirror their overall structure, relationships, and subject matter as a hand-drawn marker translation, and use them as a reference for the correct spelling and shape of any product names or logos that appear on the board. Do NOT reproduce full UI chrome, dashboards, or long strings of text from them \u2014 translate everything into hand-drawn boxes, arrows, short labels, and sketched logos on the board."
      : "",
    "Strictly avoid: lecture halls, classrooms, training rooms with rows of student desks, projector screens, laptops or phones held up in the frame, floating holograms, glowing brains, circuit-board backgrounds, generic robots, abstract blue technology backgrounds, any misspelled or garbled text on the board, brand logos or product names anywhere OTHER than on the whiteboard, any cartoon or illustrated rendering style (photographic only), and any additional person whose face is a sharp copy of the author's likeness \u2014 the author is the only sharply-focused named individual in every frame.",
    "Describe and render the final scene in rich, specific visual detail: the lighting on the author's face and glasses, the sheen of the marker on the board, the exact hand-drawn diagram that explains this specific post, and the quiet, uncluttered background \u2014 the whole frame should feel like a single, intentional editorial portrait.",
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
