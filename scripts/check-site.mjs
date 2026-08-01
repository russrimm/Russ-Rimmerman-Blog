import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const dist = path.join(root, "dist");
const contentRoot = path.join(root, "src", "content");
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

async function resolveSiteFile(pathname) {
  const decodedPath = decodeURIComponent(pathname);
  const relativePath = decodedPath.replace(/^\/+/, "").replace(/\/$/, "");
  const candidates = path.extname(relativePath)
    ? [path.join(dist, relativePath)]
    : [
        path.join(dist, relativePath, "index.html"),
        path.join(dist, `${relativePath}.html`),
      ];

  if (!relativePath) candidates.unshift(path.join(dist, "index.html"));

  for (const candidate of candidates) {
    if (await exists(candidate)) return candidate;
  }
  return null;
}

function plainText(contents) {
  return contents
    .replace(/<svg\b[\s\S]*?<\/svg>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&(?:nbsp|#160);/gi, " ")
    .trim();
}

function hasAccessibleName(
  attributes,
  contents = "",
  labelledText = new Map()
) {
  if (
    /\baria-label="[^"]+"/i.test(attributes) ||
    /\btitle="[^"]+"/i.test(attributes)
  ) {
    return true;
  }

  const labelledBy = attributes.match(/\baria-labelledby="([^"]+)"/i)?.[1];
  if (
    labelledBy
      ?.split(/\s+/)
      .some(id => (labelledText.get(id) ?? "").trim().length > 0)
  ) {
    return true;
  }

  const text = plainText(contents);
  return text.length > 0 || /<img\b[^>]*\balt="[^"]+"/i.test(contents);
}

for (const required of [
  "index.html",
  "404.html",
  "apple-touch-icon.png",
  "icon-192.png",
  "icon-512.png",
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
const htmlCache = new Map();

async function readHtml(file) {
  if (!htmlCache.has(file)) {
    htmlCache.set(file, await readFile(file, "utf8"));
  }
  return htmlCache.get(file);
}

for (const file of htmlFiles) {
  const route = routeFor(file);
  const html = await readHtml(file);
  const markup = html.replace(/<script\b[\s\S]*?<\/script>/gi, "");
  const headingLevels = [...markup.matchAll(/<h([1-6])\b/gi)].map(match =>
    Number(match[1])
  );
  const h1Count = headingLevels.filter(level => level === 1).length;

  if (!/<html\b[^>]*\blang="en"/i.test(html)) {
    fail(`${route}: missing html[lang="en"]`);
  }
  if (!/<meta\b[^>]*\bname="description"/i.test(html)) {
    fail(`${route}: missing meta description`);
  }
  const appleIconTag = markup.match(
    /<link\b[^>]*\brel="apple-touch-icon"[^>]*>/i
  )?.[0];
  if (
    !appleIconTag ||
    !/\bsizes="180x180"/i.test(appleIconTag) ||
    !/\bhref="\/apple-touch-icon\.png"/i.test(appleIconTag)
  ) {
    fail(`${route}: missing Apple touch icon metadata`);
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
  for (let index = 1; index < headingLevels.length; index += 1) {
    if (headingLevels[index] > headingLevels[index - 1] + 1) {
      fail(
        `${route}: heading level skips from h${headingLevels[index - 1]} to h${headingLevels[index]}`
      );
    }
  }

  const mainCount = (markup.match(/<main\b/gi) ?? []).length;
  const footerCount = (markup.match(/<footer\b/gi) ?? []).length;
  const mainStart = markup.search(/<main\b/i);
  const bannerCount =
    mainStart >= 0
      ? (markup.slice(0, mainStart).match(/<header\b/gi) ?? []).length
      : 0;
  if (mainCount !== 1 || footerCount !== 1 || bannerCount !== 1) {
    fail(
      `${route}: expected one banner, main, and footer landmark; found ${bannerCount}/${mainCount}/${footerCount}`
    );
  }

  const ids = [...markup.matchAll(/\bid="([^"]+)"/gi)].map(match => match[1]);
  const labelledText = new Map();
  for (const match of markup.matchAll(
    /<([a-z][\w-]*)\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/\1>/gi
  )) {
    labelledText.set(match[2], plainText(match[3]));
  }
  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
  for (const id of new Set(duplicateIds)) {
    fail(`${route}: duplicate id "${id}"`);
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

  for (const match of markup.matchAll(/<img\b([^>]*)>/gi)) {
    const attributes = match[1];
    const altMatch = attributes.match(/\balt(?:="([^"]*)")?(?=\s|$)/i);
    if (!altMatch) {
      fail(`${route}: image is missing alt text`);
    } else if ((altMatch[1] ?? "").trim() === "") {
      const preceding = markup.slice(0, match.index);
      const openAnchor = preceding.lastIndexOf("<a");
      const closeAnchor = preceding.lastIndexOf("</a>");
      const anchorTag =
        openAnchor > closeAnchor
          ? preceding.slice(openAnchor, preceding.indexOf(">", openAnchor) + 1)
          : "";
      if (
        anchorTag &&
        !/\baria-hidden="true"/i.test(anchorTag) &&
        !hasAccessibleName(anchorTag, "", labelledText)
      ) {
        fail(`${route}: linked decorative image has no accessible link name`);
      }
    }

    if (
      !/\bwidth="\d+"/i.test(attributes) ||
      !/\bheight="\d+"/i.test(attributes)
    ) {
      fail(`${route}: image is missing intrinsic dimensions`);
    }
  }

  const labels = new Set(
    [...markup.matchAll(/<label\b[^>]*\bfor="([^"]+)"/gi)].map(
      match => match[1]
    )
  );
  for (const match of markup.matchAll(/<(input|select|textarea)\b([^>]*)>/gi)) {
    const attributes = match[2];
    if (/\btype="hidden"/i.test(attributes)) continue;
    const id = attributes.match(/\bid="([^"]+)"/i)?.[1];
    if (
      !hasAccessibleName(attributes, "", labelledText) &&
      (!id || !labels.has(id))
    ) {
      fail(`${route}: ${match[1].toLowerCase()} control is missing a label`);
    }
  }

  for (const match of markup.matchAll(
    /<(button|a)\b([^>]*)>([\s\S]*?)<\/\1>/gi
  )) {
    const [, element, attributes, contents] = match;
    if (/\baria-hidden="true"/i.test(attributes)) continue;
    if (!hasAccessibleName(attributes, contents, labelledText)) {
      fail(
        `${route}: ${element.toLowerCase()} control is missing an accessible name`
      );
    }
  }

  for (const match of markup.matchAll(
    /<time\b[^>]*\bdatetime="([^"]+)"[^>]*>([^<]+)<\/time>/gi
  )) {
    const date = new Date(match[1]);
    const expected = utcDateFormatter.format(date);
    if (Number.isNaN(date.valueOf()) || match[2].trim() !== expected) {
      fail(`${route}: visible date does not match ${match[1]} in UTC`);
    }
  }

  for (const match of markup.matchAll(/<pre\b([^>]*)>/gi)) {
    if (
      !/\btabindex="0"/i.test(match[1]) ||
      !/\baria-label="Code example"/i.test(match[1])
    ) {
      fail(`${route}: code block is missing keyboard accessibility metadata`);
    }
  }

  const internalTargets = [...markup.matchAll(/\b(?:href|src)="([^"]*)"/gi)]
    .map(match => match[1].replaceAll("&amp;", "&"))
    .filter(
      target =>
        target.startsWith("/") ||
        target.startsWith("#") ||
        target.startsWith(siteOrigin)
    );

  for (const target of internalTargets) {
    if (
      target.startsWith("//") ||
      target.startsWith("/api/") ||
      target.includes("${")
    ) {
      continue;
    }
    const url = new URL(target, canonicalFor(route));
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
    const targetFile = await resolveSiteFile(url.pathname);
    if (!targetFile) {
      fail(`${route}: broken internal target ${url.pathname}`);
      continue;
    }
    if (url.hash) {
      const targetHtml = await readHtml(targetFile);
      const targetId = decodeURIComponent(url.hash.slice(1));
      const targetIds = new Set(
        [...targetHtml.matchAll(/\bid="([^"]+)"/gi)].map(match => match[1])
      );
      if (!targetIds.has(targetId)) {
        fail(`${route}: broken internal anchor ${url.pathname}${url.hash}`);
      }
    }
  }
}

for (const sourceFile of (await walk(contentRoot)).filter(file =>
  /\.(?:md|mdx)$/i.test(file)
)) {
  const source = await readFile(sourceFile, "utf8");
  const targets = [
    ...source.matchAll(/\]\((\/[^)\s]+)\)/g),
    ...source.matchAll(/\bhref=["'](\/[^"']+)["']/g),
  ].map(match => match[1]);
  for (const target of targets) {
    const url = new URL(target, siteOrigin);
    if (
      url.pathname !== "/" &&
      !url.pathname.endsWith("/") &&
      !path.extname(url.pathname)
    ) {
      fail(
        `${path.relative(root, sourceFile)}: non-canonical content link ${url.pathname}`
      );
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

const manifest = JSON.parse(
  await readFile(path.join(dist, "site.webmanifest"), "utf8")
);
for (const expected of [
  { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
  { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
]) {
  if (
    !manifest.icons?.some(
      icon =>
        icon.src === expected.src &&
        icon.sizes === expected.sizes &&
        icon.type === expected.type
    )
  ) {
    fail(`Web manifest is missing ${expected.src} metadata`);
  }
}

const css = (
  await Promise.all(
    files
      .filter(file => file.endsWith(".css"))
      .map(file => readFile(file, "utf8"))
  )
).join("\n");
if (
  !/@media\s*\(prefers-reduced-motion:\s*reduce\)/i.test(css) ||
  !/transition-duration:\s*0?\.0+1ms\s*!important/i.test(css) ||
  !/animation-duration:\s*0?\.0+1ms\s*!important/i.test(css) ||
  !/animation-iteration-count:\s*1\s*!important/i.test(css)
) {
  fail("Generated CSS is missing the reduced-motion override");
}

if (failures.length > 0) {
  console.error(`Site checks failed (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Site checks passed for ${htmlFiles.length} HTML pages.`);
