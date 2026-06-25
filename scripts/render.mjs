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
  // Headingless: the profile README owns the `## Open-source` heading;
  // the bot only rewrites these stats between the markers.
  return [
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
