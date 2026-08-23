/**
 * Renders a Playwright JSON report as a GitHub Actions step summary.
 *
 *   node scripts/ci-summary.mjs <report.json> [heading]
 *
 * Appends markdown to $GITHUB_STEP_SUMMARY, or writes it to stdout when that variable is
 * unset, so the same command is useful locally. It never fails the job: a missing or
 * unparseable report degrades to a one-line notice rather than turning a reporting problem
 * into a second failure on top of the test result that actually matters.
 */
import { appendFileSync, readFileSync } from 'node:fs';
import process from 'node:process';

const [reportPath, heading = 'Test results'] = process.argv.slice(2);

/** Failures and flakes are listed by name; everything else is only ever a count. */
const MAX_LISTED = 20;

function emit(markdown) {
  const target = process.env.GITHUB_STEP_SUMMARY;
  if (target) appendFileSync(target, `${markdown}\n`);
  else process.stdout.write(`${markdown}\n`);
}

/** Table cells are pipe-delimited, so any pipe in a title or error message has to be escaped. */
function cell(text) {
  return String(text ?? '').replace(/\|/g, '\\|');
}

/** Playwright errors carry ANSI colour and a full diff; a summary row wants the first line. */
function firstLine(message) {
  // eslint-disable-next-line no-control-regex -- stripping ANSI needs the escape character
  const plain = String(message).replace(/\u001B\[[0-9;]*m/g, '');
  const line = plain.split('\n').find((candidate) => candidate.trim().length > 0);
  return (line ?? '').trim().slice(0, 160);
}

function humanDuration(ms) {
  const seconds = Math.round((Number(ms) || 0) / 1000);
  const minutes = Math.floor(seconds / 60);
  return minutes > 0 ? `${minutes}m ${seconds % 60}s` : `${seconds}s`;
}

function firstError(test) {
  for (const result of test.results ?? []) {
    const message = result.error?.message ?? result.errors?.[0]?.message;
    if (message) return firstLine(message);
  }
  return '';
}

/**
 * Flattens the report's suite tree into one row per test. Playwright nests `describe` suites
 * inside a file-level suite, so titles are accumulated on the way down - and the outermost
 * title is dropped, since it only repeats the `file` field reported alongside it.
 */
function collectTests(suites, trail = [], depth = 0) {
  const collected = [];
  for (const suite of suites ?? []) {
    const nested = depth === 0 ? trail : [...trail, suite.title];
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        collected.push({
          title: [...nested, spec.title].join(' › '),
          location: `${spec.file}:${spec.line}`,
          project: test.projectName || '-',
          status: test.status,
          retries: Math.max((test.results?.length ?? 1) - 1, 0),
          error: firstError(test),
        });
      }
    }
    collected.push(...collectTests(suite.suites, nested, depth + 1));
  }
  return collected;
}

function table(header, rows) {
  return [
    `| ${header.join(' | ')} |`,
    `| ${header.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.map(cell).join(' | ')} |`),
  ].join('\n');
}

/** Lists at most MAX_LISTED rows, and says so when it drops any - a silent cap reads as "all". */
function listed(tests, header, toRow) {
  const rows = tests.slice(0, MAX_LISTED).map(toRow);
  const dropped = tests.length - rows.length;
  const note = dropped > 0 ? `\n\n_${dropped} more not listed - see the HTML report._` : '';
  return `${table(header, rows)}${note}`;
}

let report;
try {
  report = JSON.parse(readFileSync(reportPath, 'utf8'));
} catch (error) {
  emit(`## ${heading}\n\n> No usable report at \`${reportPath}\` - ${error.message}`);
  process.exit(0);
}

const stats = report.stats ?? {};
const tests = collectTests(report.suites);
const counts = {
  passed: stats.expected ?? tests.filter((test) => test.status === 'expected').length,
  failed: stats.unexpected ?? tests.filter((test) => test.status === 'unexpected').length,
  flaky: stats.flaky ?? tests.filter((test) => test.status === 'flaky').length,
  skipped: stats.skipped ?? tests.filter((test) => test.status === 'skipped').length,
};
const total = counts.passed + counts.failed + counts.flaky + counts.skipped;
const verdict = counts.failed > 0 ? 'Failed' : counts.flaky > 0 ? 'Flaky' : 'Passed';

const sections = [
  `## ${heading} - ${verdict}`,
  table(
    ['Result', 'Count'],
    [
      ['Passed', counts.passed],
      ['Failed', counts.failed],
      ['Flaky', counts.flaky],
      ['Skipped', counts.skipped],
      ['**Total**', `**${total}**`],
    ],
  ),
  `Wall clock: **${humanDuration(stats.duration)}**`,
];

const failed = tests.filter((test) => test.status === 'unexpected');
if (failed.length > 0) {
  sections.push(
    `### Failed (${failed.length})`,
    listed(failed, ['Test', 'Project', 'Where', 'Error'], (test) => [
      test.title,
      test.project,
      test.location,
      test.error,
    ]),
  );
}

const flaky = tests.filter((test) => test.status === 'flaky');
if (flaky.length > 0) {
  sections.push(
    `### Flaky (${flaky.length})`,
    'Passed on retry. The demo is shared and slow, so treat a repeat offender as a real defect.',
    listed(flaky, ['Test', 'Project', 'Retries', 'First failure'], (test) => [
      test.title,
      test.project,
      test.retries,
      test.error,
    ]),
  );
}

// Worker crashes and config errors never reach a testcase, so they would otherwise vanish.
if (report.errors?.length > 0) {
  sections.push(
    `### Run errors (${report.errors.length})`,
    report.errors
      .slice(0, MAX_LISTED)
      .map((error) => `- ${firstLine(error.message ?? error)}`)
      .join('\n'),
  );
}

emit(sections.join('\n\n'));
