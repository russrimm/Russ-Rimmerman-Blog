import type { CollectionEntry } from "astro:content";
import type { IconName } from "./icons";

export interface TopicDef {
  /** URL slug used at /topics/{slug}. */
  slug: string;
  /** Display name. */
  title: string;
  /** Short summary used on cards. */
  description: string;
  /** Longer lede shown on the hub header. */
  intro: string;
  /** Line icon key. */
  icon: IconName;
  /** Content tags (case-insensitive) that belong to this topic. */
  tags: string[];
  /** "What you'll find here" bullet points. */
  focus: string[];
}

/**
 * Curated topic hubs. A hub is only surfaced when it has matching published
 * content, so readers are never sent to an empty page.
 */
export const TOPICS: TopicDef[] = [
  {
    slug: "ai-and-agents",
    title: "AI & Agents",
    description:
      "Agentic systems, model selection, and building assistants that actually ship.",
    intro:
      "Notes on designing and shipping AI agents on the Microsoft stack — choosing the right model, grounding on trustworthy data, wiring up MCP servers, and keeping everything secure by default.",
    icon: "sparkles",
    tags: ["AI", "MCP"],
    focus: [
      "Agent design patterns and model selection",
      "Grounding, tools, and MCP servers",
      "Security, identity, and least privilege for AI",
    ],
  },
  {
    slug: "m365-copilot",
    title: "M365 Copilot",
    description:
      "Extending and rolling out Microsoft 365 Copilot across the enterprise.",
    intro:
      "Practical guidance on Microsoft 365 Copilot — from extending the experiences you already have to driving adoption and governance across the enterprise.",
    icon: "chip",
    tags: ["M365 Copilot", "Copilot"],
    focus: [
      "Extending Microsoft 365 Copilot",
      "Adoption and change management",
      "Governance and rollout in the enterprise",
    ],
  },
  {
    slug: "copilot-studio",
    title: "Copilot Studio",
    description:
      "Building purpose-built agents and custom copilots in Copilot Studio.",
    intro:
      "Hands-on guidance for Copilot Studio — designing, building, and shipping purpose-built agents that solve real business problems.",
    icon: "chip",
    tags: ["Copilot Studio"],
    focus: [
      "Building agents in Copilot Studio",
      "Topics, actions, and knowledge sources",
      "Testing, publishing, and governance",
    ],
  },
  {
    slug: "vibe-coding",
    title: "Vibe Coding",
    description:
      "Shipping real software by steering AI — plan mode, skills, and MCP servers.",
    intro:
      "How a Microsoft architect ships working software without being a developer — describing outcomes in plain language, steering AI, and knowing what good looks like.",
    icon: "code",
    tags: ["Vibe Coding"],
    focus: [
      "Plan mode, skills, and picking the right model",
      "Wiring up MCPs like MS Learn and Azure",
      "Turning demos into software you actually ship",
    ],
  },
  {
    slug: "azure-and-cloud",
    title: "Azure & Cloud",
    description:
      "Architecture, identity, and governance patterns across the Azure platform.",
    intro:
      "Field-tested architecture, identity, and governance guidance for the Azure platform — the patterns and trade-offs behind solutions that hold up in production.",
    icon: "shield",
    tags: ["Azure"],
    focus: [
      "Cloud architecture and design patterns",
      "Identity, security, and governance",
      "Cost, reliability, and operational trade-offs",
    ],
  },
  {
    slug: "power-platform",
    title: "Power Platform",
    description:
      "Low-code apps, automation, and business process design that scales.",
    intro:
      "Building low-code solutions on the Power Platform — apps, automation, and business process design that stays maintainable as it grows.",
    icon: "flow",
    tags: ["Power Platform"],
    focus: [
      "Power Apps and Power Automate patterns",
      "Business process automation",
      "Governance and application lifecycle",
    ],
  },
  {
    slug: "intune-and-endpoints",
    title: "Intune & Endpoints",
    description:
      "Endpoint management, device configuration, and modern workplace security.",
    intro:
      "Managing and securing endpoints with Microsoft Intune — device configuration, compliance, and the modern workplace, drawn from years in the field.",
    icon: "device",
    tags: ["Intune"],
    focus: [
      "Device configuration and compliance",
      "Endpoint security and hardening",
      "Modern workplace management at scale",
    ],
  },
];

/** True when a post carries any tag that belongs to the topic. */
export const postMatchesTopic = (
  post: CollectionEntry<"blog">,
  topic: TopicDef,
): boolean => {
  const topicTags = topic.tags.map((t) => t.toLowerCase());
  return post.data.tags.some((tag) => topicTags.includes(tag.toLowerCase()));
};

/** Posts belonging to a topic, sorted newest first. */
export const getTopicPosts = (
  topic: TopicDef,
  posts: CollectionEntry<"blog">[],
): CollectionEntry<"blog">[] =>
  posts
    .filter((post) => postMatchesTopic(post, topic))
    .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());

/** Look up a topic by its slug. */
export const getTopicBySlug = (slug: string): TopicDef | undefined =>
  TOPICS.find((topic) => topic.slug === slug);
