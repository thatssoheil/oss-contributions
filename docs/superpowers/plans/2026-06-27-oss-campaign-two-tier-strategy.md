# OSS Campaign — Two-Tier Strategy Plan

> **For agentic workers:** Use `oss-hunt` for individual issue hunts. This plan
> governs campaign-level strategy and repo integration. Spec:
> `docs/superpowers/specs/2026-06-27-oss-campaign-two-tier-strategy.md`.

**Goal:** Execute a two-tier OSS contribution campaign — Tier 1 quick wins for
momentum and frontend signal, Tier 2 depth on Mastra (AI) and react-hook-form
(forms) — integrated with the existing `oss-campaign` / `oss-contributions`
infrastructure.

**Architecture:** Private `oss-campaign/campaign.md` holds strategy and live
state; public `oss-contributions` auto-reports merged PRs and anchor coverage;
`oss-hunt` skill reads/writes campaign state through the contribution lifecycle.

**Tech Stack:** `gh` CLI, `oss-hunt/scripts/scout.sh`, `oss-contributions/scripts/render.mjs`.

## Global constraints

- **North star:** high-quality recurring contributor — every PR defensible in
  maintainer review (`oss-hunt` guardrails).
- **Concurrency:** 2–3 PRs in flight max across *different* anchors during a
  heavy push; don't flood one repo (Radix staggering rule stays).
- **Issue-first:** Mastra requires linked issues (`Fixes #NNNN`).
- **No registry-only shadcn PRs** unless explicitly chasing a first win — prefer
  substantive component/bug fixes.
- **Human gate** before any external push or PR (`oss-hunt` Phase 6).

---

## Phase 0 — Campaign sync (done 2026-06-27)

- [x] Research shortlist verified (adversarial pass noted Radix GFI empty, shadcn
  registry caveat, AI SDK/CopilotKit inferred acceptance).
- [x] Spec written: `2026-06-27-oss-campaign-two-tier-strategy.md`
- [x] `campaign.md` updated with tiers + preserved in-flight state
- [x] `config.json` anchors updated
- [x] `oss-hunt` skill pointed at synced campaign path

---

## Phase 1 — Finish in-flight work (current sprint)

**Priority:** land open PRs before opening new Tier 1 scouts. Radix depth is
already building signal — don't abandon mid-stream.

| Repo | PR / target | Status | Next action |
| --- | --- | --- | --- |
| radix-ui/primitives | #3978 (scroll position on Select ScrollUp/Down) | Open, CI running | Monitor CI; respond to review |
| dip/cmdk | #409 (scroll selected item by value) | Open | Monitor review |
| radix-ui/primitives | #3761 (submenu SubTrigger active state) | Drafting next | Complete after #3978 lands; stagger |
| radix-ui/primitives | #3679 (Select inside label, mobile) | Queued | After #3761 |

- [ ] **Task 1.1:** Check CI + review status on radix #3978 and cmdk #409
  ```bash
  gh pr view 3978 -R radix-ui/primitives --json state,statusCheckRollup,reviews
  gh pr view 409 -R dip/cmdk --json state,statusCheckRollup,reviews
  ```
- [ ] **Task 1.2:** On merge, update `oss-campaign/campaign.md` Merged section +
  commit; dashboard auto-updates on next cron.

**Exit criteria:** At least one of #3978 or #409 merged; Radix checklist flips
to ✅ on dashboard.

---

## Phase 2 — Tier 1 first win (TanStack/query)

**Why first:** strongest external-merge evidence, ~13h median review, daily
releases, exact server-state domain fit.

- [ ] **Task 2.1:** Live-validate TanStack/query before scouting
  ```bash
  gh issue list -R TanStack/query --state open --limit 5
  gh search prs --repo TanStack/query --merged --author-app-type Human --limit 10
  gh release list -R TanStack/query --limit 3
  ```
- [ ] **Task 2.2:** Scout unassigned candidates
  ```bash
  ~/.claude/skills/oss-hunt/scripts/scout.sh TanStack/query
  # or: projects/skills/skills/personal/oss-hunt/scripts/scout.sh TanStack/query
  ```
- [ ] **Task 2.3:** Run full `oss-hunt` flow (report → pick → brainstorm →
  implement → human gate) on top candidate.
- [ ] **Task 2.4:** Update `campaign.md` In flight + commit.

**Exit criteria:** One merged PR in TanStack/query; anchor ✅ on dashboard.

---

## Phase 3 — Tier 1 breadth (shadcn or TanStack/router)

Pick based on scout quality after Phase 2 — don't parallel both.

| Repo | Scout when | Target PR type |
| --- | --- | --- |
| shadcn-ui/ui | After query merge or if query backlog is thin | Component bug fix or a11y — **not** registry metadata |
| TanStack/router | If routing-specific bug matches React Router 7 experience | Type-safety or loader bug with clear repro |

- [ ] **Task 3.1:** Scout chosen repo via `scout.sh`
- [ ] **Task 3.2:** `oss-hunt` full cycle
- [ ] **Task 3.3:** Update campaign state

**Exit criteria:** 3+ Tier 1 anchors with ✅ (opennextjs + query + one more).

---

## Phase 4 — Tier 2 depth (Mastra + react-hook-form)

Start after at least one Tier 1 merge beyond Radix/cmdk, or when in-flight
count drops below 2.

### 4a — Mastra (AI depth anchor)

- [ ] **Task 4a.1:** Read CONTRIBUTING.md; confirm issue-first rule
  ```bash
  gh api repos/mastra-ai/mastra/contents/CONTRIBUTING.md --jq .download_url | xargs curl -sL | head -80
  ```
- [ ] **Task 4a.2:** Scout + claim issue (comment "I'd like to work on this")
  ```bash
  scout.sh mastra-ai/mastra
  ```
- [ ] **Task 4a.3:** Implement with `Fixes #NNNN`; human gate; ship
- [ ] **Task 4a.4:** Repeat until maintainers recognize handle (goal: 3+ merged
  PRs over several weeks, not days)

### 4b — react-hook-form (forms depth anchor)

- [ ] **Task 4b.1:** Scout for fix-shaped bugs in areas Soheil uses in Climic
  (zodResolver integration, field arrays, controlled/uncontrolled edge cases)
  ```bash
  scout.sh react-hook-form/react-hook-form
  ```
- [ ] **Task 4b.2:** `oss-hunt` full cycle
- [ ] **Task 4b.3:** Build narrative: production user → contributor

**Exit criteria:** ✅ on both Mastra and RHF anchors; credible depth story for
each.

---

## Phase 5 — Watch list / MCP follow-up (optional)

Only after Tier 2 has first merges, or if a high-fit issue appears organically.

- [ ] **Task 5.1:** Second research pass — verify MCP/RAG/eval repos:
  - `modelcontextprotocol/servers`
  - `modelcontextprotocol/typescript-sdk`
  - `voltagent/voltagent`
  - `assistant-ui/assistant-ui`
- [ ] **Task 5.2:** Live-audit CopilotKit + vercel/ai external-merge rate
- [ ] **Task 5.3:** Promote any watch-list repo to anchor tier in spec +
  `config.json` if acceptance audit passes

---

## Operational checklist (every contribution)

1. **Phase 0:** `git -C ~/projects/oss/oss-campaign pull` → read `campaign.md`
2. **Scout:** confirm issue unassigned, no linked PR, not already in flight
3. **Implement:** clone to `~/projects/oss/<repo>`; regression test; verify locally
4. **Human gate:** show diff + verification; wait for explicit go
5. **Phase 7:** update `campaign.md` → `git commit` → `git push` in oss-campaign
6. **Dashboard:** auto-updates via daily Action (or manual `render.mjs` run)

## Success metrics

| Metric | Target (90 days) | Where tracked |
| --- | --- | --- |
| Merged external PRs | 8–12 substantive | `oss-contributions` README |
| Anchor coverage | 5+ ✅ | `oss-contributions` checklist |
| Depth anchors with 2+ merges | Mastra + RHF | `campaign.md` Merged section |
| In-flight concurrency | ≤ 3 across repos | `campaign.md` In flight |
| Median time-to-merge (Tier 1) | < 1 week | Networking notes / manual |

## Self-review

- Integrates with `oss-campaign` (private live state) ✅
- Integrates with `oss-contributions` (public dashboard + config anchors) ✅
- Preserves in-flight Radix/cmdk work ✅
- Documents adversarial caveats from research ✅
- Follow-up gaps (live audit, MCP pass) tracked in Phase 5 ✅