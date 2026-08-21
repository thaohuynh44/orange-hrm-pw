---
description: Assess or design a structural change to the test framework, and write it up before any code moves
argument-hint: <question or goal, e.g. "the list pages all duplicate grid handling">
allowed-tools: Bash, Read, Write, Glob, Grep
---

Design work for: **$ARGUMENTS**

Produce a proposal. **Do not edit `src/` or `tests/` in this command** — `/refactor` executes what
this decides. Ending with a written recommendation and no code is a complete result.

1. **Read the current shape, don't trust the description of it.** `CLAUDE.md`'s Architecture section
   is the intended contract — `src/config` → `src/core` → `src/pages` → `src/api` → `src/fixtures`,
   with `src/tasks/` composing page objects for journeys, and the layering
   **spec → task → page object → component**. Verify against the code: docs drift, and a proposal
   built on a stale doc is worse than no proposal.

2. **Measure before opining.** Numbers make the case, or kill it:

   ```bash
   npx playwright test --list | tail -1                  # total tests in play
   grep -rn "oxd-" tests/ --include="*.spec.ts"          # selectors that leaked into specs
   grep -rln "from '@playwright/test'" tests/            # specs bypassing the fixture
   grep -c "" src/pages/*.ts src/pages/**/*.ts           # page objects large enough to split
   ```

   Add whatever else the question needs. Report what you found even when it contradicts the premise
   — "these three pages look duplicated but each waits on a different API" is a real answer.

3. **Write the proposal** to `specs/<kebab-case-name>.design.md`:
   - **Problem** — what hurts today, with the evidence from step 2.
   - **Options** — at least two, each with its trade-off. One option is always "leave it alone".
   - **Recommendation** — which, and why this repo's constraints favour it.
   - **Blast radius** — every file that moves, and how many tests sit downstream of them.
   - **Migration order** — independently verifiable steps, each one leaving the suite green. A
     refactor that only works when applied in full cannot be reviewed or reverted.
   - **What would make this a bad idea** — the honest counter-case.

4. Constraints worth weighing every time: the app under test is a shared public demo, so nothing can
   be validated by running `@write` in a loop; the suite is the only regression net the framework
   has; and abstraction that removes a wait is a bug, not a simplification.

Report the recommendation, the blast radius, and the plan file path. Do not start the migration.
