# OSS Contributions Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a cross-device OSS-campaign system: a private synced strategy repo plus a public dashboard (this repo) auto-generated daily from the GitHub API, with a compact summary mirrored into the profile README.

**Architecture:** A zero-dependency Node ESM script (`render.mjs`) queries the GitHub Search API for merged/open PRs in repos Soheil doesn't own, then rewrites a marked block in a target Markdown file. A daily GitHub Action runs it twice — once to self-update this repo's README, once to update the profile repo's README via a fine-grained PAT. A separate private repo holds hand-edited strategy and syncs by plain git.

**Tech Stack:** Node 20 (global `fetch`, no deps), GitHub Actions, GitHub Search API, `gh` CLI.

## Global Constraints

- **Scope of "contributions":** merged PRs by `thatssoheil` in repos he does **not** own — search query `author:thatssoheil is:pr is:merged -user:thatssoheil`. Open = same with `is:open`.
- **No green-square / activity-streak metric** — counts merged external PRs only.
- **Zero runtime dependencies** in `render.mjs` — Node 20 globals only, no `node_modules`, no `package.json` needed.
- **Marker safety:** the render script only ever replaces content between `<!-- OSS:START -->` and `<!-- OSS:END -->`; everything else in a file is preserved.
- **Failure safety:** a non-2xx GitHub API response (after retries) exits non-zero **without writing** any file.
- **No test suite.** Verify by executing the script against the live API and spot-checking with `gh search prs`.
- **Local build only until the human gate (Task 5).** No GitHub repo creation, no pushing, no PAT use happens until Soheil explicitly approves.
- **Commit identity:** `Soheil Fakour <51275156+thatssoheil@users.noreply.github.com>`. End commit messages with `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Repo working dirs: public `~/Repositories/oss-contributions` (already git-init'd, holds this plan), private `~/Repositories/oss-campaign` (created in Task 4).

---

## File Structure

**oss-contributions (public):**
- `config.json` — username, recentLimit, anchors list.
- `README.md` — repo readme; dashboard lives between markers.
- `scripts/render.mjs` — the renderer (only real logic in the system).
- `.github/workflows/update.yml` — daily Action.
- `.gitignore` — ignores the `profile/` checkout the Action creates.

**oss-campaign (private):**
- `campaign.md` — strategy / queue / in-flight, hand- and skill-edited.
- `README.md` — one line explaining the repo is private campaign state.

---

### Task 1: Scaffold the public repo (config + README + gitignore)

**Files:**
- Create: `~/Repositories/oss-contributions/config.json`
- Create: `~/Repositories/oss-contributions/README.md`
- Create: `~/Repositories/oss-contributions/.gitignore`

**Interfaces:**
- Produces: `config.json` with shape `{ username: string, recentLimit: number, anchors: string[] }`, consumed by `render.mjs` in Task 2. `README.md` contains the `<!-- OSS:START -->` / `<!-- OSS:END -->` marker pair that `render.mjs` writes between.

- [ ] **Step 1: Create `config.json`**

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

- [ ] **Step 2: Create `README.md`** (the marker block starts empty; the Action fills it)

```markdown
# OSS Contributions

A live dashboard of my open-source contributions — merged pull requests to
projects I don't own — regenerated daily from the GitHub API.

<!-- OSS:START -->
_Dashboard pending first generation._
<!-- OSS:END -->

---

Built and maintained from [oss-contributions](https://github.com/thatssoheil/oss-contributions).
Design notes live in `docs/superpowers/`.
```

- [ ] **Step 3: Create `.gitignore`**

```gitignore
# Working checkout the GitHub Action makes of the profile repo
profile/
node_modules/
```

- [ ] **Step 4: Verify config parses**

Run: `node -e "console.log(JSON.parse(require('fs').readFileSync('config.json','utf8')).username)"` from `~/Repositories/oss-contributions`
Expected: prints `thatssoheil`

- [ ] **Step 5: Commit**

```bash
cd ~/Repositories/oss-contributions
git add config.json README.md .gitignore
git commit -m "feat: scaffold public dashboard repo

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: The render script

**Files:**
- Create: `~/Repositories/oss-contributions/scripts/render.mjs`

**Interfaces:**
- Consumes: `config.json` from Task 1; env `GH_TOKEN` (or `GITHUB_TOKEN`).
- CLI: `node scripts/render.mjs --target <readme|profile> [--out <path>]`. `readme` defaults `--out` to `README.md`; `profile` requires `--out`.
- Produces: the `render.mjs` invocation contract that Task 3's workflow calls.

- [ ] **Step 1: Write `scripts/render.mjs`**

```javascript
#!/usr/bin/env node
// render.mjs — generate the OSS contributions dashboard from the GitHub API.
// Zero dependencies; Node 20+ (global fetch). Writes only between markers.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const START = "<!-- OSS:START -->";
const END = "<!-- OSS:END -->";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function parseArgs(argv) {
  const args = { target: "readme", out: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--target") args.target = argv[++i];
    else if (argv[i] === "--out") args.out = argv[++i];
  }
  return args;
}

async function fetchWithRetry(url, token, attempts = 3) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    const res = await fetch(url, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "oss-contributions-dashboard",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (res.ok) return res;
    const rateLimited =
      res.status === 403 && res.headers.get("x-ratelimit-remaining") === "0";
    if (rateLimited || res.status >= 500) {
      await sleep(1500 * (i + 1));
      continue;
    }
    lastErr = new Error(`GitHub API ${res.status}: ${await res.text()}`);
    break;
  }
  throw lastErr ?? new Error(`GitHub API failed after ${attempts} attempts: ${url}`);
}

function nextLink(linkHeader) {
  if (!linkHeader) return null;
  for (const part of linkHeader.split(",")) {
    const m = part.match(/<([^>]+)>;\s*rel="next"/);
    if (m) return m[1];
  }
  return null;
}

async function ghSearch(query, token) {
  const items = [];
  let total = 0;
  let url = `https://api.github.com/search/issues?q=${encodeURIComponent(query)}&per_page=100`;
  while (url) {
    const res = await fetchWithRetry(url, token);
    const body = await res.json();
    total = body.total_count ?? total;
    items.push(...(body.items ?? []));
    url = nextLink(res.headers.get("link"));
  }
  return { total, items };
}

const repoOf = (item) =>
  item.repository_url.replace("https://api.github.com/repos/", "");

function buildDashboard(d) {
  const repos = [...new Set(d.merged.items.map(repoOf))].sort();
  const orgs = [...new Set(repos.map((r) => r.split("/")[0]))];
  const recent = [...d.merged.items]
    .sort((a, b) => (b.closed_at ?? "").localeCompare(a.closed_at ?? ""))
    .slice(0, d.recentLimit);

  const out = [];
  out.push("## Open-source contributions", "");
  out.push(
    `**${d.merged.total} merged contributions** across **${repos.length} repositories** in ${orgs.length} orgs.`,
    ""
  );
  out.push(`🔧 **${d.open.total} open** PR${d.open.total === 1 ? "" : "s"} in flight.`, "");
  out.push("### Anchor coverage", "");
  for (const a of d.anchors) {
    out.push(`- ${repos.includes(a) ? "✅" : "▢"} [${a}](https://github.com/${a})`);
  }
  out.push("", "### Recent merged PRs", "");
  if (recent.length === 0) {
    out.push("_None yet._");
  } else {
    out.push("| Repo | PR | Merged |", "| --- | --- | --- |");
    for (const it of recent) {
      const repo = repoOf(it);
      const title = it.title.replace(/\|/g, "\\|");
      out.push(`| [${repo}](https://github.com/${repo}) | [${title}](${it.html_url}) | ${(it.closed_at ?? "").slice(0, 10)} |`);
    }
  }
  out.push("", `_Last updated ${new Date().toISOString().slice(0, 10)} · generated from the GitHub API._`);
  return out.join("\n");
}

function buildProfile(d) {
  const repos = new Set(d.merged.items.map(repoOf));
  return [
    "### 🌱 Open-source",
    "",
    `**${d.merged.total} merged PRs** across **${repos.size} repos** · **${d.open.total} open** in flight.`,
    "",
    `→ [Full dashboard](https://github.com/${d.username}/oss-contributions)`,
  ].join("\n");
}

function replaceMarkers(content, block) {
  const wrapped = `${START}\n${block}\n${END}`;
  const s = content.indexOf(START);
  const e = content.indexOf(END);
  if (s === -1 || e === -1 || e < s) {
    const sep = content && !content.endsWith("\n") ? "\n\n" : content ? "\n" : "";
    return `${content}${sep}${wrapped}\n`;
  }
  return content.slice(0, s) + wrapped + content.slice(e + END.length);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = JSON.parse(readFileSync(join(ROOT, "config.json"), "utf8"));
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || "";
  const user = config.username;

  const merged = await ghSearch(`author:${user} is:pr is:merged -user:${user}`, token);
  const open = await ghSearch(`author:${user} is:pr is:open -user:${user}`, token);

  const data = {
    username: user,
    merged,
    open,
    anchors: config.anchors ?? [],
    recentLimit: config.recentLimit ?? 10,
  };

  const outPath =
    args.out ?? (args.target === "readme" ? join(ROOT, "README.md") : null);
  if (!outPath) throw new Error("--out is required for non-readme targets");

  const block = args.target === "profile" ? buildProfile(data) : buildDashboard(data);
  let existing = "";
  try {
    existing = readFileSync(outPath, "utf8");
  } catch {
    existing = "";
  }
  const updated = replaceMarkers(existing, block);
  if (updated !== existing) {
    writeFileSync(outPath, updated);
    console.log(`Updated ${outPath}`);
  } else {
    console.log(`No change to ${outPath}`);
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
```

- [ ] **Step 2: Run the readme target against the live API**

Run from `~/Repositories/oss-contributions`:
```bash
GH_TOKEN=$(gh auth token) node scripts/render.mjs --target readme
```
Expected: prints `Updated .../README.md`; `README.md` now has a populated dashboard between the markers (counts, anchor checklist, recent-PR table).

- [ ] **Step 3: Spot-check the headline count is real**

Run: `gh search prs --author thatssoheil --merged -- "-user:thatssoheil" | wc -l` (approximate cross-check)
Also: `gh api -X GET search/issues -f q="author:thatssoheil is:pr is:merged -user:thatssoheil" --jq .total_count`
Expected: the second number matches the "merged contributions" number in the README.

- [ ] **Step 4: Verify the profile target writes a compact block to a scratch file**

```bash
printf '# x\n\n<!-- OSS:START -->\n<!-- OSS:END -->\n' > /tmp/profile-test.md
GH_TOKEN=$(gh auth token) node scripts/render.mjs --target profile --out /tmp/profile-test.md
cat /tmp/profile-test.md
```
Expected: file shows the `### 🌱 Open-source` summary between the markers, with the `# x` heading preserved above.

- [ ] **Step 5: Verify failure safety (bad token does not write)**

```bash
cp README.md /tmp/readme-before.md
GH_TOKEN=invalid node scripts/render.mjs --target readme; echo "exit=$?"
diff README.md /tmp/readme-before.md && echo "UNCHANGED"
```
Expected: non-zero exit and `UNCHANGED` (a 401 must not overwrite the README). If GitHub returns results anyway for an unauthenticated-style query, re-run with a malformed URL host is not needed — the 401 path is the relevant one.

- [ ] **Step 6: Commit**

```bash
git add scripts/render.mjs README.md
git commit -m "feat: render dashboard from GitHub Search API

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Daily GitHub Action

**Files:**
- Create: `~/Repositories/oss-contributions/.github/workflows/update.yml`

**Interfaces:**
- Consumes: `scripts/render.mjs` CLI from Task 2; secret `PROFILE_TOKEN` (created at the gate, Task 5); built-in `GITHUB_TOKEN`.
- Produces: a daily + manually-dispatchable job that self-updates this README and the profile README.

- [ ] **Step 1: Write `.github/workflows/update.yml`**

```yaml
name: update-dashboard

on:
  schedule:
    - cron: "0 6 * * *"
  workflow_dispatch:

permissions:
  contents: write

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout dashboard repo
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: "20"

      - name: Render dashboard README
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: node scripts/render.mjs --target readme

      - name: Commit dashboard if changed
        run: |
          if [ -n "$(git status --porcelain)" ]; then
            git config user.name "github-actions[bot]"
            git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
            git commit -am "chore: update contributions dashboard"
            git push
          else
            echo "No dashboard changes."
          fi

      - name: Checkout profile repo
        uses: actions/checkout@v4
        with:
          repository: thatssoheil/thatssoheil
          token: ${{ secrets.PROFILE_TOKEN }}
          path: profile

      - name: Render profile summary
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: node scripts/render.mjs --target profile --out profile/README.md

      - name: Commit profile if changed
        run: |
          cd profile
          if [ -n "$(git status --porcelain)" ]; then
            git config user.name "github-actions[bot]"
            git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
            git commit -am "chore: update OSS summary"
            git push
          else
            echo "No profile changes."
          fi
```

- [ ] **Step 2: Lint the workflow YAML**

Run: `command -v actionlint >/dev/null && actionlint .github/workflows/update.yml || node -e "require('fs').readFileSync('.github/workflows/update.yml','utf8')" && echo "yaml present"`
Expected: actionlint passes if installed; otherwise confirm the file is well-formed (no tabs, consistent indentation) by eye.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/update.yml
git commit -m "ci: daily dashboard + profile update action

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Seed the private campaign repo

**Files:**
- Create: `~/Repositories/oss-campaign/campaign.md`
- Create: `~/Repositories/oss-campaign/README.md`

**Interfaces:**
- Produces: `campaign.md` — the cross-device strategy source the oss-hunt skill points at in Task 6. Seeded from currently-known state.

- [ ] **Step 1: Init the repo**

```bash
mkdir -p ~/Repositories/oss-campaign
git -C ~/Repositories/oss-campaign init -q
git -C ~/Repositories/oss-campaign branch -m main
git -C ~/Repositories/oss-campaign config user.name "Soheil Fakour"
git -C ~/Repositories/oss-campaign config user.email "51275156+thatssoheil@users.noreply.github.com"
```

- [ ] **Step 2: Create `README.md`**

```markdown
# oss-campaign (private)

Private, cross-device source of truth for my open-source contribution campaign:
anchors, queued targets, PRs in flight, and networking notes. Synced by plain
`git pull` / `git push`. Never published — the public dashboard lives in
[oss-contributions](https://github.com/thatssoheil/oss-contributions).
```

- [ ] **Step 3: Create `campaign.md`** (seeded from known state; update freely)

```markdown
# OSS Campaign

## Strategy

Deep-anchor the Cloudflare/Next.js edge stack; pick opportunistic wins in
TanStack / shadcn / radix. Quality over volume — every PR must be defensible in
a maintainer review.

## Anchors

- opennextjs/opennextjs-cloudflare — primary depth anchor
- cloudflare/workers-sdk
- TanStack/router, TanStack/query
- shadcn-ui/ui
- radix-ui/primitives
- vercel/next.js

## In flight

- shadcn-ui/ui (cmdk) #409 — in progress

## Merged

- opennextjs/opennextjs-cloudflare #1289 — merged

## Queued / scouting

- opennextjs-cloudflare #1278, #1251 — candidates

## Networking notes

- (add maintainer / context notes here)
```

- [ ] **Step 4: Commit**

```bash
git -C ~/Repositories/oss-campaign add README.md campaign.md
git -C ~/Repositories/oss-campaign commit -m "chore: seed private campaign state

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Human gate — publish to GitHub

**This task pushes to GitHub and creates a token. Do NOT run any step until Soheil explicitly says go.** Steps that need his hands (the PAT) are flagged.

**Files:** none locally; this creates remote repos + a secret.

**Interfaces:**
- Consumes: all prior local work; the fine-grained PAT Soheil creates by hand.
- Produces: `thatssoheil/oss-contributions` (public), `thatssoheil/oss-campaign` (private), `thatssoheil/thatssoheil` (public, if absent), secret `PROFILE_TOKEN`, and a first green dashboard.

- [ ] **Step 1: Create + push the public dashboard repo**

```bash
cd ~/Repositories/oss-contributions
gh repo create thatssoheil/oss-contributions --public --source=. --remote=origin --push
```
Expected: repo created, `main` pushed.

- [ ] **Step 2: Create + push the private campaign repo**

```bash
cd ~/Repositories/oss-campaign
gh repo create thatssoheil/oss-campaign --private --source=. --remote=origin --push
```
Expected: private repo created and pushed.

- [ ] **Step 3: Ensure the profile repo exists with markers**

```bash
if ! gh repo view thatssoheil/thatssoheil >/dev/null 2>&1; then
  tmp=$(mktemp -d); cd "$tmp"; git init -q; git branch -m main
  printf '# Hi, I'\''m Soheil 👋\n\n<!-- OSS:START -->\n<!-- OSS:END -->\n' > README.md
  git add README.md
  git -c user.name="Soheil Fakour" -c user.email="51275156+thatssoheil@users.noreply.github.com" commit -qm "init profile readme"
  gh repo create thatssoheil/thatssoheil --public --source=. --remote=origin --push
fi
```
Expected: profile repo exists and contains the marker pair. (If it already exists, **manually** ensure its README has the `<!-- OSS:START -->` / `<!-- OSS:END -->` pair, or the profile render appends a block.)

- [ ] **Step 4: (SOHEIL, manual) Create the fine-grained PAT**

In the browser: GitHub → Settings → Developer settings → Fine-grained tokens → Generate.
- Resource owner: `thatssoheil`
- Repository access: **Only select repositories** → `thatssoheil/thatssoheil`
- Permissions: **Contents → Read and write** (nothing else)
- Expiration: your call (e.g. 1 year)

Copy the token.

- [ ] **Step 5: Store the PAT as a secret on the dashboard repo**

```bash
gh secret set PROFILE_TOKEN --repo thatssoheil/oss-contributions
# paste the token when prompted
```
Expected: `✓ Set secret PROFILE_TOKEN`.

- [ ] **Step 6: Trigger the Action and verify**

```bash
gh workflow run update-dashboard --repo thatssoheil/oss-contributions
sleep 20
gh run watch --repo thatssoheil/oss-contributions "$(gh run list --repo thatssoheil/oss-contributions --workflow update-dashboard --limit 1 --json databaseId --jq '.[0].databaseId')"
```
Expected: green run. Then confirm both READMEs updated:
```bash
gh api repos/thatssoheil/oss-contributions/readme --jq '.content' | base64 -d | grep -c "merged contributions"
gh api repos/thatssoheil/thatssoheil/readme --jq '.content' | base64 -d | grep -c "Open-source"
```
Expected: both print `1` (or more).

---

### Task 6: Point the oss-hunt skill at the synced campaign file (follow-up)

**Files:**
- Modify: the `oss-hunt` skill definition (`~/.claude/skills/oss-hunt/SKILL.md` or equivalent — locate first).

**Interfaces:**
- Consumes: `~/Repositories/oss-campaign/campaign.md` from Task 4.
- Produces: an oss-hunt skill whose Phase 0 (recall) and Phase 7 (after shipping) read/write the synced campaign file instead of the non-existent `-home-soheil-playground` memory path.

- [ ] **Step 1: Locate the skill file and its current campaign paths**

Run: `grep -rn "oss-contribution-campaign\|-home-soheil-playground" ~/.claude/skills/oss-hunt/`
Expected: the Phase 0 path references that need updating.

- [ ] **Step 2: Update Phase 0 + Phase 7 references**

Replace the campaign-memory path with `~/Repositories/oss-campaign/campaign.md`, and note that Phase 7 should `git -C ~/Repositories/oss-campaign commit` the updated state so it syncs across devices.

- [ ] **Step 3: Verify the skill still reads cleanly**

Run: `grep -n "oss-campaign/campaign.md" ~/.claude/skills/oss-hunt/SKILL.md`
Expected: the new path is present in both phases; no stale `-home-soheil-playground` references remain.

- [ ] **Step 4: Commit (if the skills dir is a git repo)**

```bash
git -C ~/.claude/skills add oss-hunt && git -C ~/.claude/skills commit -m "chore(oss-hunt): point campaign state at synced oss-campaign repo

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" || echo "skills dir not a git repo; edit saved in place"
```

---

## Self-Review

**Spec coverage:**
- Private synced strategy repo → Task 4 + Task 6 ✅
- Public canonical dashboard, auto from API → Tasks 1–3 ✅
- Profile compact summary via PAT → Task 3 (workflow) + Task 5 (PAT) ✅
- Metrics (merged external, open, repos/orgs, anchor coverage, recent table, no streak) → Task 2 `buildDashboard` ✅
- Marker + failure safety → Task 2 Steps 5 + `replaceMarkers`/`fetchWithRetry` ✅
- Scope = all non-owned repos → Global Constraints + Task 2 queries ✅
- Verification by execution, no tests → Task 2 Steps 2–5 ✅
- Human gate before any remote action → Task 5 ✅

**Placeholder scan:** No TBD/TODO; every code step shows complete code. The only intentional "fill in later" is the campaign.md networking-notes line, which is user content, not a plan gap.

**Type consistency:** `render.mjs` CLI (`--target`, `--out`) matches the workflow invocations in Task 3. `config.json` keys (`username`, `recentLimit`, `anchors`) match `main()` reads. `repoOf`, `buildDashboard`, `buildProfile`, `replaceMarkers` names are consistent across their call sites.
