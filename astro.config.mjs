import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import { unified } from "@astrojs/markdown-remark";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";

function accessibleCodeBlocks() {
  return tree => {
    const visit = node => {
      if (node?.type === "element" && node.tagName === "pre") {
        node.properties = {
          ...node.properties,
          "aria-label": "Code example",
          tabindex: 0,
        };
      }

      for (const child of node?.children ?? []) visit(child);
    };

    visit(tree);
  };
}

// https://astro.build/config
export default defineConfig({
  site: "https://www.russrimmerman.com",
  markdown: {
    processor: unified({
      rehypePlugins: [accessibleCodeBlocks],
    }),
    shikiConfig: {
      themes: {
        light: "github-light",
        dark: "github-dark",
      },
      wrap: true,
    },
  },
  integrations: [
    mdx(),
    sitemap({
      filter: page => page !== "https://www.russrimmerman.com/search/",
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
