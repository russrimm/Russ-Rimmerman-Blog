import { config, fields, collection } from "@keystatic/core";

export default config({
  // Reads and writes Markdown/MDX files directly in this repo.
  // Run `npm run cms`, then open http://localhost:4321/keystatic
  storage: { kind: "local" },
  ui: {
    brand: { name: "Russ Rimmerman" },
  },
  collections: {
    blog: collection({
      label: "Blog Posts",
      slugField: "title",
      path: "src/content/blog/*",
      format: { contentField: "content" },
      entryLayout: "content",
      columns: ["title", "pubDate"],
      schema: {
        title: fields.slug({
          name: { label: "Title" },
          slug: {
            label: "Slug (URL)",
            description: "The unique part of the URL for this post.",
          },
        }),
        description: fields.text({
          label: "Description",
          description: "Short summary used for SEO and post cards.",
          multiline: true,
          validation: { length: { min: 1 } },
        }),
        pubDate: fields.date({
          label: "Publish Date",
          defaultValue: { kind: "today" },
          validation: { isRequired: true },
        }),
        updatedDate: fields.date({
          label: "Updated Date",
          description: "Optional. Set when you revise an existing post.",
        }),
        heroImage: fields.image({
          label: "Hero Image",
          directory: "src/content/blog/images",
          publicPath: "./images/",
        }),
        heroAlt: fields.text({ label: "Hero Image Alt Text" }),
        tags: fields.array(fields.text({ label: "Tag" }), {
          label: "Tags",
          itemLabel: (props) => props.value,
        }),
        draft: fields.checkbox({
          label: "Draft",
          description: "Hide this post from the live site.",
          defaultValue: false,
        }),
        featured: fields.checkbox({
          label: "Featured",
          description: "Highlight this post on the homepage.",
          defaultValue: false,
        }),
        content: fields.mdx({ label: "Content" }),
      },
    }),
    projects: collection({
      label: "Projects",
      slugField: "title",
      path: "src/content/projects/*",
      format: { contentField: "content" },
      entryLayout: "content",
      columns: ["title", "order"],
      schema: {
        title: fields.slug({
          name: { label: "Title" },
          slug: {
            label: "Slug (URL)",
            description: "The unique part of the URL for this project.",
          },
        }),
        summary: fields.text({
          label: "Summary",
          multiline: true,
          validation: { length: { min: 1 } },
        }),
        tech: fields.array(fields.text({ label: "Technology" }), {
          label: "Tech Stack",
          itemLabel: (props) => props.value,
        }),
        repoUrl: fields.url({ label: "Repository URL" }),
        liveUrl: fields.url({ label: "Live URL" }),
        image: fields.image({
          label: "Image",
          directory: "src/content/projects/images",
          publicPath: "./images/",
        }),
        imageAlt: fields.text({ label: "Image Alt Text" }),
        order: fields.integer({
          label: "Order",
          description: "Lower numbers appear first.",
          defaultValue: 0,
        }),
        featured: fields.checkbox({
          label: "Featured",
          description: "Highlight this project on the homepage.",
          defaultValue: false,
        }),
        content: fields.mdx({ label: "Content" }),
      },
    }),
  },
});
