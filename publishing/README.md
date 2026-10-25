# Publishing UpdateWhat

The repository is the distribution unit: `package.json` sits at the root, declares `dsh.bundle.patch`, and the plugin has no build step. There are three supported ways to distribute it.

## 1. Direct Git install

Pin a full commit; branches are not accepted by the market format.

```bash
git rev-parse HEAD
```

Users install:

```
plugin_manager install_bundle
  target: git+https://github.com/Linkodt/whatsNew.git#<commit>
```

The plugin manager runs `git ls-remote` against the host before `pnpm add`, so the repository must be reachable without an interactive credential prompt. This repository is public.

If `github.com` HTTPS is blocked on the user's network, add the SSH rewrite once and keep the same install spec:

```bash
git config --global url."git@github.com:".insteadOf "https://github.com/"
```

## 2. Custom plugin market (Discover card)

The root [`market.json`](../market.json) is a format-1 index. It is already configured with the package name, the repository, an inline icon, and one pinned version.

Host it at a final HTTPS URL — no redirects, because the reader refuses them:

```
https://raw.githubusercontent.com/Linkodt/whatsNew/main/market.json
```

For networks where `raw.githubusercontent.com` is blocked, use a direct CDN mirror (both tested to return the document without a redirect):

```
https://fastly.jsdelivr.net/gh/Linkodt/whatsNew@main/market.json
https://gcore.jsdelivr.net/gh/Linkodt/whatsNew@main/market.json
```

jsDelivr caches a branch URL for a while; a newly pushed index can take time to appear. For an immutable URL, pin the tag or commit instead (`@v0.2.1`), accepting that the URL changes with each release.

Users then:

1. Open **Plugins** → **Experimental plugins** → **More**, and enable **Custom plugin markets**.
2. Open **Discover** → **Add index source**, and paste the URL.
3. Install **UpdateWhat** from the card.

The index is unsigned. The trust notice in the install dialog is the only gate; only add sources you trust.

## 3. npm

The package name is `dsh-updatewhat` and it is currently not published. To publish:

```bash
npm login
npm publish --access public
```

Then add an npm version to the index:

```json
{
  "version": "0.2.1",
  "publishTimestamp": 1792899762,
  "source": { "type": "npm" }
}
```

npm versions install as `dsh-updatewhat@0.2.1`; Git versions install as the pinned commit.

## Updating a release

1. Bump `version` in `package.json` and add the matching `locale` strings if the UI copy changed.
2. Run `node --check index.js` and `node test/offline.mjs`.
3. Commit, then take the new full commit SHA.
4. Append a version object to `market.json` with that SHA and the new `publishTimestamp`; keep older versions if users may still install them.
5. Commit the index and push. Discover reports `Update available`; there is no upgrade action, so users reinstall.

The index may list several plugins, but this repository carries one.

## Official catalog

The built-in Official catalog is part of the DSH installation (`OPTIONAL_BUNDLES` / `OFFICIAL_ON_DEMAND_CATALOG` in `dsh-app-boot`), not something an index can add. There is no self-serve upload. If the project opens submissions, this format-1 index is the natural input; until then a custom market or a Git spec is the supported path.

## Format rules that bite

- `format` must be `1`; `title` is required and localized objects must contain `en`.
- Versions are exact SemVer strings; `publishTimestamp` is Unix **seconds** (integer).
- A Git source needs a **40-character lowercase hex** commit, a canonical `https` URL with at least two path segments, and no credentials, query, or fragment.
- A package in a subdirectory uses `source.path` (and `repository.directory` for display); never point the URL at a tarball.
- Icons are `https` URLs or inline `data:` URLs of at most 32 KiB decoded. This index inlines `icon.svg` so it does not depend on raw file content types.
- The reader caps an index at 128 MiB and gives each fetch 15 seconds.
- A market may declare categories, labels, and sort keys; none are required for a single plugin.

## Pre-publish checklist

- [ ] `package.json` name is `dsh-updatewhat` and `cordis.patch.yml` uses the same name.
- [ ] `private` is absent, `license`/`repository`/`homepage` are present.
- [ ] `files` covers every runtime file, locale, icon, README, license, and the index.
- [ ] `locale/en.json` and `locale/zh.json` carry `meta.title` / `meta.description`.
- [ ] `node --check index.js` and `node test/offline.mjs` pass.
- [ ] `market.json` pins the commit that contains the released `package.json`.
- [ ] The index URL is final (no redirect) and adding it in Discover succeeds.
- [ ] The Git spec installs in a scratch profile.
