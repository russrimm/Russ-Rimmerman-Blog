import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const dist = path.join(root, "dist");
const siteOrigin = "https://www.russrimmerman.com";
const failures = [];
const utcDateFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});

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

function canonicalFor(route) {
  if (route === "index.html") return `${siteOrigin}/`;
  if (route.endsWith("/index.html")) {
    return `${siteOrigin}/${route.slice(0, -"index.html".length)}`;
  }
  return `${siteOrigin}/${route.replace(/\.html$/, "/")}`;
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
  const canonicalMatch = html.match(
    /<link\b[^>]*\brel="canonical"[^>]*\bhref="([^"]+)"/i
  );
  if (!canonicalMatch) {
    fail(`${route}: missing canonical link`);
  } else if (canonicalMatch[1] !== canonicalFor(route)) {
    fail(`${route}: unexpected canonical URL ${canonicalMatch[1]}`);
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

  for (const match of html.matchAll(
    /<time\b[^>]*\bdatetime="([^"]+)"[^>]*>([^<]+)<\/time>/gi
  )) {
    const date = new Date(match[1]);
    const expected = utcDateFormatter.format(date);
    if (Number.isNaN(date.valueOf()) || match[2].trim() !== expected) {
      fail(`${route}: visible date does not match ${match[1]} in UTC`);
    }
  }

  for (const match of html.matchAll(/<pre\b([^>]*)>/gi)) {
    if (
      !/\btabindex="0"/i.test(match[1]) ||
      !/\baria-label="Code example"/i.test(match[1])
    ) {
      fail(`${route}: code block is missing keyboard accessibility metadata`);
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
    if (
      url.pathname !== "/" &&
      !url.pathname.endsWith("/") &&
      !path.extname(url.pathname) &&
      (await exists(
        path.join(dist, url.pathname.replace(/^\/+/, ""), "index.html")
      ))
    ) {
      fail(`${route}: non-canonical internal target ${url.pathname}`);
    }
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

const rss = await readFile(path.join(dist, "rss.xml"), "utf8");
if (
  !/xmlns:atom="http:\/\/www\.w3\.org\/2005\/Atom"/i.test(rss) ||
  !/<atom:link\b[^>]*\bhref="https:\/\/www\.russrimmerman\.com\/rss\.xml"[^>]*\brel="self"[^>]*\btype="application\/rss\+xml"/i.test(
    rss
  )
) {
  fail("RSS feed is missing its Atom self-reference");
}

const searchHtml = await readFile(
  path.join(dist, "search", "index.html"),
  "utf8"
);
if (!/timeZone:[`'"]UTC[`'"]/.test(searchHtml)) {
  fail("Search date formatter is not pinned to UTC");
}

if (failures.length > 0) {
  console.error(`Site checks failed (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Site checks passed for ${htmlFiles.length} HTML pages.`);
