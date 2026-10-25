# UpdateWhat for DeepSeek Harness

English | [中文](README.zh.md)

**Upgrade evidence for agent-driven dependency upgrades.** UpdateWhat turns the gap between two releases into a compact brief the agent can act on: release notes, the commits that signal breaking changes, links to the source, and a migration checklist. The agent writes the guide and changes the code; the plugin does not make a second LLM call.

Inspired by [updateWhat-web](https://github.com/Linkodt/updateWhat-web).

## Why

Upgrading a dependency means reading dozens of release notes and commits, then translating them into code changes. Doing that inside an agent session usually floods the context or skips the important entries. This bundle fetches the raw material, filters it, and keeps the pack small enough to reason about.

## What it does

- Fetches releases in the requested version range (up to two GitHub API pages), with a `v`-prefix fallback for tags. `from` is inclusive; `to` is an inclusive upper bound at its own precision, so `to=18` admits every `18.x.y` and `to=18.1` admits `18.1.x`.
- Skips prereleases unless `to` is itself a prerelease, so a stable upgrade does not pick up rc or beta notes that sit between the two versions.
- Compares the two tags and keeps commits that mention breaking changes, removals, deprecations, migrations, refactors, features, fixes, security, performance, or CVEs.
- Runs the releases and compare requests in parallel; if one side fails, the pack still carries the other side plus a collection warning.
- Renders one Markdown evidence pack with counts, compare and commit links, truncation notes, and concrete next steps.
- Treats GitHub text as untrusted data and performs no model call.

## Install

### From a plugin market

This repository hosts a format-1 market index at [`market.json`](market.json). In the Harness Web UI:

1. Open **Plugins** → **Experimental plugins** → **More**, and enable **Custom plugin markets**.
2. Open **Discover** → **Add index source**, and enter one of:
   - `https://fastly.jsdelivr.net/gh/Linkodt/whatsNew@main/market.json` — CDN mirror, works where `raw.githubusercontent.com` is blocked;
   - `https://raw.githubusercontent.com/Linkodt/whatsNew/main/market.json` — canonical GitHub URL.
3. Install **UpdateWhat** from the card.

The index is unsigned: only add market sources you trust.

### From Git

```
plugin_manager install_bundle
  target: git+https://github.com/Linkodt/whatsNew.git#<commit>
```

Use the commit listed in [`market.json`](market.json). The plugin has no build step, so a Git install runs the published files directly.

On a network where `github.com` HTTPS is blocked, route Git through SSH before installing:

```bash
git config --global url."git@github.com:".insteadOf "https://github.com/"
```

The install spec stays the same; Git rewrites it to SSH. Publishing to npm is the other reliable option.

### From a local checkout

```
plugin_manager install_bundle
  target: /absolute/path/to/whatsNew
```

The bundle inserts one Host row (`updatewhat`) and exposes one tool (`upgrade_guide`) to agents in the profile. Installation affects every session using that profile.

## Use

Ask the agent in ordinary language:

> Upgrade React from 17.0.0 to 18.0.0 and fix the migration.

The agent calls `upgrade_guide`, writes the upgrade guide, edits the workspace, and runs the project's checks.

The tool can also be called directly:

```
upgrade_guide repo=facebook/react from=17.0.0 to=18.0.0
```

### Tool reference

| Parameter | Required | Meaning |
|---|---|---|
| `repo` | yes | `owner/repo`, `https://github.com/owner/repo`, or `github.com/owner/repo`. |
| `from` | yes | Current version or tag, e.g. `17.0.0` or `v17.0.0`. |
| `to` | yes | Target version or tag, e.g. `18.2.0` or `v18.2.0`. A partial version is an inclusive upper bound: `18` accepts every `18.x.y`, `18.1` accepts `18.1.x`. |
| `maxReleases` | no | Release notes to include, 1–50. Defaults to 20. |
| `maxCommits` | no | Important commits to list, 1–300. Defaults to 120. |

### Output

The pack contains:

- source and compare links, plus release/commit counts;
- **Collection warnings** when one GitHub endpoint failed;
- **Release notes** for the range, oldest first. When `maxReleases` caps the range, the target release and notes that mention breaking changes, deprecations, migrations, removals, security, or incompatibilities are kept first, and recency fills the remaining slots;
- **Important commits** with short SHA, date, subject, and commit link;
- **Next steps for the agent**: confirm the manifest, write the guide with fixed sections, apply the migration, run the checks, keep uncertain APIs as open questions.

## Configuration

| Config | Default | Meaning |
|---|---|---|
| `githubToken` | env `GITHUB_TOKEN` / `GH_TOKEN` | Bearer token for higher limits and private repositories. |
| `githubApiBase` | `https://api.github.com` | API origin and optional path prefix, e.g. `https://ghe.example.com/api/v3`. |

Set the token in the environment that launches the Harness to move from 60 to 5,000 requests per hour. A token in the row config works too.

## How it works

1. `fetchReleases` reads up to two pages of releases and keeps the tags inside the range, comparing `to` at its own precision and dropping prereleases unless `to` is one.
2. `compareTags` calls GitHub's compare endpoint, retrying with and without a `v` prefix.
3. Commits are filtered by keywords and conventional-commit breaking markers (`feat!:`, `BREAKING CHANGE`).
4. The pack is assembled with caps on per-release and total release text, so one huge changelog cannot flood the context. Under a cap, change-signal notes are selected before ordinary patches and the result is re-sorted chronologically.

Each HTTP request opens its own connection, has a 45-second deadline, and is bounded to 12 MiB. A failed side becomes a warning rather than a failed call when the other side succeeded.

## Limits

- Unauthenticated GitHub allows 60 requests per hour; private repositories need a token.
- GitHub compare returns at most 250 commits per response; the pack says so when the range is larger.
- Release notes cover at most the newest 200 releases; a range that starts further back may miss older notes.
- Per-release notes are capped at 6,000 characters and 40,000 characters total.
- Only `to` accepts a partial version; `from` must be the exact version currently deployed, because it is the inclusive lower bound.
- Prereleases are included only when `to` is a prerelease.
- The plugin does not edit manifests, run package managers, or apply the migration by itself; the agent uses its normal workspace tools.
- Discover has no upgrade action; publishing a new version means a new index entry and a reinstall.

## Development

```bash
node --check index.js
node test/offline.mjs
```

The test starts a local HTTP server that stands in for `api.github.com` and covers range filtering, partial and prerelease bounds, cap priority, `v` prefixes, redirects, rate-limit reporting, partial packs, and argument validation. It does not touch the network. There are no runtime dependencies and no build step.

## Publishing

See [`publishing/README.md`](publishing/README.md) for the Git, npm, and market-index routes, the format-1 index rules, and the pre-publish checklist.

## License

MIT © 2026 keda. See [LICENSE](LICENSE).
