import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";

// The Keystatic admin UI is only loaded when running `npm run cms`
// (KEYSTATIC=true). The default `npm run build` stays a pure static site,
// so the Azure Static Web Apps deployment is unaffected.
const enableKeystatic = process.env.KEYSTATIC === "true";

const keystaticIntegrations = enableKeystatic
  ? [
      (await import("@astrojs/react")).default(),
      (await import("@keystatic/astro")).default(),
    ]
  : [];

// https://astro.build/config
export default defineConfig({
  site: "https://www.russrimmerman.com",
  integrations: [mdx(), sitemap(), ...keystaticIntegrations],
  vite: {
    plugins: [tailwindcss()],
  },
  markdown: {
    shikiConfig: {
      themes: {
        light: "github-light",
        dark: "github-dark",
      },
      wrap: true,
    },
  },
});
