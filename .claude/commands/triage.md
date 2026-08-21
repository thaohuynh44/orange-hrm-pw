---
description: Diagnose failing tests and decide app bug vs test bug before changing anything
argument-hint: [test name or file — defaults to the whole suite]
allowed-tools: Bash, Read, Write, Edit, Glob, Grep
---

Triage failures in: **${ARGUMENTS:-the full suite}**

1. Reproduce with `--retries=0` so retries cannot mask the failure, and read the actual error —
   not just the summary. `npx playwright show-trace test-results/<dir>/trace.zip` and the
   `error-context.md` beside it carry the page state at the moment of failure.
2. **Classify before editing.** For each failure, say which it is:
   - **Test bug** — wrong locator, wrong expected string, wrong assumption about app behaviour.
   - **Race** — the assertion outran a re-render or an XHR. Fix by awaiting the real signal
     (`withApiResponse`, `waitForSettled`, an assertion with a longer timeout), never by adding a
     sleep.
   - **Shared-demo data** — the assertion depended on data that changed. Loosen it to assert
     shape, not the specific value.
   - **Real app defect** — report it, do not weaken the assertion to make it pass.
3. Verify the app's actual behaviour before rewriting an expectation (`/probe`). Correct the test
   to match reality; do not delete the assertion or widen it into meaninglessness.
4. Re-run the affected tests with `--retries=0 --repeat-each=3`, then `npm run verify`.

Report each failure, its classification, the fix, and any assertion you deliberately left failing
because it looks like a genuine app defect.
