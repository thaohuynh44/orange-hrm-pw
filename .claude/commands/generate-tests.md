---
description: Generate tests from a saved plan with the Playwright generator agent, then rewrite them into repo conventions
argument-hint: <plan file, optionally a bullet — e.g. "specs/leave.plan.md 1.2">
allowed-tools: Task, Bash, Read, Write, Edit, Glob, Grep
---

Generate tests for: **$ARGUMENTS**

1. Read the plan file. If no specific bullet was named, work through its cases **one at a time, not
   in parallel** — the generator drives a single real browser.

2. For each case, invoke the `playwright-test-generator` subagent with:

   <generate>
     <test-suite><!-- suite name from the plan, without the ordinal --></test-suite>
     <test-name><!-- case name, without the ordinal --></test-name>
     <test-file>tests/<module>/<fs-friendly-name>.spec.ts</test-file>
     <seed-file>tests/seed.spec.ts</seed-file>
     <body><!-- steps and expectations from the plan --></body>
   </generate>

3. **Then rewrite what it produced into this repo's conventions** (see `CLAUDE.md`) — the generator
   emits raw `@playwright/test` scripts with inline selectors, which is not what we commit:
   - import `test`/`expect` from `src/fixtures/test.fixture.ts`
   - move every selector into a page object under `src/pages/`, reusing the OXD component wrappers;
     add and register a new page object if the screen has none
   - routes from `src/config/env.ts`; no `waitForTimeout`; API-aware waits for grids
   - tag the test, `@write` included if it creates data

4. Run each new test, then `--retries=0 --repeat-each=3`, then `npm run verify`.

Report the files added, what you rewrote, and the run results.
