import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const dist = path.join(root, "dist");
const failures = [];

const fail = message => failures.push(message);

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(entryPath)));
    } else {
      files.push(entryPath);
    }
  }
  return files;
}

function routeFor(filePath) {
  return path.relative(dist, filePath).replaceAll("\\", "/");
}

async function resolveSitePath(pathname) {
  const decodedPath = decodeURIComponent(pathname);
  const relativePath = decodedPath.replace(/^\/+/, "");
  const candidates = path.extname(relativePath)
    ? [path.join(dist, relativePath)]
    : [
        path.join(dist, relativePath, "index.html"),
        path.join(dist, `${relativePath}.html`),
      ];

  if (!relativePath) candidates.unshift(path.join(dist, "index.html"));

  for (const candidate of candidates) {
    if (await exists(candidate)) return true;
  }
  return false;
}

for (const required of [
  "index.html",
  "404.html",
  "og-default.png",
  "rss.xml",
  "search.json",
  "site.webmanifest",
  "sitemap-index.xml",
  "staticwebapp.config.json",
]) {
  if (!(await exists(path.join(dist, required)))) {
    fail(`Missing required build output: ${required}`);
  }
}

const files = await walk(dist);
const htmlFiles = files.filter(file => file.endsWith(".html"));

for (const file of htmlFiles) {
  const route = routeFor(file);
  const html = await readFile(file, "utf8");
  const h1Count = (html.match(/<h1\b/gi) ?? []).length;

  if (!/<html\b[^>]*\blang="en"/i.test(html)) {
    fail(`${route}: missing html[lang="en"]`);
  }
  if (!/<meta\b[^>]*\bname="description"/i.test(html)) {
    fail(`${route}: missing meta description`);
  }
  if (!/<link\b[^>]*\brel="canonical"/i.test(html)) {
    fail(`${route}: missing canonical link`);
  }
  if (!/<main\b[^>]*\bid="main-content"/i.test(html)) {
    fail(`${route}: missing #main-content`);
  }
  if (!/href="#main-content"/i.test(html)) {
    fail(`${route}: missing skip link`);
  }
  if (h1Count !== 1) {
    fail(`${route}: expected exactly 1 h1, found ${h1Count}`);
  }

  const jsonLdMatch = html.match(
    /<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i
  );
  if (!jsonLdMatch) {
    fail(`${route}: missing JSON-LD`);
  } else {
    try {
      const data = JSON.parse(jsonLdMatch[1]);
      const graph = Array.isArray(data?.["@graph"]) ? data["@graph"] : [];
      if (!graph.some(item => item?.["@type"] === "WebSite")) {
        fail(`${route}: JSON-LD is missing WebSite data`);
      }
      if (
        route.startsWith("blog/") &&
        route !== "blog/index.html" &&
        !graph.some(item => item?.["@type"] === "BlogPosting")
      ) {
        fail(`${route}: JSON-LD is missing BlogPosting data`);
      }
    } catch {
      fail(`${route}: JSON-LD is not valid JSON`);
    }
  }

  if (
    (route === "404.html" || route === "search/index.html") &&
    !/<meta\b[^>]*\bname="robots"[^>]*\bcontent="noindex, follow"/i.test(html)
  ) {
    fail(`${route}: expected noindex robots metadata`);
  }

  for (const match of html.matchAll(/<img\b([^>]*)>/gi)) {
    const attributes = match[1];
    if (!/\balt(?:="[^"]*")?(?:\s|$)/i.test(attributes)) {
      fail(`${route}: image is missing alt text`);
    }
    if (
      !/\bwidth="\d+"/i.test(attributes) ||
      !/\bheight="\d+"/i.test(attributes)
    ) {
      fail(`${route}: image is missing intrinsic dimensions`);
    }
  }

  const internalTargets = [
    ...html.matchAll(/\b(?:href|src)="(\/[^"]*)"/gi),
  ].map(match => match[1]);

  for (const target of internalTargets) {
    if (
      target.startsWith("//") ||
      target.startsWith("/api/") ||
      target.includes("${")
    ) {
      continue;
    }
    const url = new URL(target.replaceAll("&amp;", "&"), "https://example.com");
    if (!(await resolveSitePath(url.pathname))) {
      fail(`${route}: broken internal target ${url.pathname}`);
    }
  }
}

const sitemapFiles = files.filter(
  file => file.endsWith(".xml") && path.basename(file).startsWith("sitemap-")
);
const sitemap = (
  await Promise.all(sitemapFiles.map(file => readFile(file, "utf8")))
).join("\n");
for (const excluded of ["/404/", "/search/"]) {
  if (sitemap.includes(excluded)) {
    fail(`Sitemap includes excluded route: ${excluded}`);
  }
}

if (failures.length > 0) {
  console.error(`Site checks failed (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Site checks passed for ${htmlFiles.length} HTML pages.`);
