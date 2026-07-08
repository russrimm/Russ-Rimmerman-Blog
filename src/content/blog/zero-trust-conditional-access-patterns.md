---
title: "Zero Trust in Practice: Conditional Access Patterns That Work"
description: "Moving beyond the buzzword — concrete Microsoft Entra Conditional Access policies that raise your security baseline without frustrating users."
pubDate: 2026-04-02
tags: ["Security", "Zero Trust", "Entra ID", "Identity"]
---

"Zero Trust" gets thrown around a lot. Underneath the marketing is a simple,
powerful idea: **never trust, always verify**. In Microsoft Entra, the engine
that makes this real is **Conditional Access**. Here are the policies I deploy
first.

## The baseline set

- **Require MFA for all users** — the single highest-impact control you can
  enable.
- **Block legacy authentication** — protocols like POP and IMAP can't do MFA.
- **Require compliant or hybrid-joined devices** for access to sensitive apps.
- **Require MFA for risky sign-ins** using Identity Protection signals.

## Break-glass before you break things

Always create **two** cloud-only emergency access accounts, exclude them from
all Conditional Access policies, and monitor them closely. The day a
misconfigured policy locks everyone out, you'll be grateful.

```text
Emergency accounts:
  - Excluded from every CA policy
  - Long, unique passwords in a vault
  - Sign-in alerts wired to the SOC
```

## Roll out with report-only

Never flip a new policy straight to **On**. Use **report-only** mode first,
review the sign-in logs, and confirm you're not about to block a business-
critical workflow. Then enable.

## Measure and iterate

Zero Trust is a journey, not a project. Review your Conditional Access posture
quarterly, retire redundant policies, and keep the user experience in mind —
security that people route around isn't security at all.
