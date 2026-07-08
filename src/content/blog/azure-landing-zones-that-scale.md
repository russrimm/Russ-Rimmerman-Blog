---
title: "Landing Zones That Scale: A Pragmatic Azure Foundation"
description: "How to design an Azure landing zone that balances governance, security, and developer velocity — without over-engineering on day one."
pubDate: 2026-06-24
tags: ["Azure", "Landing Zones", "Governance", "Architecture"]
featured: true
---

A great cloud foundation is invisible. Teams ship features, security sleeps at
night, and finance can actually read the bill. That's the promise of a
well-designed **Azure landing zone** — and the reality is very achievable if you
resist the urge to build everything at once.

## Start with the management group hierarchy

Before a single resource group exists, get your **management group** structure
right. I favor a lean hierarchy:

- **Platform** — connectivity, identity, and management subscriptions
- **Landing Zones** — one management group per workload archetype (corp, online)
- **Sandbox** — a safe place for experimentation with tight guardrails
- **Decommissioned** — where subscriptions go to be safely retired

```text
Tenant Root
└── Contoso
    ├── Platform
    │   ├── Connectivity
    │   ├── Identity
    │   └── Management
    ├── Landing Zones
    │   ├── Corp
    │   └── Online
    ├── Sandbox
    └── Decommissioned
```

## Policy as guardrails, not gates

Azure Policy is your best friend when it enforces the *right* things:

1. **Allowed locations** — keep data in-region for compliance.
2. **Required tags** — cost center, owner, environment.
3. **Deny public IPs** on workloads that should stay private.

The trick is to deploy these as **deny** and **audit** effects thoughtfully.
Too many denies on day one and you'll spend your first month writing exemptions.

## Don't over-engineer

You do **not** need every accelerator module before your first workload lands.
Ship the platform subscriptions, a couple of policies, and a repeatable
subscription vending process. Iterate from there.

> The best landing zone is the one your teams actually use.

More to come on connectivity patterns and the hub-and-spoke vs. Virtual WAN
decision — subscribe below so you don't miss it.
