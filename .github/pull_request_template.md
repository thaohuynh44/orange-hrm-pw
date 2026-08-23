## What changed

<!-- One or two sentences. The branch name says the type; this says the substance. -->

## Checks

- [ ] `npm run verify` — typecheck, lint, format
- [ ] `npm run test:readonly` green locally
- [ ] `npx playwright test --list | tail -1` — test count is what I expect (deletions are deliberate)
- [ ] New tests carry one scope tag (`@pim`/`@admin`/`@my-info`/`@auth`/`@flow`/`@seed`) plus
      `@smoke`/`@write` where they apply

## Nightly-owned paths

The PR path runs read-only feature tests only. If this branch touches `tests/flows/`,
`src/tasks/`, the ESS-provisioning fixture under `src/fixtures/`, `src/data/employee.factory.ts`,
or any `@write` spec, run the full workflow on this branch before merging (Actions → **E2E Tests**
→ **Run workflow** → pick this branch) and link the run below.

- [ ] Not applicable — no nightly-owned path touched
- [ ] Dispatched run: <!-- link -->
