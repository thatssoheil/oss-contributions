# Scouting log

An honest record of contribution *effort* — issues investigated and why targets
were pursued or deprioritized — not just merged wins. Newest first.

The merged-PR dashboard in the [README](../README.md) is generated automatically
from the GitHub API; this log is the human narrative behind it.

---

## 2026-06-28 — Tier-1 marquee frontend repos: scouted, deprioritized

Scouted two marquee Tier-1 anchors for a clean, fix-shaped, unclaimed issue.
Both were ruled out for principled reasons rather than lack of effort, so I
recorded the analysis and pivoted to repos with demonstrated external-fix
throughput.

**TanStack/query** — reviewed the `help wanted` / `bug` backlog plus all
recently-active React-core + TypeScript issues. The actionable issues were
already covered by open PRs; the few that weren't are either active maintainer
design discussions (e.g. dependent-prefetch SSR support) or already on a core
maintainer's own list. No unclaimed, fix-shaped issue available right now — a
sign of a healthy, fast-moving contributor base. Will re-scout when the backlog
opens up.

**shadcn-ui/ui** — reviewed the open `[bug]` reports. Candidates were either
already addressed by an open PR, forward-compatibility items tied to a future
dependency major (the project currently pins the older major, so nothing is
broken today), or environment-specific edge cases. Given the repo's very large
open-PR backlog and long review latency for substantive external changes, I
deprioritized it for substantive PRs in favour of repos that merge external
fixes on a shorter timeline.

**Takeaway:** prioritise repos with proven external-contribution throughput and
responsive review over marquee prestige. Next targets:
react-hook-form (forms depth), mastra-ai/mastra (AI depth), TanStack/router.

**Effort still in flight this session:** PRs to `dip/cmdk` (#409) and
`radix-ui/primitives` (#3978) remain open; further Radix fixes (#3761, #3679)
are drafted and staggered to avoid flooding a single repo.
