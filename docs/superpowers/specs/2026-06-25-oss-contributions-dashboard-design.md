# OSS Contributions Dashboard — Design

- **Date:** 2026-06-25
- **Author:** Soheil Fakour (`thatssoheil`)
- **Status:** Approved (architecture + scope); pending spec review

## Goal

Give the open-source contribution campaign a cross-device home and a public
face. Today the campaign state lives only in local `.claude` memory on one
machine. This project moves it into Git so it's portable, and surfaces the
*accomplishments* publicly as a signal of genuine, high-quality OSS commitment.

The guiding constraint comes from the `oss-hunt` north star: Soheil wants to be
seen as a **high-quality recurring contributor, never a green-square farmer.**
Every design choice below protects that — the public dashboard counts *merged
PRs to repos he doesn't own*, not daily activity streaks.

## Non-goals

- No daily green-square / activity-streak counter (reads as farming).
- No generic profile stats (commit counts, language breakdowns) — off-the-shelf
  tools already do that and it isn't the signal we want.
- The private strategy repo is **not** a published artifact and never renders to
  any public surface.
- No test suite — verification is by running the render script against the live
  API and eyeballing the output.

## Architecture

Three surfaces. Two are auto-generated from one render script; one is plain
synced data.

```
PRIVATE  thatssoheil/oss-campaign        source of truth, synced across devices
  campaign.md            anchors, queued targets, networking notes, PRs in flight
  (no Action — just data; the oss-hunt skill reads/writes it)

PUBLIC   thatssoheil/oss-contributions   canonical dashboard (this repo)
  README.md              the dashboard, auto-generated between markers
  config.json            username + anchor repo list
  scripts/render.mjs     zero-dep Node ESM; queries GitHub Search API
  .github/workflows/update.yml   daily cron + manual dispatch
        │
        │ same Action, extra step using a fine-grained PAT
        ▼
PUBLIC   thatssoheil/thatssoheil         profile README
  README.md              compact summary between markers, links to canonical repo
```

### Why this shape

- The canonical dashboard only needs **public** GitHub data, so its Action
  self-updates its own README using the built-in `GITHUB_TOKEN` — **no secrets**
  for the canonical surface.
- The only secret in the whole system is one **fine-grained PAT** scoped to
  `Contents: Read/Write` on `thatssoheil/thatssoheil` only, used solely for the
  cross-repo profile write.
- The private strategy is an ordinary private Git repo — cross-device sync is
  just `git pull` / `git push`. It shares no infrastructure with the public
  surfaces, so it cannot leak through them.

### Rejected alternatives

- **Single public repo, strategy stays in local `.claude` memory** — simpler (one
  repo, no PAT) but loses the cross-device strategy sync, which is half the point.
- **Off-the-shelf profile tools (github-readme-stats / metrics)** — less code, but
  they show generic stats, not "merged PRs to external/anchor repos."

## Data model

### Private: `oss-campaign/campaign.md`

Hand- and skill-edited Markdown. Holds exactly what GitHub can't know:

- **Anchors** — strategy notes per anchor repo (depth vs. opportunistic).
- **Queued targets** — issues/repos being scouted, with status.
- **In flight** — PRs open right now and their state.
- **Networking notes** — maintainers, context, follow-ups.

This file is the successor to the old `oss-contribution-campaign.md` memory. The
`oss-hunt` skill's Phase 0 (recall) and Phase 7 (update live state) point here.

### Public: `oss-contributions/config.json`

```json
{
  "username": "thatssoheil",
  "recentLimit": 10,
  "anchors": [
    "opennextjs/opennextjs-cloudflare",
    "cloudflare/workers-sdk",
    "TanStack/router",
    "TanStack/query",
    "shadcn-ui/ui",
    "radix-ui/primitives",
    "vercel/next.js"
  ]
}
```

`anchors` drives only the "anchor coverage" checklist. The headline counts are
not limited to anchors (see Metrics).

## Metrics & scope

**Scope decision:** count merged PRs authored by `thatssoheil` in any repository
he does **not** own.

GitHub Search queries (issues search, `is:pr`):

| Metric | Query |
|---|---|
| Merged contributions (headline) | `author:thatssoheil is:pr is:merged -user:thatssoheil` |
| In flight (open PRs) | `author:thatssoheil is:pr is:open -user:thatssoheil` |

`-user:thatssoheil` excludes repositories owned by him, so only external work
counts. Derived from the merged result set:

- **Repos & orgs contributed to** — distinct `repository_url` values (count + a
  linked list).
- **Anchor coverage** — for each `config.anchors` entry, ✓ if a merged PR exists
  in that repo, otherwise ▢.
- **Recent merged PRs** — table of the most recent N (default 10): repo · title ·
  date · link. Date uses the PR's `closed_at` (merged PRs are closed at merge).

Dashboard sections, in order:

1. Headline line: `N merged contributions across M repositories`.
2. In flight: `K open PRs`.
3. Anchor coverage checklist.
4. Recent merged PRs table.
5. Footer: "Last updated <ISO date> · generated from the GitHub API".

## Render script — `scripts/render.mjs`

- Zero dependencies. Node 20+ ESM, uses global `fetch`. No `node_modules`.
- Reads `GH_TOKEN` from env for authenticated search (higher rate limit; the
  data itself is public).
- CLI: `node scripts/render.mjs --target <readme|profile> [--out <path>]`.
  - `--target readme` (default): rewrites this repo's `README.md` between
    `<!-- OSS:START -->` / `<!-- OSS:END -->`, full dashboard.
  - `--target profile --out profile/README.md`: writes the **compact** summary
    (headline + in-flight + link to canonical repo) between the same markers in
    the given file.
- Querying: `GET /search/issues?q=<query>&per_page=100`, paginated via the `Link`
  header until exhausted. Uses `total_count` for headline counts.
- **Marker safety:** only the content between markers is replaced; everything
  else in the file is preserved. If the markers are absent, the script appends a
  fresh marker block rather than overwriting the file.
- **Failure safety:** any non-2xx API response (after a short retry) makes the
  script exit non-zero **without writing**, so a transient API failure never
  commits an empty or partial dashboard.
- Deterministic output (stable sort: merged date desc, then repo) so unchanged
  data produces an identical file and yields no commit.

## GitHub Action — `.github/workflows/update.yml`

- **Triggers:** `schedule` daily at `06:00 UTC` (`0 6 * * *`) + `workflow_dispatch`
  for on-demand runs.
- **Permissions:** `contents: write` (for the self-push to this repo).
- **Secrets:** `PROFILE_TOKEN` — fine-grained PAT, `Contents: RW` on
  `thatssoheil/thatssoheil` only.
- **Steps:**
  1. `actions/checkout@v4`.
  2. `actions/setup-node@v4` (node 20).
  3. Render dashboard: `node scripts/render.mjs --target readme`
     (env `GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}`).
  4. Commit + push **only if** `git diff` is non-empty (no empty commits),
     author `github-actions[bot]`.
  5. Checkout profile repo to `profile/` using `PROFILE_TOKEN`.
  6. Render profile summary: `node scripts/render.mjs --target profile --out profile/README.md`.
  7. Commit + push the profile repo only if changed.

If steps 5–7 fail (e.g. PAT missing/expired), the canonical dashboard from steps
3–4 is already committed; the profile step is best-effort and its failure is
visible in the Action log without corrupting any README.

## oss-hunt skill integration (bounded follow-up)

After the repos exist and `oss-campaign` is cloned to a known path on this
machine, update the `oss-hunt` skill so its campaign paths resolve:

- Phase 0 (recall) reads `oss-campaign/campaign.md` instead of the non-existent
  `-home-soheil-playground` memory path.
- Phase 7 (after shipping) appends merged/queued state to the same file and
  commits it.

This is a small, separate edit to the skill — out of scope for the repos
themselves but tracked here so the cross-device strategy sync is actually used.

## Verification

- Run `node scripts/render.mjs --target readme` locally against the live API;
  confirm the generated README is well-formed and the counts match a manual
  `gh search prs` spot-check.
- Run the profile target against a scratch file; confirm the compact summary.
- Trigger the Action once via `workflow_dispatch` and confirm both pushes.
- No unit tests.

## Open questions

None blocking. Defaults chosen: recent-PR table length = 10; cron = 06:00 UTC.
Both are trivially adjustable in `config.json` / the workflow later.
