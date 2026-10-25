import { createServer } from 'node:http'
import { apply } from '../index.js'

// Offline test: a local HTTP server stands in for api.github.com, so the plugin
// exercises its real transport (redirects, status handling, timeouts) without
// touching the network.

const releases = [
  { tag_name: 'v18.1.0-beta.1', name: '18.1 beta', draft: false, prerelease: true, published_at: '2024-06-01T00:00:00Z', body: 'Beta notes', html_url: 'https://github.com/acme/lib/releases/tag/v18.1.0-beta.1' },
  { tag_name: 'v18.0.0', name: '18.0.0', draft: false, prerelease: false, published_at: '2024-04-01T00:00:00Z', body: 'Removed the legacy renderer.\n\nBREAKING CHANGE: ReactDOM.render is gone. Use createRoot.', html_url: 'https://github.com/acme/lib/releases/tag/v18.0.0' },
  { tag_name: 'v17.0.2', name: '17.0.2', draft: false, prerelease: false, published_at: '2024-03-01T00:00:00Z', body: 'Patch fixes', html_url: 'https://github.com/acme/lib/releases/tag/v17.0.2' },
  { tag_name: 'v17.0.1', name: '17.0.1', draft: false, prerelease: false, published_at: '2024-02-01T00:00:00Z', body: 'Patch fixes', html_url: 'https://github.com/acme/lib/releases/tag/v17.0.1' },
  { tag_name: 'v17.0.0', name: '17.0.0', draft: false, prerelease: false, published_at: '2024-01-01T00:00:00Z', body: 'New scheduler', html_url: 'https://github.com/acme/lib/releases/tag/v17.0.0' },
  { tag_name: 'v16.0.0', name: '16.0.0', draft: false, prerelease: false, published_at: '2023-01-01T00:00:00Z', body: 'Old', html_url: 'https://github.com/acme/lib/releases/tag/v16.0.0' },
]

// Edge-range fixture: an rc before its stable, plus later minors and a major.
const edgeReleases = [
  { tag_name: 'v19.0.0', name: '19.0.0', draft: false, prerelease: false, published_at: '2024-10-01T00:00:00Z', body: 'Next major', html_url: 'https://github.com/edge/lib/releases/tag/v19.0.0' },
  { tag_name: 'v18.2.0', name: '18.2.0', draft: false, prerelease: false, published_at: '2024-09-01T00:00:00Z', body: 'Minor features', html_url: 'https://github.com/edge/lib/releases/tag/v18.2.0' },
  { tag_name: 'v18.1.9', name: '18.1.9', draft: false, prerelease: false, published_at: '2024-08-01T00:00:00Z', body: 'Patch fixes', html_url: 'https://github.com/edge/lib/releases/tag/v18.1.9' },
  { tag_name: 'v18.0.0', name: '18.0.0', draft: false, prerelease: false, published_at: '2024-06-01T00:00:00Z', body: 'Stable release', html_url: 'https://github.com/edge/lib/releases/tag/v18.0.0' },
  { tag_name: 'v18.0.0-rc.1', name: '18.0.0 rc 1', draft: false, prerelease: true, published_at: '2024-05-01T00:00:00Z', body: 'Release candidate', html_url: 'https://github.com/edge/lib/releases/tag/v18.0.0-rc.1' },
]

// Capped-range fixture: 25 plain releases, the second oldest carrying the only breaking note.
const capReleases = Array.from({ length: 25 }, (_, index) => {
  const version = 25 - index
  return {
    tag_name: `v${version}.0.0`,
    name: `${version}.0.0`,
    draft: false,
    prerelease: false,
    published_at: new Date(Date.UTC(2024, 0, version)).toISOString(),
    body: version === 2 ? 'BREAKING: removed the legacy config loader.' : 'Routine maintenance notes.',
    html_url: `https://github.com/cap/lib/releases/tag/v${version}.0.0`,
  }
})

// Non-SemVer tags exercise the string fallback.
const exoticReleases = [
  { tag_name: 'release-2025-01', name: 'release-2025-01', draft: false, prerelease: false, published_at: '2025-01-15T00:00:00Z', body: 'Out of range', html_url: 'https://github.com/exotic/lib/releases/tag/release-2025-01' },
  { tag_name: 'release-2024-06', name: 'release-2024-06', draft: false, prerelease: false, published_at: '2024-06-15T00:00:00Z', body: 'Upper bound', html_url: 'https://github.com/exotic/lib/releases/tag/release-2024-06' },
  { tag_name: 'release-2024-01', name: 'release-2024-01', draft: false, prerelease: false, published_at: '2024-01-15T00:00:00Z', body: 'Lower bound', html_url: 'https://github.com/exotic/lib/releases/tag/release-2024-01' },
  { tag_name: 'release-2023-12', name: 'release-2023-12', draft: false, prerelease: false, published_at: '2023-12-15T00:00:00Z', body: 'Out of range', html_url: 'https://github.com/exotic/lib/releases/tag/release-2023-12' },
]

// The release name repeats the publication date.
const datedReleases = [
  { tag_name: 'v18.0.0', name: '18.0.0 (April 1, 2024)', draft: false, prerelease: false, published_at: '2024-04-01T00:00:00Z', body: 'Notes', html_url: 'https://github.com/dated/lib/releases/tag/v18.0.0' },
]

const commits = [
  { sha: 'aaaaaaa1111111', html_url: 'https://github.com/acme/lib/commit/aaaaaaa', commit: { message: 'feat(react): add useId', author: { date: '2024-03-02T00:00:00Z' } } },
  { sha: 'bbbbbbb2222222', html_url: 'https://github.com/acme/lib/commit/bbbbbbb', commit: { message: 'fix: typo in warning', author: { date: '2024-03-03T00:00:00Z' } } },
  { sha: 'ccccccc3333333', html_url: 'https://github.com/acme/lib/commit/ccccccc', commit: { message: 'chore: bump dev deps', author: { date: '2024-03-04T00:00:00Z' } } },
  { sha: 'ddddddd4444444', html_url: 'https://github.com/acme/lib/commit/ddddddd', commit: { message: 'refactor!: drop ReactDOM.render', author: { date: '2024-03-05T00:00:00Z' } } },
  { sha: 'eeeeeee5555555', html_url: 'https://github.com/acme/lib/commit/eeeeeee', commit: { message: 'docs: update readme', author: { date: '2024-03-06T00:00:00Z' } } },
]

const compareHits = []
const releaseHits = []

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'content-type': 'application/json', ...headers })
  res.end(body === undefined ? '' : JSON.stringify(body))
}

const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1')
  const path = url.pathname

  if (path === '/repos/limited/lib/releases') {
    send(res, 403, { message: 'API rate limit exceeded for 1.2.3.4.' }, {
      'x-ratelimit-remaining': '0',
      'x-ratelimit-reset': '1792854715',
    })
    return
  }

  if (path === '/repos/moved/lib/releases') {
    send(res, 301, '', { location: '/repos/acme/lib/releases' })
    return
  }
  if (path.startsWith('/repos/moved/lib/compare/')) {
    send(res, 301, '', { location: path.replace('/repos/moved/lib/', '/repos/acme/lib/') })
    return
  }

  if (path === '/repos/noreleases/lib/releases') {
    send(res, 500, { message: 'Server Error' })
    return
  }
  if (path.startsWith('/repos/noreleases/lib/compare/')) {
    send(res, 200, {
      html_url: 'https://github.com/noreleases/lib/compare/v1.0.0...v2.0.0',
      total_commits: 1,
      commits: [commits[3]],
    })
    return
  }

  if (path === '/repos/nocompare/lib/releases') {
    send(res, 200, releases)
    return
  }
  if (path.startsWith('/repos/nocompare/lib/compare/')) {
    send(res, 500, { message: 'Server Error' })
    return
  }

  if (path === '/repos/acme/lib/releases') {
    releaseHits.push(url.search)
    send(res, 200, releases)
    return
  }

  if (path === '/repos/edge/lib/releases') {
    send(res, 200, edgeReleases)
    return
  }
  if (path === '/repos/cap/lib/releases') {
    send(res, 200, capReleases)
    return
  }
  if (path === '/repos/exotic/lib/releases') {
    send(res, 200, exoticReleases)
    return
  }
  if (path === '/repos/dated/lib/releases') {
    send(res, 200, datedReleases)
    return
  }
  if (/^\/repos\/(?:edge|cap|exotic|dated)\/lib\/compare\//.test(path)) {
    send(res, 200, { total_commits: 0, commits: [] })
    return
  }

  if (path.startsWith('/repos/acme/lib/compare/')) {
    const pair = decodeURIComponent(path.slice('/repos/acme/lib/compare/'.length))
    compareHits.push(pair)
    if (pair === 'v17.0.0...v18.0.0') {
      send(res, 200, {
        html_url: 'https://github.com/acme/lib/compare/v17.0.0...v18.0.0',
        total_commits: 900,
        commits,
      })
      return
    }
    send(res, 404, { message: 'Not Found' })
    return
  }

  send(res, 404, { message: 'Not Found' })
})

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const base = `http://127.0.0.1:${server.address().port}`

const registered = []
apply({ tools: { register: (definition) => registered.push(definition) } }, { githubApiBase: base })

const tool = registered[0]
if (!tool) throw new Error('no tool registered')
if (tool.name !== 'upgrade_guide') throw new Error('unexpected tool name')
if (!tool.parameters.required.includes('repo')) throw new Error('parameter schema missing required')
if (!Array.isArray(tool.output.schema.required)) throw new Error('output schema required must be an array')

const exec = { signal: new AbortController().signal }
const result = await tool.execute({ repo: 'https://github.com/acme/lib', from: '17.0.0', to: '18.0.0' }, exec)

const checks = [
  [result.releases === 4, 'range must contain 4 releases (17.0.0, 17.0.1, 17.0.2, 18.0.0)'],
  [result.markdown.includes('v18.1.0-beta.1') === false, 'beta release must be out of range'],
  [result.importantCommits === 3, 'important commits must be feat + fix + breaking refactor'],
  [result.markdown.includes('chore: bump dev deps') === false, 'chore commit must be filtered'],
  [result.markdown.includes('GitHub compare returned the first 5'), 'truncation note for capped compare'],
  [result.markdown.includes('## Next steps for the agent'), 'next steps section'],
  [result.markdown.includes('UpdateWhat for DeepSeek Harness v0.3.0'), 'version footer'],
  [compareHits.slice(0, 2).join(',') === '17.0.0...18.0.0,v17.0.0...v18.0.0', 'v-prefix fallback after a 404'],
  [releaseHits.length === 1, 'releases fetched from one page only when fewer than 100'],
]

const moved = await tool.execute({ repo: 'moved/lib', from: '17.0.0', to: '18.0.0' }, exec)
checks.push([moved.releases === 4, '301 redirects are followed for releases and compare'])

const noReleases = await tool.execute({ repo: 'noreleases/lib', from: '1.0.0', to: '2.0.0' }, exec)
checks.push([
  noReleases.markdown.includes('Release notes were not fetched') &&
    noReleases.markdown.includes('Commit comparison was not fetched') === false &&
    noReleases.importantCommits === 1,
  'a releases failure degrades to a commit-only evidence pack',
])

const noCompare = await tool.execute({ repo: 'nocompare/lib', from: '17.0.0', to: '18.0.0' }, exec)
checks.push([
  noCompare.markdown.includes('Commit comparison was not fetched') &&
    noCompare.markdown.includes('Release notes were not fetched') === false &&
    noCompare.releases === 4,
  'a compare failure degrades to a release-notes-only evidence pack',
])

let rateLimited = ''
try {
  await tool.execute({ repo: 'limited/lib', from: '1.0.0', to: '2.0.0' }, exec)
} catch (error) {
  rateLimited = error.message
}
checks.push([/rate limit is exhausted/.test(rateLimited), '403 with a zero remaining budget reports the reset time'])

let invalid = 0
for (const args of [{}, { repo: 'acme/lib', from: '', to: '1.0.0' }, { repo: 'acme/lib', from: '1.0.0', to: '1.0.0', maxCommits: 0 }]) {
  try { await tool.execute(args, exec) } catch { invalid++ }
}
checks.push([invalid === 3, 'invalid arguments are rejected'])

// --- I/O & Edge-Case Matrix rows -------------------------------------------

const stableTarget = await tool.execute({ repo: 'edge/lib', from: '17.0.0', to: '18.0.0' }, exec)
checks.push([
  stableTarget.releases === 1 &&
    stableTarget.markdown.includes('### v18.0.0 (') &&
    stableTarget.markdown.includes('### v18.0.0-rc.1') === false,
  'STABLE_TARGET: a stable target drops rc notes and keeps the stable release',
])

const preTarget = await tool.execute({ repo: 'edge/lib', from: '17.0.0', to: '18.0.0-rc.1' }, exec)
checks.push([
  preTarget.releases === 1 &&
    preTarget.markdown.includes('### v18.0.0-rc.1') &&
    preTarget.markdown.includes('### v18.0.0 (') === false,
  'PRE_TARGET: to=18.0.0-rc.1 keeps the rc and excludes the stable release',
])

const partialMajor = await tool.execute({ repo: 'edge/lib', from: '17.0.0', to: '18' }, exec)
checks.push([
  partialMajor.releases === 3 &&
    partialMajor.markdown.includes('### v18.2.0 (') &&
    partialMajor.markdown.includes('### v19.0.0 (') === false,
  'PARTIAL_MAJOR: to=18 includes 18.2.0 and excludes 19.0.0',
])

const partialMinor = await tool.execute({ repo: 'edge/lib', from: '17.0.0', to: '18.1' }, exec)
checks.push([
  partialMinor.releases === 2 &&
    partialMinor.markdown.includes('### v18.1.9 (') &&
    partialMinor.markdown.includes('### v18.2.0 (') === false,
  'PARTIAL_MINOR: to=18.1 includes 18.1.9 and excludes 18.2.0',
])

const capped = await tool.execute({ repo: 'cap/lib', from: '1.0.0', to: '25.0.0', maxReleases: 3 }, exec)
const capMarkdown = capped.markdown
const chronological =
  capMarkdown.indexOf('### v2.0.0 (') < capMarkdown.indexOf('### v24.0.0 (') &&
  capMarkdown.indexOf('### v24.0.0 (') < capMarkdown.indexOf('### v25.0.0 (')
checks.push([
  capped.releases === 25 &&
    capMarkdown.includes('### v25.0.0 (') &&
    capMarkdown.includes('### v2.0.0 (') &&
    capMarkdown.includes('### v24.0.0 (') &&
    capMarkdown.includes('### v1.0.0 (') === false &&
    chronological &&
    capMarkdown.includes('_22 more release note(s)'),
  'CAP_PRIORITY: target + old breaking note + newest ordinary note, chronological, 22 omitted',
])

const dated = await tool.execute({ repo: 'dated/lib', from: '17.0.0', to: '18.0.0' }, exec)
const datedHeading = dated.markdown.split('\n').find((line) => line.startsWith('### v18.0.0')) ?? ''
const dateAppearances = (datedHeading.match(/2024-04-01|April 1, 2024/gi) ?? []).length
checks.push([
  dated.releases === 1 && dateAppearances === 1 && datedHeading.includes('(2024-04-01)'),
  'DUPLICATE_DATE: a release name that carries its date is rendered once',
])

const exotic = await tool.execute({ repo: 'exotic/lib', from: 'release-2024-01', to: 'release-2024-06' }, exec)
checks.push([
  exotic.releases === 2 &&
    exotic.markdown.includes('### release-2024-01 (') &&
    exotic.markdown.includes('### release-2024-06 (') &&
    exotic.markdown.includes('### release-2023-12 (') === false &&
    exotic.markdown.includes('### release-2025-01 (') === false,
  'EXOTIC_TAGS: non-SemVer tags keep filtering and sorting through the string fallback',
])

for (const [ok, label] of checks) console.log(ok ? `PASS ${label}` : `FAIL ${label}`)
const failures = checks.filter(([ok]) => !ok)
if (failures.length > 0) process.exitCode = 1
server.close()
