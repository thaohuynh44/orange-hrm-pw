---
description: Restructure the framework without changing what the tests prove, and prove that it didn't
argument-hint: <change, e.g. "extract a grid component from the list pages">
allowed-tools: Bash, Read, Write, Edit, Glob, Grep
---

Refactor: **$ARGUMENTS**

A test framework has no app-level safety net. The only evidence a refactor was safe is that the
same tests still exist and still pass — so capture that evidence **before** editing, not after.

1. **Baseline.** Record these numbers and keep them:

   ```bash
   npx playwright test --list | tail -1                        # total
   npx playwright test --list --grep-invert @write | tail -1   # read-only subset
   npm run test:readonly
   ```

   If the suite is not green now, stop and fix or report that first. Refactoring on top of a
   failure means you can never tell which change broke what.

2. **Map the blast radius before the first edit.** For every file, class or symbol you are about to
   move or rename, `grep` for its importers and list the specs downstream of it. State that list
   before touching anything — a surprise at step 5 is a rollback.

3. **Respect the layering** (`CLAUDE.md` Architecture): components own the `.oxd-*` selectors, page
   objects own `path` + `expectLoaded()` and navigation assertions, tasks compose page objects for
   journeys, specs own the assertion the test exists to make, and `src/api/` stays read-only. If the
   change needs a **new** layer, folder or cross-layer dependency, that is an architecture decision
   — run `/architect` and agree it before writing code.

4. **Move behaviour; do not improve it on the way.** Carry every wait across exactly as written —
   `withApiResponse`, `waitForSettled`, the `expect.poll` on XHR-filled inputs. If you spot a real
   improvement, note it and do it in a separate pass. Refactor plus fix in one commit means neither
   can be reviewed.

5. **Prove it.**
   - the two `--list` counts match the baseline exactly; account for every difference in words
   - `npm run test:readonly` green
   - `npm run verify`
   - `--retries=0 --repeat-each=3` on the specs that changed most
   - only if the change actually touches a write path, one targeted `@write` run — never a loop of
     them against the shared demo

6. **Update the docs you just invalidated** — `CLAUDE.md`'s Architecture section and quirks table,
   and the README's project layout. A structural change that leaves the docs describing the old
   shape is unfinished.

Reject, in your own work as readily as in a subagent's:

- deleting, skipping or `.fixme`-ing a test to make the refactor come out green
- a test count that drops without an explanation for every missing test
- an abstraction that swallows a wait, a tag, or an assertion
- renaming for taste alone across files nobody asked you to touch

Report: the baseline vs final counts, the files moved, what you deliberately left alone, and the
run results.
