export const SITE_TITLE = "Russ Rimmerman";
export const SITE_TAGLINE = "Microsoft Cloud Solution Architect";
export const SITE_DESCRIPTION =
  "The personal blog and portfolio of Russ Rimmerman, a Microsoft Cloud Solution Architect sharing the latest learnings on Azure, AI, and cloud engineering.";
export const SITE_URL = "https://www.russrimmerman.com";

export const AUTHOR = {
  name: "Russ Rimmerman",
  role: "Microsoft Cloud Solution Architect",
  email: "russ@russrimmerman.com",
};

export const SOCIALS = {
  linkedin: "https://www.linkedin.com/in/russrimm",
  github: "https://www.github.com/russrimm",
};

export const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/blog", label: "Blog" },
  { href: "/topics", label: "Topics" },
  { href: "/projects", label: "Projects" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

// Giscus comments configuration.
// TODO: Fill these in from https://giscus.app after enabling GitHub Discussions
// on a public repo (e.g. russrimm/russrimmerman.com) and installing the giscus app.
export const GISCUS = {
  repo: "russrimm/russrimmerman.com",
  repoId: "REPLACE_WITH_REPO_ID",
  category: "Comments",
  categoryId: "REPLACE_WITH_CATEGORY_ID",
  mapping: "pathname",
  reactionsEnabled: "1",
  emitMetadata: "0",
  inputPosition: "top",
  lang: "en",
};
