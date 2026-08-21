---
description: Hunt flakiness by repeating tests with retries disabled
argument-hint: [test/file/tag — defaults to @smoke]
allowed-tools: Bash, Read, Write, Edit, Glob, Grep
---

Check stability of: **${ARGUMENTS:-@smoke}**

1. Run with retries off and repetition on, in parallel, so races surface:

   ```bash
   npx playwright test <target> --retries=0 --repeat-each=5
   ```

   Use `npm run test:readonly` scope if the target would otherwise create data on the shared demo.

2. For anything that fails intermittently, find the **signal it should have awaited** — a REST
   response, a settled grid, a committed value — and fix the wait at its source in the page object
   or component, so every test on that screen benefits. Never paper over it with a timeout, a
   retry, or a longer global timeout.
3. Re-run the same command to confirm a clean pass, and report the pass count (e.g. "15/15, no
   retries used"). If something still flakes, say so plainly rather than declaring it fixed.
