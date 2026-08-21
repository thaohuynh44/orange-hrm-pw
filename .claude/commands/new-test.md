---
description: Add a test (and page object, if needed) following this repo's conventions, then prove it passes
argument-hint: <scenario, e.g. "filter leave list by status">
allowed-tools: Bash, Read, Write, Edit, Glob, Grep
---

Add coverage for: **$ARGUMENTS**

Follow `CLAUDE.md`. Work in this order — do not skip step 1.

1. **Check what exists.** Look for a page object in `src/pages/` and a component in
   `src/core/components/` that already covers this screen. Extend rather than duplicate.
2. **Confirm the locators against the live app** — run `/probe` for this screen if anything is
   uncertain. Do not invent `.oxd-*` classes.
3. **Page object, if the screen is new**: declare `path` (add the route to `src/config/env.ts`),
   implement `expectLoaded()`, reuse the OXD component wrappers, and register it as a fixture in
   `src/fixtures/test.fixture.ts`.
4. **Write the spec** under the matching `tests/<module>/` folder: import from
   `src/fixtures/test.fixture.ts`, tag it (`@write` if it creates data), assert on shape rather
   than the demo's current data, and make at least one `expect()` call in the test itself.
5. **Prove it.** Run the new test, then re-run it with `--retries=0 --repeat-each=3`. A test that
   only passes with retries is not finished.
6. `npm run verify`.

Report what you added, the run output, and anything you learned about the app that belongs in
`CLAUDE.md`'s quirks table.
