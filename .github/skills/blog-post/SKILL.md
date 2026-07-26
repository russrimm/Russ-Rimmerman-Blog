---
name: blog-post
description: "Use this skill when writing blog posts, articles, or long-form web content—from quick how-to guides to in-depth opinion pieces. Trigger phrases: 'write a blog post about', 'draft an article on', 'create a post for my blog'. Do NOT use for academic papers, news reporting, or content requiring real-time facts."
version: 1.0.0
author: community
tags: [writing, blogging, content-marketing, seo]
license: MIT
---

# Blog Post

## Overview
This skill helps you write compelling, well-structured blog posts that engage readers from the opening hook to the final call to action. It covers SEO fundamentals, headline formulas, tone matching to your brand voice, and the right word count for your goal—whether you're publishing a punchy 800-word opinion piece or a comprehensive 2,000-word tutorial. The output is publication-ready content, not a rough draft.

## When to Use
- Writing how-to tutorials and step-by-step guides
- Drafting opinion or thought-leadership articles
- Creating listicles and roundup posts
- Producing SEO-targeted content around a keyword
- Repurposing research or notes into readable web content
- Writing content marketing pieces that drive traffic

## When NOT to Use
- Academic or peer-reviewed papers (use `academic-essay` skill instead)
- News articles requiring verified, real-time information
- Press releases (distinct format and distribution requirements)
- Social media posts (use `social-media` skill instead)
- Technical documentation (use `technical-writer` skill instead)

## Quick Reference
| Task | Approach |
|------|----------|
| Hook | Start with a stat, question, or bold claim in the first 2 sentences |
| Headline | Use formulas: "How to X", "N Ways to Y", "Why Z" |
| Word count | Tutorial: 1,200–2,000 words; Opinion: 800–1,200 words; Listicle: 1,000–1,500 words |
| SEO | Include primary keyword in title, first paragraph, one H2, and meta description |
| Paragraphs | Keep to 3–4 sentences max for web readability |
| CTA | One clear call-to-action at the end; optionally one mid-post |
| Subheadings | Every 200–300 words to break up the wall of text |

## Instructions

1. **Identify the post type and goal.** Determine whether this is a tutorial, opinion, listicle, or case study. Clarify the target audience (beginner vs. expert), the primary keyword if SEO matters, and the desired word count range.

2. **Craft the headline first.** Use a proven formula:
   - How-to: "How to [Achieve Result] in [Timeframe/Steps]"
   - Listicle: "[Number] [Adjective] Ways to [Achieve Goal]"
   - Opinion: "Why [Counterintuitive Claim] Is Actually [Positive Outcome]"
   - Question: "Is [Common Belief] Really [Worth It/True]?"

3. **Write the hook (first 100 words).** Open with one of these techniques:
   - Surprising statistic: "73% of blog posts get zero backlinks—here's what the other 27% do differently."
   - Relatable problem: "You've spent three hours staring at a blank document. The post is due tomorrow."
   - Bold claim: "Most productivity advice is making you less productive."

4. **Build the body structure.** Use this skeleton:
   - **Intro (10%):** Hook + problem statement + promise of what reader will learn
   - **Body (80%):** 3–7 sections with H2/H3 subheadings, each covering one point
   - **Conclusion (10%):** Summary of key takeaways + CTA

5. **Apply SEO basics.**
   - Place the primary keyword in the title, within the first 100 words, in at least one H2, and in the meta description (150–160 chars)
   - Use related/semantic keywords naturally in body copy
   - Write a meta description that includes the keyword and a benefit

6. **Match the tone to the audience.** Ask: Is this brand casual or professional? Technical or accessible? Use second-person ("you") to speak directly to the reader.

7. **Write the CTA.** End with one clear next step: subscribe, download, read another post, comment. Make it specific—"Download the free checklist" outperforms "Click here."

8. **Edit for web readability.** Short sentences. Active voice. Bullet lists for steps. Bold key terms. Cut every word that doesn't earn its place.

9. **Generate the hero image prompt.** When producing a hero image prompt for the post, follow the Hero Image Prompt Rules section below. The prompt must be tailored to the specific post — never reused verbatim — and must vary the subject's pose, expression, and setting between posts so hero images don't look interchangeable.

10. **Run the Humanizer pass (required).** Before the post is done, run the `humanizer` skill (`.github/skills/humanizer/SKILL.md`) over the full draft. Strip AI-tell openers, empty transitions, marketing hype, and formulaic closes, and rewrite anything that sounds robotic into a warm, specific, human voice. A generated post is not finished until it passes the Humanizer definition of done.

## Hero Image Prompt Rules

Every hero image prompt generated for a post must follow these rules. They exist so the blog's hero images feel distinct, on-topic, and visually credible — not like the same stock template with the title swapped out.

### Markerboard (content side of the image)
- The scene must include a **realistic markerboard** (whiteboard or glass board) whose drawing is tightly tied to this specific post's topic. Generic squiggles, gears, or "AI brain" clip art are not acceptable.
- If the post mentions specific **brands, products, or services** (e.g., Microsoft Copilot Studio, Power Platform, Azure, Dataverse, GitHub, Copilot, VS Code, Teams, SharePoint, Dynamics 365, etc.), include the applicable **official-looking logos** on the markerboard. Place them next to the components they represent.
- Add **hand-drawn text labels** on the markerboard identifying key components discussed in the post — e.g., topic names, action names, table names, service names, arrows between them. The labels should look like they were written by a person with a dry-erase marker: slightly uneven letters, mixed case, occasional underline or box.
- Include marker-style connectors (arrows, boxes, brackets) that show the relationships between the labeled components, not just a collage of logos.
- The overall board should look like something a practitioner would actually sketch while explaining the post's concept out loud — not a polished infographic.

### The person in the image
- Vary the **pose, framing, and expression** from post to post. Do not default to the same "person standing centered, facing camera, smiling" composition every time. Rotate through options such as:
  - Standing to one side of the board, gesturing at a labeled component.
  - Mid-sketch with a marker in hand, writing or drawing on the board.
  - Looking at the board (three-quarter or side profile) rather than at the camera.
  - Seated at a nearby desk with the board behind, laptop or notebook visible.
  - Leaning against a desk or counter with arms crossed, board visible over the shoulder.
  - Walking past the board or stepping toward it, caught in motion.
- Vary the **expression**: thoughtful, mid-explanation, laughing lightly, focused, mid-sentence — not always the same closed-mouth smile.
- Vary the **camera angle and distance**: sometimes waist-up, sometimes wider environmental shots showing more of the room, sometimes closer with the board slightly out of focus behind.
- Keep the **identity consistent** across posts (same person), but change enough of the surrounding variables that two hero images placed side by side clearly look like different moments.

### Wardrobe
- Dress the subject in **dressy casual / business casual** attire. Think: khaki or chino pants paired with a short-sleeved collared polo shirt. A tucked or half-tucked button-down with the sleeves rolled is also acceptable when variety is needed.
- No suits, no ties, no hoodies, no graphic tees, no branded merch.
- Vary the **polo/shirt color** between posts (navy, forest green, charcoal, burgundy, light blue, etc.) so the wardrobe isn't identical every time. Keep the palette muted and professional.

### Setting
- A modern, well-lit workspace: a small office, a corner of an open workspace, or a home office. Natural window light preferred over harsh overheads.
- Vary secondary set dressing between posts (plants, a coffee cup, a laptop, a notebook, a monitor showing a muted screen) — but keep it uncluttered. The markerboard is the visual anchor.

### Style and quality
- Photorealistic, editorial tech-blog quality. Sharp focus on the subject and readable markerboard content. Shallow depth of field is fine, but the labeled components on the board must remain legible.
- No text artifacts on walls or shirts. No fake corporate logos on the subject's clothing. Logos appear only on the markerboard where they belong.

### Prompt shape
When emitting the hero image prompt, structure it (in prose, not bullets) so it covers, in order:
1. Scene and camera framing (including the specific pose/angle choice for this post).
2. Subject description, expression, and wardrobe (with the specific polo/shirt color chosen for this post).
3. Markerboard contents: which logos appear, which components are labeled by hand, and how they connect — named explicitly from this post's content.
4. Setting and lighting.
5. Style descriptors (photorealistic, editorial, natural light, shallow depth of field, legible board text).

## Examples

### Example 1: Tech Tutorial Post

**Input:** "Write a blog post on how to set up a Python virtual environment for beginners. Primary keyword: 'Python virtual environment'. Target: developers new to Python."

**Output:**

---

**Headline:** How to Set Up a Python Virtual Environment (The Right Way)

**Meta description:** Learn how to set up a Python virtual environment in under 5 minutes. Keep your projects isolated, dependencies clean, and your future self happy.

**Hook:**
Every Python developer eventually hits this wall: you install a package for one project and break another. The fix is a Python virtual environment, and setting one up takes less than five minutes. This guide walks you through it step by step—no prior experience needed.

**[H2] What Is a Python Virtual Environment?**
A virtual environment is an isolated folder that contains its own Python interpreter and packages. Instead of installing libraries globally on your machine (where they can conflict), each project gets its own clean slate.

Think of it like separate toolboxes for each job. The wrench in one box doesn't interfere with the wrench in another.

**[H2] Prerequisites**
- Python 3.6 or higher installed (`python --version` to check)
- Terminal or Command Prompt access
- That's it

**[H2] Step 1: Create the Virtual Environment**

Navigate to your project folder and run:

```bash
python -m venv venv
```

This creates a folder called `venv` inside your project. You can name it anything, but `venv` is the convention.

**[H2] Step 2: Activate It**

On macOS/Linux:
```bash
source venv/bin/activate
```

On Windows:
```bash
venv\Scripts\activate
```

Your terminal prompt will change to show `(venv)`, confirming it's active.

**[H2] Step 3: Install Packages**

Now install packages as normal—they'll only exist inside this environment:

```bash
pip install requests
```

**[H2] Step 4: Freeze Your Dependencies**

Before sharing your project, save the dependency list:

```bash
pip freeze > requirements.txt
```

Anyone can recreate your environment with `pip install -r requirements.txt`.

**[H2] Common Mistakes to Avoid**
- **Committing the venv folder to Git.** Add `venv/` to your `.gitignore`.
- **Forgetting to activate.** If packages seem missing, check that `(venv)` is in your prompt.

**Conclusion:**
Virtual environments are one of those habits that feel like extra work until the day they save you hours of debugging. Create one for every project, activate it before you code, and you'll never deal with dependency conflicts again.

**CTA:** Ready to go deeper? Read our guide on managing dependencies with `pip` and `requirements.txt`.

---

### Example 2: Opinion Piece

**Input:** "Write an 800-word opinion post arguing that remote work is better for creativity than office work. Conversational tone, no specific keyword."

**Output:**

---

**Headline:** Why Your Best Ideas Never Happen at the Office

**Hook:**
The brainstorming session is over. You've filled three whiteboards, consumed two pots of coffee, and generated seventeen ideas—all of which were mediocre. Then, an hour after you got home, you're in the shower and it hits you: the actually good idea. Sound familiar?

There's a reason for that, and it has everything to do with where we do our best thinking.

**[H2] The Myth of Collaborative Creativity**
We've been sold the idea that creativity is a group sport. Open offices, standing desks, and scheduled "ideation sessions" are supposed to spark innovation through proximity and spontaneous conversation. The data tells a different story.

A 2022 study in Nature found that virtual meetings are better for generating creative ideas than in-person ones—remote workers produced 18% more creative output. The reason? Distance creates cognitive space. When you're not monitoring social dynamics, managing interruptions, or performing productivity for your boss, your default mode network—the brain region linked to imagination—has room to work.

**[H2] Interruptions Are Creativity Killers**
It takes an average of 23 minutes to regain deep focus after an interruption, according to research from UC Irvine. The open office is an interruption machine. Remote work lets you design your own environment: noise levels, lighting, work hours—all tuned to when you actually think best.

For some people that's 6 a.m. with coffee. For others it's 10 p.m. with the TV on. Neither of these times is 2 p.m. in a fluorescent-lit conference room.

**[H2] The Shower Effect Is Real**
Insights don't arrive on command. They arrive when the mind is relaxed and the task is temporarily set aside—what researchers call "incubation." Remote workers naturally build more incubation time into their day: the walk to the kitchen, a lunch away from the desk, an afternoon without back-to-back meetings.

The office optimizes for visibility. Remote work optimizes for output.

**[H2] The Collaboration Counterargument**
To be fair: execution benefits from proximity. When a creative idea needs rapid iteration—when two people need to whiteboard fast and build on each other's energy—an in-person sprint is hard to beat. Hybrid models exist for this reason.

But the *generation* of the idea? That happens alone, usually in a moment of quiet.

**Conclusion:**
If your organization wants more creative thinking, the answer isn't bigger offices or more brainstorming meetings. It's more autonomy, fewer interruptions, and trust that your people are thinking—even when you can't see them doing it.

The next great idea is probably happening right now in someone's shower. Let's stop scheduling it out of existence.

---

## Best Practices
- Write the headline and hook before the body—they set the tone and structure
- Use subheadings every 200–300 words; readers scan before they read
- Keep paragraphs to 3 sentences max for mobile readability
- Use active voice: "We improved results" not "Results were improved"
- End every section with a transition or micro-summary
- Read the post aloud before publishing—awkward sentences become obvious

## Common Mistakes
- **Burying the lede:** Readers shouldn't have to get to paragraph four to understand what the post is about
- **Generic headlines:** "A Guide to Email" loses every time to "7 Cold Email Templates That Get Replies"
- **No CTA:** Every post should tell readers what to do next
- **Keyword stuffing:** If your primary keyword appears more than once per 100 words, it's too many
- **Too long an intro:** The hook should take 2–3 sentences, not two paragraphs of throat-clearing
- **Passive voice overuse:** It weakens authority and bores readers

## Tips & Tricks
- Use the "inverted pyramid" for tutorials: most important info first, detail later
- Write a working title first, then refine it after the post is done when you know what you actually wrote
- Add a TL;DR summary near the top for long posts (1,500+ words)—readers appreciate it
- Use numbered lists for sequential steps, bullet lists for non-sequential items
- Compress intros: delete your first paragraph and see if the post still makes sense—often it does
- For SEO posts, check competitors' H2s to identify subtopics you should cover

## Related Skills
- [proofreader](../../writing/proofreader/SKILL.md)
- [copywriter](../../writing/copywriter/SKILL.md)
- [social-media](../../writing/social-media/SKILL.md)
- [academic-essay](../../writing/academic-essay/SKILL.md)
