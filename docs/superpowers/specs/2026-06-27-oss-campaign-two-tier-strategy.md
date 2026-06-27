# OSS Campaign — Two-Tier Strategy

- **Date:** 2026-06-27
- **Author:** Soheil Fakour (`thatssoheil`)
- **Status:** Approved
- **Supersedes:** ad-hoc anchor list in `oss-campaign/campaign.md` (Cloudflare-first era)

## Goal

Pivot the OSS campaign from a Cloudflare-edge-first anchor set to a **two-tier
play** that maximizes career signal while building green-square momentum:

- **Tier 1** — fast-merging daily-tools repos for early wins and recognizable
  logos (TanStack, shadcn, Radix).
- **Tier 2** — go deep on one AI framework (Mastra) plus react-hook-form (forms
  specialty), where same-day maintainers and healthy backlogs make "recognized
  regular contributor" realistic.

The north star is unchanged from `oss-hunt`: **high-quality recurring
contributor**, never volume or AI-slop. Depth beats breadth on the résumé line.

## Integration with existing infrastructure

Three repos, three roles — unchanged architecture from the dashboard design
(2026-06-25):

```
PRIVATE   thatssoheil/oss-campaign          strategy + live state (this spec's home)
PUBLIC    thatssoheil/oss-contributions    auto-generated dashboard (anchor checklist)
PUBLIC    thatssoheil/thatssoheil          compact profile summary (OSS markers)
```

| Surface | What it holds | Who writes it |
| --- | --- | --- |
| `oss-campaign/campaign.md` | Tiers, in-flight PRs, queued targets, networking notes, process rules | Hand + `oss-hunt` skill (Phase 0 recall, Phase 7 update) |
| `oss-contributions/config.json` | `anchors` list driving the public checklist | Human, when tier membership changes |
| `oss-contributions/README.md` | Merged counts, anchor ✓/▢, recent PRs table | Daily Action via `scripts/render.mjs` |
| `oss-hunt` skill | Scout → report → brainstorm → implement → human gate | Agent workflow |

**Local clone paths (this machine):**

- Campaign: `/home/thatssoheil/projects/oss/oss-campaign`
- Dashboard: `/home/thatssoheil/projects/oss/oss-contributions`
- Upstream worktrees: `/home/thatssoheil/projects/oss/<owner-repo>`

## Tier 1 — Quick wins + frontend signal

Repos with **confirmed external-merge audits** and low review latency. Use for
momentum and stack-aligned signal.

| Repo | Stars | Why | Acceptance evidence | Caveat |
| --- | --- | --- | --- | --- |
| [TanStack/query](https://github.com/TanStack/query) | ~49.8k | Server-state / data-fetching — exact domain | CONTRIBUTING.md; ~64% community contributions; ~13h median review; daily releases; named external merges (e.g. sukvvon) | **Best first quick-win target** |
| [shadcn-ui/ui](https://github.com/shadcn-ui/ui) | ~117k | Climic stack (shadcn/Radix/Tailwind); highest profile prestige | 1,284+ merged PRs; external merges within last week | Many recent merges are registry metadata — target substantive component/bug PRs, not registry-only |
| [TanStack/router](https://github.com/TanStack/router) | ~14.7k | Type-safe routing; transferable from React Router 7 | Active releases; external merges in June (elecmonkey, nkar123412-hub, XananasX7) | Multi-framework; release count inflated by monorepo tags |
| [radix-ui/primitives](https://github.com/radix-ui/primitives) | ~19k | Accessible primitives under shadcn; durable a11y signal | CONTRIBUTING.md; external PRs merged Jun 8–15 | **GFI / Help Wanted labels exist but have zero open issues** — pick from the broader backlog |
| [colinhacks/zod](https://github.com/colinhacks/zod) | ~43k | TS depth; used in every Climic form schema | v4.4.3; external merges (dokson #5945/#5926/#5925 + ~7 others) | "Prestige" value judgment split 2-1 in research — facts solid, career signal subjective |

**Tier 1 concurrency rule:** keep **1–2 PRs in flight** across Tier 1 repos.
Finish or land Radix/cmdk work already open before opening new Tier 1 targets.

## Tier 2 — Go deep

Repos where depth > breadth for the résumé story. Target **recognized regular
contributor** status, not one-off wins.

| Repo | Stars | Role | Acceptance evidence | Process rule |
| --- | --- | --- | --- | --- |
| [mastra-ai/mastra](https://github.com/mastra-ai/mastra) | ~25.4k | **Primary AI depth anchor** — MCP, RAG, agents, workflows, evals, observability | CONTRIBUTING.md welcomes all skill levels; 38 PRs merged Jun 23 from 22 authors; ~210 open PRs / ~215 open issues | **Issue-first** — PRs without linked issues may be closed. Always `Fixes #NNNN` |
| [react-hook-form/react-hook-form](https://github.com/react-hook-form/react-hook-form) | ~44.8k | **Forms depth anchor** — literal specialty in CLAUDE.md | 95–97 PRs merged in 90 days from ~24 non-maintainer authors; v7.80.0 weekly cadence | Tightest narrative fit: "I contribute to the forms library I use in production" |

**Tier 2 concurrency rule:** **one depth PR at a time per anchor** until the
first merge lands. Mastra and RHF can run in parallel (different domains).

## Watch list (not yet anchor-tier)

Acceptance inferred, not audited. Scout only after Tier 1/2 targets stall or for
a stack-specific bug with clear repro.

| Repo | Why surfaced | Caveat |
| --- | --- | --- |
| [CopilotKit/CopilotKit](https://github.com/CopilotKit/CopilotKit) | Agent-native React/Next + generative UI | Community-PR acceptance inferred from backlog; multi-framework |
| [vercel/ai](https://github.com/vercel/ai) | Canonical TS AI toolkit | Inferred acceptance; React surface most mature; release count inflated |
| [modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers) | Direct MCP interest | Not deeply verified in initial research pass |
| [modelcontextprotocol/typescript-sdk](https://github.com/modelcontextprotocol/typescript-sdk) | MCP TS SDK | Not deeply verified |
| [voltagent/voltagent](https://github.com/voltagent/voltagent) | Agent tooling | Not deeply verified |
| [assistant-ui/assistant-ui](https://github.com/assistant-ui/assistant-ui) | Chat UI for agents | Not deeply verified |

## Retired / deprioritized anchors

Removed from `config.json` anchors (still count if merged — dashboard queries all
external PRs, not just anchors):

- `cloudflare/workers-sdk` — valid target but not in verified shortlist; revisit
  opportunistically.
- `vercel/next.js` — crowded; lower signal-per-effort than Tier 1 picks.

**Kept as historical:** `opennextjs/opennextjs-cloudflare` — already merged
(#1289); remains on the checklist as ✅ proof of edge-stack depth.

## How to structure contributions for max signal

1. **Follow each repo's CONTRIBUTING + issue-first norms.** Mastra closes
   unlinked PRs.
2. **Pick repos by confirmed merged external PRs**, not star count.
3. **Scope early PRs to well-defined open issues** — never filter Radix by empty
   GFI/Help Wanted labels.
4. **Favor fast-cadence repos** (TanStack daily, Mastra same-day) for momentum.
5. **Substantive over lightweight** — especially shadcn (skip registry-only PRs
   unless explicitly chasing a first win).
6. **Depth > breadth** — one repo where maintainers know your handle beats 20
   one-off PRs.

## Anchor checklist (`config.json`)

Drives only the public ✓/▢ list. Updated 2026-06-27:

```json
{
  "anchors": [
    "opennextjs/opennextjs-cloudflare",
    "TanStack/query",
    "shadcn-ui/ui",
    "TanStack/router",
    "radix-ui/primitives",
    "mastra-ai/mastra",
    "react-hook-form/react-hook-form"
  ]
}
```

## Scout defaults (`oss-hunt/scripts/scout.sh`)

When called with no args, scout **Tier 1 quick-win repos** first:

- `TanStack/query`
- `shadcn-ui/ui`
- `TanStack/router`

Override per hunt: `scout.sh mastra-ai/mastra react-hook-form/react-hook-form`

## Live-state drift

All counts in this spec are a **2026-06-27 snapshot**. Re-validate before
investing time:

- Open-issue / open-PR counts move hourly on active repos.
- Radix GFI labels may gain issues later — still verify, don't assume.
- shadcn registry-merge ratio may shift — prefer substantive targets.

**Follow-up research gaps** (tracked in plan, not blocking):

1. Live GitHub audit of top 3–4 picks (`gh` counts, external-merge spot-check).
2. Second pass on MCP / RAG / eval repos (modelcontextprotocol/*, voltagent,
   assistant-ui).

## Verification

- `campaign.md` reflects tiers + current in-flight state.
- `config.json` anchors match this spec.
- `oss-hunt` Phase 0 reads `oss-campaign/campaign.md`; Phase 7 commits there.
- Dashboard regenerates correctly after anchor change (`node scripts/render.mjs`).