import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { readingTimeLabel } from "@/utils/readingTime";

function searchableBody(body: string | undefined) {
  return (body ?? "")
    .replace(/^(?:import|export)\s.+$/gm, " ")
    .replace(/^```.*$/gm, " ")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/[#>*_~`]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Build-time JSON index consumed by the client-side search on /search.
export const GET: APIRoute = async () => {
  const posts = (await getCollection("blog", ({ data }) => !data.draft)).sort(
    (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf()
  );

  const index = posts.map(post => ({
    title: post.data.title,
    description: post.data.description,
    tags: post.data.tags,
    url: `/blog/${post.id}/`,
    pubDate: post.data.pubDate.toISOString(),
    readingTime: readingTimeLabel(post.body),
    content: searchableBody(post.body),
  }));

  return new Response(JSON.stringify(index), {
    headers: { "content-type": "application/json; charset=utf-8" },
  });
};
