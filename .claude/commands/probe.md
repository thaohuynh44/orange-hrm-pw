---
description: Probe the live OrangeHRM demo for real selectors, texts and API calls before writing a test
argument-hint: <page or feature, e.g. "Leave list filters">
allowed-tools: Bash, Read, Write, Edit, Glob, Grep
---

Ground truth beats guessing. Before any locator is written for **$ARGUMENTS**, find out what the
app actually renders.

1. Write a throwaway probe script to `probe.mjs` **in the project root** (module resolution needs
   the local `node_modules`; delete it when done). Reuse the stored session so you skip the login:

   ```js
   import { chromium } from '@playwright/test';
   const BASE = 'https://opensource-demo.orangehrmlive.com/web/index.php';
   const b = await chromium.launch();
   const ctx = await b.newContext({ storageState: '.auth/admin.json' });
   const p = await ctx.newPage();
   p.setDefaultTimeout(45000);
   p.on('response', (r) => {
     if (r.url().includes('/api/')) console.log(r.status(), r.url());
   });
   // navigate, then print what matters
   await b.close();
   ```

   If `.auth/admin.json` is missing, create it first with `npx playwright test --project=setup`.

2. Report, for the target screen:
   - the URL it actually lands on (several OrangeHRM routes redirect)
   - input `name` attributes, and which fields have none (those need label-based locators)
   - visible labels, headings and tab names
   - exact message strings for success, empty and validation states
   - the `/api/v2/...` call behind any search, filter or save
   - the grid's cell count per row, if it has a grid

3. **Wait for hydration before counting anything.** The app is Vue: elements exist only after the
   XHR lands, so an immediate `.count()` returns 0 and lies to you. Await a locator first.

4. Delete `probe.mjs`, then report the findings and what they imply for the locators. Note any
   behaviour that contradicts `CLAUDE.md` — that table is meant to stay accurate.
