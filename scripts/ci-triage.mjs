/**
 * Collects everything needed to triage a failed GitHub Actions run into one local bundle.
 *
 *   node scripts/ci-triage.mjs [run-id] [--pr N] [--branch NAME] [--event NAME]
 *                              [--from DIR] [--limit N] [--out DIR] [--quiet]
 *
 * With no run id it takes the most recent failed run of the E2E Tests workflow. It resolves the
 * run, downloads its artifacts, reconstructs one structured failure list across every job family
 * (sharded blobs for the read-only features path, raw `test-results/` for `@write` and `@flow`),
 * pairs each failure with its trace, screenshot and `error-context.md`, and writes
 * `triage-bundle.json` plus a `triage-digest.md` next to it.
 *
 * It classifies nothing. The digest carries a deterministic *hint* per failure - the pattern the
 * error text matches - and the reasoning is left to `/triage-ci`, which reads the bundle. A hint
 * is a starting point, not a verdict: a timeout is only a race until the trace says otherwise.
 *
 * Requires the GitHub CLI (`gh`), authenticated against this repo - except with `--from DIR`,
 * which parses artifacts you already have on disk and talks to nothing.
 */
import { execFileSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, join, relative, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import process from 'node:process';

const WORKFLOW = 'playwright.yml';

/** Failures are listed in full in the JSON; the markdown digest stays readable. */
const MAX_LISTED = 25;

/** An `error-context.md` is a page snapshot, so it is long. This is enough to see the state. */
const MAX_CONTEXT_CHARS = 4000;

/** Enough of an error to diagnose it. The whole of every attempt is in the JSON bundle. */
const MAX_ERROR_CHARS = 2000;

/**
 * Error-text patterns worth naming, mapped onto the four classifications `/triage` uses. Order
 * matters: the first match wins, so the specific patterns come before the generic timeout.
 */
const HINTS = [
  {
    pattern: /net::ERR_|ERR_HTTP_RESPONSE_CODE_FAILURE|ECONNREFUSED|ERR_CONNECTION/,
    hint: 'navigation refused by the server - candidate app defect or demo outage, not a locator',
  },
  {
    pattern: /storageState|\.auth[/\\]admin\.json|\/auth\/login|browserContext\.newPage/,
    hint: 'stored session - the `setup` project or the ESS provisioning, not the spec under test',
  },
  {
    pattern: /apiResponse|waitForResponse|Timeout.*waiting for response|\/api\/v2\//,
    hint: 'awaited REST call never arrived - check the verb and url part passed to apiResponse()',
  },
  {
    pattern: /strict mode violation|resolved to \d+ elements/,
    hint: 'locator matches more than one node - the app re-rendered or the selector is too loose',
  },
  {
    pattern: /waiting for locator|element\(s\) not found|to be visible|toBeVisible/,
    hint: 'element never appeared - race against a late Vue mount or XHR fill, or a wrong locator',
  },
  {
    pattern: /Received:\s*\d+|toHaveCount|toBeGreaterThan|Record[s]? Found|No Records Found/,
    hint: 'assertion pinned to demo data that has since changed - assert shape, not the value',
  },
  {
    pattern: /Expected substring|Expected pattern|toHaveText|toContainText/,
    hint: 'expected string does not match the app - verify the real copy with /probe before editing',
  },
  {
    pattern: /Test timeout of \d+ms exceeded|Timeout/,
    hint: 'timed out - read the trace before calling it slow',
  },
  {
    pattern: /Target (page|frame|context), context or browser has been closed/,
    hint: 'context died mid-test - a crash or a fixture teardown racing the test body',
  },
];

/** A fallback that does not say why it fell back reads as "there was nothing to find". */
function warn(message) {
  process.stderr.write(`ci-triage: ${message}\n`);
}

function fail(message) {
  process.stderr.write(`ci-triage: ${message}\n`);
  process.exit(1);
}

function sh(command, args, options = {}) {
  return execFileSync(command, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...options });
}

function parseArgs(argv) {
  const options = { limit: 30, quiet: false };
  const rest = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      const value = argv[index + 1];
      if (value === undefined) fail(`${arg} needs a value`);
      index += 1;
      return value;
    };
    if (arg === '--pr') options.pr = next();
    else if (arg === '--branch') options.branch = next();
    else if (arg === '--event') options.event = next();
    else if (arg === '--limit') options.limit = Number(next());
    else if (arg === '--out') options.out = resolve(next());
    else if (arg === '--from') options.from = resolve(next());
    else if (arg === '--quiet') options.quiet = true;
    else if (arg.startsWith('-')) fail(`unknown option ${arg}`);
    else rest.push(arg);
  }
  if (rest.length > 1) fail(`expected at most one run id, got ${rest.join(', ')}`);
  if (rest[0]) options.runId = rest[0];
  return options;
}

function requireGh() {
  try {
    sh('gh', ['--version'], { stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    fail('the GitHub CLI is not installed. `brew install gh`, then `gh auth login`.');
  }
  try {
    sh('gh', ['auth', 'status'], { stdio: ['ignore', 'pipe', 'pipe'] });
  } catch {
    fail('the GitHub CLI is not authenticated. Run `gh auth login`.');
  }
}

/**
 * Finds the run to triage. An explicit id wins; otherwise the most recent failed run, narrowed
 * by branch or event when asked. `--pr` is resolved to its head branch, since a PR's runs are
 * listed against the branch rather than the number.
 */
function resolveRun(options) {
  const fields =
    'databaseId,displayTitle,workflowName,headBranch,headSha,event,conclusion,status,createdAt,url,attempt';
  if (options.runId) {
    const view = JSON.parse(sh('gh', ['run', 'view', options.runId, '--json', fields]));
    return view;
  }
  let branch = options.branch;
  if (options.pr) {
    const pr = JSON.parse(sh('gh', ['pr', 'view', options.pr, '--json', 'headRefName,number,url']));
    branch = pr.headRefName;
  }
  const args = [
    'run',
    'list',
    '--workflow',
    WORKFLOW,
    '--json',
    fields,
    '--limit',
    String(options.limit),
  ];
  if (branch) args.push('--branch', branch);
  if (options.event) args.push('--event', options.event);
  const runs = JSON.parse(sh('gh', args));
  const failed = runs.filter(
    (run) => run.conclusion === 'failure' || run.conclusion === 'timed_out',
  );
  if (failed.length === 0) {
    const scope = [branch && `branch ${branch}`, options.event && `event ${options.event}`]
      .filter(Boolean)
      .join(', ');
    fail(
      `no failed run of ${WORKFLOW} in the last ${options.limit}${scope ? ` (${scope})` : ''}. Nothing to triage.`,
    );
  }
  return failed[0];
}

function jobsFor(runId) {
  const view = JSON.parse(sh('gh', ['run', 'view', String(runId), '--json', 'jobs']));
  return (view.jobs ?? []).map((job) => ({
    name: job.name,
    conclusion: job.conclusion,
    url: job.url,
    failedSteps: (job.steps ?? [])
      .filter((step) => step.conclusion === 'failure')
      .map((step) => step.name),
  }));
}

function download(runId, dir) {
  mkdirSync(dir, { recursive: true });
  try {
    sh('gh', ['run', 'download', String(runId), '--dir', dir], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    const message = String(error.stderr ?? error.message ?? '');
    if (/no artifacts|no valid artifacts/i.test(message)) {
      return {
        artifacts: [],
        note: 'the run uploaded no artifacts - it failed before the tests ran',
      };
    }
    fail(`could not download artifacts: ${message.trim() || error.message}`);
  }
  return {
    artifacts: readdirSync(dir).filter((entry) => statSync(join(dir, entry)).isDirectory()),
  };
}

function walk(dir, collected = []) {
  if (!existsSync(dir)) return collected;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, collected);
    else collected.push(path);
  }
  return collected;
}

// eslint-disable-next-line no-control-regex -- stripping ANSI needs the escape character
const stripAnsi = (text) => String(text ?? '').replace(/\u001B\[[0-9;]*m/g, '');

function firstLine(message) {
  const line = stripAnsi(message)
    .split('\n')
    .find((candidate) => candidate.trim().length > 0);
  return (line ?? '').trim();
}

function hintFor(text) {
  const plain = stripAnsi(text);
  return HINTS.find((candidate) => candidate.pattern.test(plain))?.hint ?? '';
}

/**
 * Flattens a Playwright JSON report into one row per test, keeping the fields triage needs.
 * Mirrors `collectTests` in ci-summary.mjs - same nesting, same dropped outermost title - but
 * keeps the whole error and the attachment list rather than a one-line summary.
 */
function collectTests(suites, trail = [], depth = 0) {
  const collected = [];
  for (const suite of suites ?? []) {
    const nested = depth === 0 ? trail : [...trail, suite.title];
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        const results = test.results ?? [];
        const last = results[results.length - 1] ?? {};
        const errors = results.flatMap((result) =>
          [result.error, ...(result.errors ?? [])].filter(Boolean).map((error) => ({
            message: stripAnsi(error.message ?? String(error)),
            location: error.location ? `${error.location.file}:${error.location.line}` : '',
          })),
        );
        collected.push({
          title: [...nested, spec.title].join(' › '),
          location: `${spec.file}:${spec.line}`,
          project: test.projectName || '-',
          status: test.status,
          annotations: (test.annotations ?? []).map((annotation) => annotation.type),
          retries: Math.max(results.length - 1, 0),
          durationMs: last.duration ?? 0,
          errors,
          attachments: results.flatMap((result) =>
            (result.attachments ?? []).map((attachment) => ({
              name: attachment.name,
              contentType: attachment.contentType,
              path: attachment.path ?? '',
            })),
          ),
        });
      }
    }
    collected.push(...collectTests(suite.suites, nested, depth + 1));
  }
  return collected;
}

/** Merges the shard blobs into a single JSON report. This is the only source for the PR path. */
function mergeBlobs(downloadDir, workDir) {
  const shards = readdirSync(downloadDir).filter((entry) => entry.startsWith('blob-report-'));
  if (shards.length === 0) {
    warn('no blob-report-* artifact in the run - the sharded features job never uploaded one');
    return null;
  }
  const merged = join(workDir, 'blobs');
  mkdirSync(merged, { recursive: true });
  for (const shard of shards) {
    for (const file of walk(join(downloadDir, shard))) {
      cpSync(file, join(merged, `${shard}-${basename(file)}`));
    }
  }
  // A merged report for this suite is around half a megabyte, and the json reporter exits without
  // waiting for a pipe that size to drain - captured stdout arrives truncated. So it is pointed at
  // a file, which is also the reason for no --config: the configured json reporter has an
  // outputFile of its own, and this needs the path to be one we can read back.
  const mergedJson = join(workDir, 'merged-report.json');
  try {
    sh('npx', ['playwright', 'merge-reports', '--reporter', 'json', merged], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_NAME: mergedJson },
    });
  } catch (error) {
    warn(
      `merge-reports failed, falling back to JUnit - ${firstLine(error.stderr ?? error.message)}`,
    );
    return null;
  }
  if (!existsSync(mergedJson)) {
    warn('merge-reports wrote no JSON report, falling back to JUnit');
    return null;
  }
  try {
    return { report: JSON.parse(readFileSync(mergedJson, 'utf8')), shards: shards.length };
  } catch (error) {
    warn(`the merged report is unparseable, falling back to JUnit - ${error.message}`);
    return null;
  }
}

/** `@write` and `@flow` upload the raw `test-results/`, which already holds a JSON report. */
function reportsFromArtifacts(downloadDir) {
  const found = [];
  for (const entry of readdirSync(downloadDir)) {
    const path = join(downloadDir, entry, 'report.json');
    if (!existsSync(path)) continue;
    try {
      found.push({ suite: entry, report: JSON.parse(readFileSync(path, 'utf8')) });
    } catch {
      // A truncated report is worth naming but not worth dying over.
      process.stderr.write(`ci-triage: ${entry}/report.json is unreadable, skipping it\n`);
    }
  }
  return found;
}

/**
 * Last resort. JUnit carries the failure message but no attachments, so a JUnit-only bundle can
 * say what failed and not show the page state - which is worth flagging rather than papering over.
 */
const decodeXml = (text) =>
  String(text ?? '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, '&');

function collectFromJUnit(downloadDir) {
  const collected = [];
  for (const entry of readdirSync(downloadDir)) {
    const path = join(downloadDir, entry, 'junit.xml');
    if (!existsSync(path)) continue;
    const xml = readFileSync(path, 'utf8');
    const cases = xml.match(/<testcase\b[\s\S]*?(?:\/>|<\/testcase>)/g) ?? [];
    for (const testcase of cases) {
      const failure = testcase.match(/<(failure|error)\b([^>]*)>([\s\S]*?)<\/\1>/);
      if (!failure) continue;
      const attribute = (name) => testcase.match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? '';
      collected.push({
        title: decodeXml(attribute('name')),
        location: decodeXml(attribute('file')),
        project: attribute('classname'),
        status: 'unexpected',
        annotations: [],
        retries: 0,
        durationMs: Math.round(Number(attribute('time')) * 1000) || 0,
        errors: [{ message: decodeXml(stripAnsi(failure[3])).trim(), location: '' }],
        attachments: [],
        source: `${entry}/junit.xml`,
      });
    }
  }
  return collected;
}

/**
 * Paths are shown relative to the repo when that is shorter and clickable, and absolute when the
 * bundle lives outside it - a wall of `../../..` is neither.
 */
function displayPath(path) {
  const nearby = relative(process.cwd(), path);
  return nearby && !nearby.startsWith('..') ? nearby : path;
}

/**
 * Attachment paths come in two shapes. `merge-reports` extracts the shard blobs and rewrites them
 * to local absolute paths, which already point at a real file. A raw `test-results/` upload keeps
 * the runner's own absolute paths, which do not exist here and are matched back into the
 * downloaded tree by their tail (`<output-dir>/<file>`) and then by filename. Everything that
 * resolves is read or pointed at; what does not is still listed by name, since knowing a trace was
 * recorded and never uploaded is itself a finding.
 */
function evidenceIndex(roots) {
  const byTail = new Map();
  const byName = new Map();
  for (const root of new Set(roots)) {
    for (const file of walk(root)) {
      const parts = file.split(sep);
      const tail = parts.slice(-2).join('/');
      if (!byTail.has(tail)) byTail.set(tail, file);
      const name = parts[parts.length - 1];
      if (!byName.has(name)) byName.set(name, []);
      byName.get(name).push(file);
    }
  }
  return { byTail, byName };
}

function resolveEvidence(test, index, downloadDir) {
  const resolved = [];
  for (const attachment of test.attachments) {
    const parts = String(attachment.path).split(/[/\\]/);
    const tail = parts.slice(-2).join('/');
    const local = existsSync(attachment.path)
      ? attachment.path
      : (index.byTail.get(tail) ?? (index.byName.get(parts[parts.length - 1]) ?? [])[0] ?? null);
    resolved.push({
      name: attachment.name,
      contentType: attachment.contentType,
      localPath: local ? displayPath(local) : null,
      uploaded: Boolean(local),
    });
  }
  const context = resolved.find(
    (item) => item.name === 'error-context' || /error-context\.md$/.test(item.localPath ?? ''),
  );
  let pageState = '';
  if (context?.localPath) {
    const text = readFileSync(resolve(process.cwd(), context.localPath), 'utf8');
    pageState =
      text.length > MAX_CONTEXT_CHARS ? `${text.slice(0, MAX_CONTEXT_CHARS)}\n… truncated` : text;
  }
  return { attachments: resolved, pageState, downloadDir: displayPath(downloadDir) };
}

const options = parseArgs(process.argv.slice(2));

/**
 * `--from` reads a directory of already-downloaded artifacts instead of fetching one, which is
 * both the offline path (no `gh`, an artifact zip pulled by hand from the run page) and how the
 * parsing is exercised without a red run to point at.
 */
const offline = Boolean(options.from);
if (!offline) requireGh();

const run = offline
  ? { databaseId: `local:${basename(options.from)}`, event: 'local', headBranch: '-', headSha: '-' }
  : resolveRun(options);
const runId = run.databaseId ?? options.runId;
const outDir =
  options.out ?? mkdtempSync(join(tmpdir(), `ci-triage-${String(runId).replace(/\W+/g, '-')}-`));
const downloadDir = offline ? options.from : join(outDir, 'artifacts');
mkdirSync(outDir, { recursive: true });

const log = (message) => {
  if (!options.quiet) process.stderr.write(`${message}\n`);
};

let jobs = [];
let failedJobs = [];
let note = null;

if (offline) {
  if (!existsSync(downloadDir)) fail(`no such directory: ${options.from}`);
  log(`Reading artifacts from ${displayPath(downloadDir)}`);
} else {
  log(
    `Run ${runId} · ${run.workflowName ?? 'E2E Tests'} · ${run.event} · ${run.headBranch} · ${String(run.headSha).slice(0, 7)}`,
  );
  log(`  ${run.url}`);

  jobs = jobsFor(runId);
  failedJobs = jobs.filter((job) => job.conclusion === 'failure');
  log(
    `Failed jobs: ${failedJobs.length > 0 ? failedJobs.map((job) => job.name).join(', ') : 'none - the run failed outside a job'}`,
  );

  log('Downloading artifacts…');
  const downloaded = download(runId, downloadDir);
  note = downloaded.note ?? null;
  log(
    `  ${downloaded.artifacts.length} artifact${downloaded.artifacts.length === 1 ? '' : 's'}: ${downloaded.artifacts.join(', ') || '(none)'}`,
  );
}

const sources = [];
let tests = [];

const blobs = mergeBlobs(downloadDir, outDir);
if (blobs) {
  sources.push(
    `${blobs.shards} shard blob report${blobs.shards === 1 ? '' : 's'} (features, read-only)`,
  );
  tests.push(...collectTests(blobs.report.suites).map((test) => ({ ...test, suite: 'features' })));
}
for (const { suite, report } of reportsFromArtifacts(downloadDir)) {
  sources.push(`${suite}/report.json`);
  tests.push(...collectTests(report.suites).map((test) => ({ ...test, suite })));
}
if (tests.length === 0) {
  const fromJUnit = collectFromJUnit(downloadDir);
  if (fromJUnit.length > 0) {
    sources.push('JUnit XML only - no attachments, so no trace or page state for these failures');
    tests.push(...fromJUnit.map((test) => ({ ...test, suite: test.source })));
  }
}

const index = evidenceIndex([downloadDir, outDir]);
const interesting = tests
  .filter((test) => test.status === 'unexpected' || test.status === 'flaky')
  .map((test) => {
    const message = test.errors.map((error) => error.message).join('\n');
    return {
      ...test,
      firstError: firstLine(message),
      hint: hintFor(message),
      evidence: resolveEvidence(test, index, downloadDir),
    };
  })
  .sort((a, b) => (a.status === b.status ? 0 : a.status === 'unexpected' ? -1 : 1));

const failures = interesting.filter((test) => test.status === 'unexpected');
const flakes = interesting.filter((test) => test.status === 'flaky');

const bundle = {
  run: {
    id: runId,
    url: run.url,
    title: run.displayTitle,
    event: run.event,
    branch: run.headBranch,
    sha: run.headSha,
    attempt: run.attempt,
    createdAt: run.createdAt,
    conclusion: run.conclusion,
  },
  jobs,
  sources,
  note: note ?? null,
  counts: { failed: failures.length, flaky: flakes.length, collected: tests.length },
  failures,
  flakes,
  paths: {
    bundleDir: displayPath(outDir),
    artifacts: displayPath(downloadDir),
  },
};

const bundlePath = join(outDir, 'triage-bundle.json');
writeFileSync(bundlePath, `${JSON.stringify(bundle, null, 2)}\n`);

const section = (test, ordinal) => {
  const lines = [
    `### ${ordinal}. ${test.title}`,
    '',
    `- **Suite** \`${test.suite}\` · **Project** \`${test.project}\` · **Where** \`${test.location}\``,
    `- **Status** ${test.status}${test.retries > 0 ? ` after ${test.retries} retr${test.retries === 1 ? 'y' : 'ies'}` : ''}` +
      `${test.annotations.length > 0 ? ` · **Tags** ${test.annotations.join(' ')}` : ''}`,
  ];
  if (test.hint) lines.push(`- **Pattern** ${test.hint}`);
  // CI retries twice, and a session that is gone fails identically all three times. Repeating
  // that verbatim buries the one attempt that differs, so identical attempts collapse to one.
  const distinct = [...new Set(test.errors.map((error) => error.message.trim()).filter(Boolean))];
  const joined = distinct.join('\n\n');
  const errorText =
    joined.length > MAX_ERROR_CHARS ? `${joined.slice(0, MAX_ERROR_CHARS)}\n… truncated` : joined;
  lines.push('', '```', errorText || '(no error message)', '```');
  if (test.errors.length > distinct.length) {
    lines.push(
      '',
      `_All ${test.errors.length} attempts failed the same way; ${test.errors.length - distinct.length} identical repeat(s) omitted._`,
    );
  }
  const uploaded = test.evidence.attachments.filter((item) => item.uploaded);
  const missing = test.evidence.attachments.filter((item) => !item.uploaded);
  if (uploaded.length > 0) {
    lines.push(
      '',
      'Evidence:',
      ...uploaded.map((item) => `- \`${item.localPath}\` (${item.name})`),
    );
  }
  if (missing.length > 0) {
    lines.push('', `Recorded but not uploaded: ${missing.map((item) => item.name).join(', ')}`);
  }
  if (test.evidence.pageState) {
    lines.push(
      '',
      '<details><summary>Page state at failure</summary>',
      '',
      test.evidence.pageState,
      '',
      '</details>',
    );
  }
  return lines.join('\n');
};

const digest = [
  `# CI triage bundle - run ${runId}`,
  '',
  ...(run.displayTitle ? [`${run.displayTitle}`.trim(), ''] : []),
  offline
    ? `- Read from disk, not fetched: \`${displayPath(downloadDir)}\``
    : `- Run: ${run.url} (attempt ${run.attempt ?? 1}, ${run.event}, \`${run.headBranch}\` @ \`${String(run.headSha).slice(0, 7)}\`)`,
  ...(offline
    ? []
    : [
        `- Failed jobs: ${failedJobs.length > 0 ? failedJobs.map((job) => `${job.name}${job.failedSteps.length > 0 ? ` (${job.failedSteps.join('; ')})` : ''}`).join(', ') : 'none'}`,
        `- Artifacts: \`${displayPath(downloadDir)}\``,
      ]),
  `- Report sources: ${sources.join(', ') || 'none'}`,
  `- ${failures.length} failed, ${flakes.length} flaky, ${tests.length} tests collected`,
];
if (note) digest.push(`- Note: ${note}`);
if (failures.length === 0 && flakes.length === 0) {
  digest.push(
    '',
    'No failed or flaky test in the reports. The run went red outside the tests - read the failed',
    "job's log (`gh run view " + runId + ' --log-failed`) rather than the suite.',
  );
}
if (failures.length > 0) {
  digest.push('', `## Failed (${failures.length})`, '');
  digest.push(
    ...failures.slice(0, MAX_LISTED).map((test, position) => section(test, position + 1)),
  );
  if (failures.length > MAX_LISTED)
    digest.push('', `_${failures.length - MAX_LISTED} more in triage-bundle.json._`);
}
if (flakes.length > 0) {
  digest.push(
    '',
    `## Flaky (${flakes.length})`,
    '',
    'Passed on retry. A repeat offender is a defect, not the demo.',
    '',
  );
  digest.push(...flakes.slice(0, MAX_LISTED).map((test, position) => section(test, position + 1)));
}

const digestPath = join(outDir, 'triage-digest.md');
writeFileSync(digestPath, `${digest.join('\n')}\n`);

log('');
log(`Bundle:  ${displayPath(bundlePath)}`);
log(`Digest:  ${displayPath(digestPath)}`);
process.stdout.write(`${digestPath}\n`);
