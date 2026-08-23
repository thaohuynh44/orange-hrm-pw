---
description: Triage a failed GitHub Actions run — fetch its artifacts, classify each failure, report back on the run
argument-hint: '[run id | --pr N | --branch NAME | --event schedule] [--no-post]'
allowed-tools: Bash, Read, Write, Edit, Glob, Grep
---

Triage the failed CI run: **${ARGUMENTS:-the most recent failed run}**

This is `/triage` for a failure you did not watch happen. The evidence is on a runner that no
longer exists, so it is fetched first and reasoned about second — and the reasoning is the part
that is yours, not the script's.

## 1. Fetch the bundle

```bash
node scripts/ci-triage.mjs ${ARGUMENTS:-}
```

It resolves the run, downloads every artifact, merges the shard blob reports, and writes
`triage-bundle.json` (all failures, machine-readable) and `triage-digest.md` (the readable digest,
whose path it prints on stdout). Read the digest first, then the bundle for anything the digest
truncated.

If it reports **no failed or flaky test**, the run went red outside the suite — `npm ci`, the
browser install, the merge job, the Pages deploy. Read that job's log instead
(`gh run view <id> --log-failed`) and classify it as **CI infrastructure**; do not go looking for a
test to blame.

## 2. Classify before touching anything

For each failure, decide which of these it is, and say why in one sentence citing the evidence you
read — the error, the page state, the trace, not the digest's `Pattern` line. That line is a
keyword match and it is wrong often enough to be worth contradicting.

- **Test bug** — wrong locator, wrong expected string, wrong assumption about app behaviour.
- **Race** — the assertion outran a re-render or an XHR. The fix is awaiting the real signal
  (`withApiResponse`, `waitForSettled`, `apiResponse(urlPart, verb)`), never a sleep.
- **Shared-demo data** — the assertion depended on data that has since changed. Loosen it to
  assert shape.
- **Real app defect** — report it; do not weaken the assertion to make it pass.
- **CI infrastructure** — the runner, the network, the artifact plumbing, the concurrency group.
  Nothing to fix in `tests/` or `src/`.

Evidence worth opening, in this order:

1. The `error-context.md` the digest inlines — it is the page state at the moment of failure.
2. The screenshot beside it (`Evidence:` paths in the digest are local files, so read them).
3. The HTML report, for the trace and the network log:
   `npx playwright show-report <bundle>/artifacts/playwright-report-<suite>`.

Two CI-only distinctions that do not exist locally:

- **Which suite failed says a lot.** A `features` shard failure is on the read-only PR path, so it
  cannot be data this run created. A `@write` or `@flow` failure can be — and a journey that dies
  mid-way leaves its employee behind, which is worth naming.
- **Retries hide races.** CI runs with `RETRIES=2`, so anything under `## Flaky` failed and then
  passed. Treat a flake that appears in consecutive runs as a race with a real missing wait, not as
  the demo being slow.

## 3. Confirm locally before you believe it

A shared public demo fails for reasons that are gone by the time you look. Reproduce the specific
test with retries off before editing it:

```bash
npx playwright test -g "<test title>" --retries=0 --repeat-each=3
```

Green locally three times over, with the CI error being a timeout or a data assertion, is evidence
for **shared-demo** or **infrastructure** — not licence to close it. Red locally is the good case:
now fix it at its source, in the page object or component, so every test on that screen benefits.

## 4. Report back

**In the terminal**, one block per failure: test, suite and project, classification, the evidence
that decided it, the fix (or the reason you are leaving it alone). Name anything you could not
decide, and what would decide it.

**On the run itself**, unless `--no-post` was passed. A completed run's step summary cannot be
appended to from outside the run, so the report goes on the run's conversation instead:

- The run came from a pull request → comment on it:
  `gh pr comment <number> --body-file <file>`
- Push or nightly on `main` (no PR) → comment on the commit:
  `gh api repos/{owner}/{repo}/commits/<sha>/comments -f body=@<file>`

Lead the comment with `<!-- ci-triage: run <id> -->` so a re-triage of the same run can be found
and edited (`gh pr comment --edit-last`) rather than stacked. Keep it to the table plus one
paragraph per failure — link the run, do not paste traces into it.

## 5. Then act, or hand it back

Fix what is a test bug or a race, following the repo's conventions, and prove it:
`--retries=0 --repeat-each=3`, then `npm run verify`. Open a `fix/` or `flake/` branch for it —
never commit the fix onto the branch whose run you just triaged if that branch has already merged.

Leave a real app defect failing, and say so plainly in both the terminal and the comment. A red
assertion that documents a genuine defect is the suite doing its job.
