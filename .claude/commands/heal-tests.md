---
description: Run the suite and fix failures with the Playwright healer agent, under this repo's rules
argument-hint: [test/file/tag — defaults to the read-only suite]
allowed-tools: Task, Bash, Read, Write, Edit, Glob, Grep
---

Heal: **${ARGUMENTS:-the read-only suite (`npm run test:readonly`)}**

Invoke the `playwright-test-healer` subagent to run the target and fix what fails, then verify its
work yourself — the healer optimises for a green run, which is not the same as a correct test.

Reject any "fix" that:

- adds `page.waitForTimeout()` or lengthens a timeout instead of awaiting the real signal
  (`withApiResponse`, `waitForSettled`, a committed value)
- deletes or waters down an assertion so the test passes vacuously
- inlines a selector in the spec instead of fixing the page object
- hard-codes data from the current state of the shared demo

If a failure looks like a **genuine app defect**, leave it failing and report it — do not make it
pass. Finish with `--retries=0 --repeat-each=3` on the affected tests and `npm run verify`.
