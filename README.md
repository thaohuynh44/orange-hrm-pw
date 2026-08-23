# OrangeHRM E2E Automation — Playwright + TypeScript

End-to-end test framework for the [OrangeHRM demo](https://opensource-demo.orangehrmlive.com/),
built on Playwright with TypeScript, the Page Object Model, fixture-injected page objects and
reusable components for OrangeHRM's OXD widgets.

## Quick start

```bash
npm ci
npx playwright install --with-deps   # browsers (already installed for chromium locally)
cp .env.example .env                 # adjust BASE_URL / credentials if needed
npm test
```

Reports: `npm run report` (HTML), `npm run trace test-results/<dir>/trace.zip` (trace viewer).

## Key design decisions

The app under test is a **public demo instance, shared with the world, whose data resets without
warning** — no source, no seeding hooks, no `data-testid`. Every decision below follows from that
one fact; each links to the section that expands on it.

- **Fixture-injected Page Object Model.** Specs import `test`/`expect` from
  `src/fixtures/test.fixture.ts` — never from `@playwright/test` — and receive page objects as
  arguments. A spec that constructs its own page objects duplicates setup and drifts from its
  neighbours; as fixtures, a test's dependencies _are_ its signature.
  → [Project layout](#project-layout), [Adding a test](#adding-a-test)
- **Components wrap the OXD widgets; no spec touches an `.oxd-*` class.** The demo ships no test
  ids, so class hooks are unavoidable _somewhere_ — confining them to `src/core/components/` makes
  a widget change one edit instead of forty.
  → [Conventions](#conventions)
- **Log in once, in a project of its own.** `global.setup.ts` signs in and stores the session in
  `.auth/admin.json`; the `guest` and `chromium` projects split on whether they load it. Paying for
  the login form once instead of once per authenticated spec is the largest single saving available
  against a slow shared instance, so a test that must be signed out belongs in `tests/auth/` rather
  than logging the session out mid-run.
  → [How authentication works](#how-authentication-works)
- **One module owns every URL and every timeout.** `src/config/env.ts` holds the `routes` map and
  the five timeout budgets, so no `ms` literal and no hard-coded path appears anywhere in `src/` or
  `tests/`. Retuning for a slow day is one file, not a grep.
  → [Configuration](#configuration)
- **No `waitForTimeout`, anywhere.** Grid actions await the REST call that backs them and then wait
  for the grid to commit to a record count or the empty state; writes race their own `PUT`/`DELETE`
  through `BasePage.apiResponse()`, which carries a navigation-grade budget the demo's slower saves
  need. Sleeps would be both slower and less reliable than the signal they approximate.
  → [Conventions](#conventions)
- **The API client verifies; it never drives.** `src/api/pim.api.ts` rides the browser's
  authenticated session read-only, confirming what the UI just did. Seeding through the API would
  make the suite prove the API works while skipping the screen it exists to test.
  → [Project layout](#project-layout)
- **Feature tests and journeys are separate test types.** `tests/<module>/` proves one behaviour on
  one screen and stays fast and mostly read-only; `tests/flows/` proves one business outcome across
  modules, written against the task layer in `src/tasks/` and staged with `test.step()`. Mixing them
  yields journeys that re-assert field validation and feature tests that need three modules to pass.
  → [Two kinds of test](#two-kinds-of-test), [The task layer](#the-task-layer)
- **Assert on shape, not on the demo's current data.** `expect(count).toBeGreaterThan(0)`, never
  `=== 143`, and generated employees (`buildEmployee()`) instead of fixed names, so parallel workers
  and repeat runs never collide.
  → [Shared demo data — important](#shared-demo-data--important)
- **`@write` runs off the PR path.** Creating an employee is reversible and the lifecycle journey
  hands its record back, but the ESS login account the role suites need is not — the demo offers no
  way to delete it. So writes and journeys run nightly and on demand, and the PR path is read-only.
  → [Tags](#tags), [CI](#ci)

## Project layout

```
.
├── playwright.config.ts        Projects, timeouts, reporters, retries
├── global.setup.ts             Logs in once, stores the session in .auth/admin.json
├── src/
│   ├── config/env.ts           Typed env vars + route map (single source of URLs)
│   ├── core/
│   │   ├── base.page.ts        Shared page behaviour: open/expectLoaded, spinner, API waits
│   │   ├── table.ts            Safe grid-row reader (asserts cell count before reading)
│   │   └── components/         Reusable OXD widget wrappers
│   │       ├── select.component.ts          .oxd-select dropdowns
│   │       ├── autocomplete.component.ts    .oxd-autocomplete (handles "Searching....")
│   │       ├── results-summary.component.ts "(143) Records Found" / empty state
│   │       ├── side-menu.component.ts       Left module navigation
│   │       ├── top-bar.component.ts         Breadcrumb, tabs, user menu, logout
│   │       ├── toast.component.ts           .oxd-toast success/error flashes
│   │       └── confirm-dialog.component.ts  "Are you Sure?" destructive-action modal
│   ├── pages/                  One page object per screen
│   │   ├── login.page.ts   dashboard.page.ts   my-info.page.ts   directory.page.ts
│   │   ├── pim/employee-list.page.ts   pim/add-employee.page.ts   pim/personal-details.page.ts
│   │   └── admin/system-users.page.ts  admin/add-user.page.ts
│   ├── api/pim.api.ts          Read-only PIM REST client for API-level verification
│   ├── tasks/                  Business actions for journeys (hire, amend, delete, grant ESS)
│   ├── fixtures/               What a spec is handed, one module per kind
│   │   ├── test.fixture.ts       Composes the four below - specs import test/expect here
│   │   ├── pages.fixture.ts      One page object per screen
│   │   ├── api.fixture.ts        Read-only REST clients
│   │   ├── session.fixture.ts    secondSession (a page in its own context)
│   │   ├── chrome.fixture.ts     chromeFor (chrome for a page with no page object)
│   │   └── access-control.fixture.ts  Worker-scoped ESS provisioning (@write)
│   ├── data/                   credentials.ts, employee.factory.ts, account.factory.ts (faker),
│   │                           fixtures/avatar.png (upload test image)
│   └── utils/logger.ts
├── tests/
│   ├── auth/                   login.spec.ts, session.spec.ts   (run unauthenticated)
│   ├── dashboard/              dashboard.spec.ts
│   ├── pim/                    employee-list.spec.ts, add-employee.spec.ts,
│   │                           add-employee-validation.spec.ts
│   ├── admin/                  system-users.spec.ts
│   ├── my-info/                my-info.spec.ts
│   ├── access-control/         ess-role-access.spec.ts, admin-role-access.spec.ts
│   ├── flows/                  hire-to-ess-access, employee-lifecycle  (journeys)
│   └── seed.spec.ts            Authenticated starting point for the AI agents
└── .github/workflows/playwright.yml
```

## How authentication works

`global.setup.ts` runs as its own Playwright project, logs in once and saves the storage state to
`.auth/admin.json`. Authenticated projects consume it via `use.storageState`, so no functional spec
pays for the login form.

Tests under `tests/auth/` need a signed-out browser, so they run in the separate **`guest`** project
with an empty storage state. Everything else runs in the **`chromium`** project, which depends on
`setup`.

| Project    | Contents                        | Session            |
| ---------- | ------------------------------- | ------------------ |
| `setup`    | `global.setup.ts`               | performs the login |
| `guest`    | `tests/auth/**`                 | signed out         |
| `chromium` | everything except `tests/auth/` | stored session     |

Cross-browser runs are opt-in so the default run stays fast: `npm run test:all-browsers`
(adds `firefox` and `webkit`).

## Commands

| Command                     | Purpose                                            |
| --------------------------- | -------------------------------------------------- |
| `npm test`                  | Full suite (Chromium + guest)                      |
| `npm run test:headed`       | Watch it run in a real browser                     |
| `npm run test:ui`           | Playwright UI mode                                 |
| `npm run test:debug`        | Inspector / step debugging                         |
| `npm run test:smoke`        | `@smoke` tagged tests only                         |
| `npm run test:readonly`     | Everything except `@write` (creates no data)       |
| `npm run test:pim`          | `@pim` tests; also `test:admin`, `test:auth`       |
| `npm run test:flows`        | Journeys only (`tests/flows/`)                     |
| `npm run test:features`     | Everything except journeys (`--grep-invert @flow`) |
| `npm run report:merge`      | Stitch sharded CI `blob` reports into one report   |
| `npm run test:seed`         | The agent seed file, to check it is still green    |
| `npm run test:all-browsers` | Chromium + Firefox + WebKit                        |
| `npm run report`            | Open the HTML report                               |
| `npm run codegen`           | Record new locators against the demo               |
| `npm run verify`            | `typecheck` + `lint` + `format:check` (CI gate)    |
| `npm run clean`             | Remove reports, traces and the stored session      |

## Tags

Every test carries at least one **scope** tag; **trait** tags stack on top of it.

| Tag                          | Kind  | Meaning                                           | Selected by                                                    |
| ---------------------------- | ----- | ------------------------------------------------- | -------------------------------------------------------------- |
| `@pim`, `@admin`, `@my-info` | scope | the module under test                             | `npm run test:pim`, `test:admin`                               |
| `@auth`                      | scope | sign-in and session, runs signed out              | `npm run test:auth`                                            |
| `@flow`                      | scope | cross-module journey, nightly not PR              | `npm run test:flows`                                           |
| `@seed`                      | scope | the agent seed file, kept green for the subagents | —                                                              |
| `@smoke`                     | trait | critical path, safe to run anywhere               | `npm run test:smoke`                                           |
| `@write`                     | trait | **creates data on the shared demo instance**      | excluded by `npm run test:readonly`, and off the PR path in CI |

Rules of thumb:

- Anything that saves a record gets `@write`, even if it deletes the record again afterwards —
  a failed run can still leave it behind.
- `@flow` implies `@write` in practice; journeys are excluded from the PR path by
  `--grep-invert @flow` and from `test:features`.
- Use `npm run test:readonly` when you want a completely side-effect-free run.

## Test titles

`test.describe()` is `<Scope> - <Subject>`, with a single spaced hyphen:

| Scope     | Used for                   | Example                           |
| --------- | -------------------------- | --------------------------------- |
| module    | a screen                   | `PIM - Employee List`             |
| actor     | role suites                | `ESS session - restricted routes` |
| `Journey` | anything in `tests/flows/` | `Journey - employee lifecycle`    |

Omit the scope only when it would repeat the subject — `Dashboard`, never `Dashboard - Dashboard`.

A test title is one present-tense sentence stating the observable outcome. Its shape follows the
describe:

- describe names a **screen** → verb-first, because the describe is the subject:
  `PIM - Add Employee › prefills a generated employee id`
- describe names a **concern, role or journey** → subject-first, because the describe is not one:
  `Admin session - permitted routes › System Users is served, and queries the users API`

Capitalise the first word only where it is a UI label the app itself capitalises (`System Users`,
`Cancel`). No `should` or `must`, no tags in the title — they go in the `tag` option — and aim for
72 characters or fewer. `playwright/valid-title` enforces the mechanical half of this; the full
reasoning, including why test titles are deliberately _not_ pattern-matched, is in
`specs/test-title-format.design.md`.

## Conventions

- **Page objects never assert on behalf of a test's intent**, but each one owns an `expectLoaded()`
  so navigation failures surface at the point of navigation, not three steps later.
- **No hard-coded URLs in specs** — routes live in `src/config/env.ts`.
- **No `waitForTimeout`.** Grid interactions await the REST call that backs them
  (`/api/v2/pim/employees`, `/api/v2/admin/users`) via `BasePage.withApiResponse`, then wait for the
  grid to commit to either a record count or the empty state.
- **Locators prefer semantics** (roles, labels, `name` attributes) and fall back to OXD class hooks
  only where the app offers nothing better. The app ships no `data-testid` attributes.
- **Test data is generated** (`buildEmployee()`) with a random suffix, so parallel workers and repeat
  runs never collide.

### App behaviours the framework already absorbs

These were verified against the live site and are the usual sources of flakiness:

| Behaviour                                                                                                                     | Handled in                                 |
| ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Autocomplete renders a transient `Searching....` option                                                                       | `AutocompleteComponent`                    |
| Result count is `(1) Record Found` (singular) and absent when empty                                                           | `ResultsSummaryComponent`                  |
| `No Records Found` appears in **both** the grid and a toast                                                                   | `ResultsSummaryComponent`                  |
| Grids re-render in place, so rows can be read mid-update                                                                      | `src/core/table.ts`, `withApiResponse`     |
| `My Info` redirects to `/pim/viewPersonalDetails/empNumber/<id>` and fills fields by XHR                                      | `MyInfoPage.expectLoaded`                  |
| Employee Id field has no `name` attribute                                                                                     | located by label                           |
| Vue mounts after `domcontentloaded`, so inputs appear late                                                                    | `expectLoaded()` on every page             |
| Personal Details fills inputs by XHR after mount — typing sooner is overwritten, and the save writes the original values back | `PersonalDetailsPage.expectLoaded`         |
| `Create Login Details` toggles from the `.oxd-switch-input` span, not the checkbox                                            | `AddEmployeePage.toggleCreateLoginDetails` |
| Confirm Password says `Passwords do not match`, never `Required`                                                              | `add-employee-validation.spec.ts`          |
| The prefilled Employee Id can collide with another user's record, adding an extra error                                       | `add-employee-validation.spec.ts`          |
| Deletes confirm through an `Are you Sure?` modal whose toast auto-dismisses quickly                                           | `ConfirmDialogComponent`                   |

## AI-assisted testing (Claude Code)

The repo is set up so Claude can explore the app, author tests and fix failures **within these
conventions** rather than around them.

| File                    | Role                                                                                                 |
| ----------------------- | ---------------------------------------------------------------------------------------------------- |
| `CLAUDE.md`             | Project memory: commands, architecture, conventions, verified quirks                                 |
| `.claude/commands/`     | Repo-specific workflows: `/probe`, `/new-test`, `/triage`, `/flake-check`, `/architect`, `/refactor` |
| `.claude/agents/`       | Playwright's planner / generator / healer subagents                                                  |
| `.claude/prompts/`      | Playwright's plan → generate → heal prompt templates                                                 |
| `.mcp.json`             | `playwright-test` MCP server — lets the agents drive a real browser                                  |
| `.claude/settings.json` | Permission allowlist + Prettier-on-save hook                                                         |
| `tests/seed.spec.ts`    | Authenticated starting point the agents run before exploring                                         |

### The two workflows

**Repo commands** — the faster path for day-to-day work:

- `/probe Leave list filters` — drives the live app and reports the real selectors, message strings
  and `/api/v2/...` calls before a single locator is written. This is how every quirk in the table
  above was found.
- `/new-test filter leave list by status` — adds the page object (if missing), fixture, spec and
  tags, then proves it with `--repeat-each=3`.
- `/triage` — reproduces failures with retries off and classifies each as test bug / race /
  shared-demo data / real app defect **before** editing anything.
- `/flake-check @pim` — repeats tests with retries disabled and fixes waits at their source.

**Framework work** — for changing the harness rather than the coverage:

- `/architect the list pages all duplicate grid handling` — measures the current structure, weighs
  at least two options against "leave it alone", and writes the recommendation, blast radius and a
  step-by-step migration to `specs/<name>.design.md`. Changes no code.
- `/refactor extract a grid component from the list pages` — executes one, baselining the test
  counts and a green read-only run before the first edit and proving them again after. It refuses
  the shortcuts that make a refactor look green: deleting a test, swallowing a wait, or letting the
  count drop without accounting for every missing test.

**Playwright's agent loop** — for generating breadth from scratch:

- `/plan-tests Leave module` — the planner explores the live app and saves a plan under `specs/`
- `/generate-tests specs/leave.plan.md` — the generator executes each step in a real browser, then
  the output is rewritten into this repo's fixtures and page objects
- `/heal-tests @pim` — the healer runs the target and fixes failures, with its "fixes" reviewed
  against the rules below

These wrap the subagents in `.claude/agents/`; the equivalent raw recipes are in `.claude/prompts/`.
The MCP server needs approval on first use (`.claude/settings.json` pre-enables `playwright-test`
for this project; remove that key if you would rather approve it manually).

### Two things to know

1. **The generator emits raw `@playwright/test` scripts.** All three agents carry an appended
   "Repository conventions" section telling them to use the fixtures, page objects and API-aware
   waits instead — but review generated output before committing it, and run `npm run verify`.
2. **Agents drive the shared public demo.** Exploration is read-only, but generated `@write`
   scenarios create real records. Keep `npm run test:readonly` as the default loop.

## Two kinds of test

The suite deliberately separates **feature tests** from **journeys**. They fail for different
reasons and are read by different people, so they live apart.

|         | Feature tests (`tests/<module>/`)         | Journeys (`tests/flows/`)                  |
| ------- | ----------------------------------------- | ------------------------------------------ |
| Scope   | one behaviour on one screen               | one business outcome across modules        |
| Asserts | fields, validation, filters, empty states | the seams between modules and roles        |
| Size    | seconds, dozens of them                   | tens of seconds, a handful of them         |
| Data    | mostly read-only                          | almost always `@write`                     |
| Runs    | every push, unless `@write`               | nightly / on demand (`npm run test:flows`) |
| Tag     | `@pim`, `@admin`, `@my-info`, ...         | `@flow` (plus `@write`)                    |

A journey does **not** re-assert what feature tests already cover. `hire-to-ess-access` never
checks that "Required" appears on an empty form — that belongs to `add-employee.spec.ts`. It checks
that PIM's new record is selectable in Admin, that the account Admin creates can really sign in, and
that the resulting session is scoped to that employee.

### The task layer

Journeys are written against `src/tasks/`, not directly against page objects. Tasks are business
actions composed from page objects — `hireEmployee()`, `grantEssAccess()`, `signInAs()` — so a flow
spec reads as the business outcome rather than as a list of clicks:

```ts
const employee = await hireEmployee(addEmployeePage, { middleName: '' });
await grantEssAccess(addUserPage, employee.fullName, account);
const dashboard = await signInAs(secondSession, account);
```

Layering: **spec → task → page object → component**. A task may span several page objects; a page
object never knows about tasks.

### Rules for writing a journey

1. **One journey = one test.** Use `test.step()` for the stages, not `test.describe.serial` with a
   test per stage. Playwright isolates state per test, so a serial chain either leaks state through
   module-level variables or cascades into confusing multi-failures. Steps keep the chain honest and
   name the exact stage that broke in the report.
2. **Return what later steps need.** `hireEmployee()` hands back the `employeeId` (to filter by),
   the `empNumber` (to prove record identity) and the `fullName` as autocompletes render it.
3. **Cross roles with a second session, never by logging out.** The `secondSession` fixture gives a
   page in its own signed-out context, so the admin session stays alive beside it and the test can
   assert on both.
4. **Call `test.slow()`.** Journeys cross the 90s default; `test.slow()` triples the budget rather
   than inflating the timeout for every test in the suite.
5. **Tag `@flow` and `@write`,** and expect the records to persist unless the journey deletes them
   itself — see the shared-demo note below.
6. **Verify writes at the API as well, where it is cheap.** `employee-lifecycle` asserts the PUT's
   echoed body and re-reads the record through `EmployeeApi` (`src/api/pim.api.ts`, exposed as the
   `employeeApi` fixture). A UI that toasts success while the API kept the old values is a real
   failure mode, and it is the one thing a screenshot will never show you.

### Implemented journeys

- **`hire-to-ess-access`** — admin hires an employee, grants them ESS access, and they sign in.
  Asserts the seams between PIM, Admin and the new user's own scoped session.
- **`employee-lifecycle`** — hire → amend personal details → delete, with every stage confirmed
  against `/api/v2/pim/...` as well as through the UI. It deletes the record it creates, so a green
  run leaves nothing behind on the shared demo.

### Journeys worth adding next

Either implemented journey is the pattern to copy. Natural follow-ons, in rough value order:

- **Leave request → approval** — ESS user requests leave, admin approves, ESS sees the updated
  balance. This is OrangeHRM's highest-value cross-role flow.
- **Job assignment → termination** — hire → assign job title and sub unit → appears under those
  filters in PIM → terminate → drops out of "Current Employees". The lifecycle journey covers
  hire/amend/delete; this covers the employment-status dimension instead.
- **Recruitment** — add a vacancy → apply as a candidate → move the candidate through the hiring
  stages.
- **Self-service update** — ESS edits their own contact details; admin sees the change on the same
  record in PIM.

## Shared demo data — important

`https://opensource-demo.orangehrmlive.com` is a **public, shared instance**, and that shapes the
suite in three ways:

1. `@write` tests create employees. PIM records **can** be deleted, and
   `tests/flows/employee-lifecycle.spec.ts` hands its record back — but most `@write` specs do not,
   a failed run can die before its cleanup, and login accounts cannot be deleted at all. Prefer
   `npm run test:readonly` in tight loops.
2. Assertions avoid exact record counts and fixed employee names — data changes between runs, and
   filters like _Freelance_ can legitimately match zero records.
3. The instance resets periodically and is occasionally slow; retries are set to 1 locally and 2 in
   CI, and the login page gets a navigation-grade timeout.

Point `BASE_URL` at a private instance to remove all three caveats.

## Configuration

All knobs live in `.env` (see `.env.example`) and are parsed and validated in `src/config/env.ts` —
nothing else in the repo reads `process.env`.

| Variable                                                                                       | Default                               | Purpose                                                                                                                                           |
| ---------------------------------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BASE_URL`                                                                                     | the public demo                       | Application under test; point it at a private instance to allow writes                                                                            |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD`                                                            | `Admin` / `admin123`                  | Account `global.setup.ts` signs in as                                                                                                             |
| `HEADLESS`                                                                                     | `true`                                | Set `false` to watch a run                                                                                                                        |
| `WORKERS`                                                                                      | `4` locally, `2` in CI                | Parallel workers                                                                                                                                  |
| `RETRIES`                                                                                      | `1` locally, `2` in CI                | Retries per test — the demo is shared and sometimes slow                                                                                          |
| `SLOW_MO`                                                                                      | `0`                                   | Milliseconds to slow each action, for demos and debugging                                                                                         |
| `ACTION_TIMEOUT` · `NAVIGATION_TIMEOUT` · `EXPECT_TIMEOUT` · `TEST_TIMEOUT` · `SETTLE_TIMEOUT` | `15s` · `45s` · `10s` · `90s` · `30s` | The five budgets; `settle` is the app committing to a state by itself (spinner clearing, grid settling, a form finishing its post-mount XHR fill) |
| `TRACE`                                                                                        | `on-first-retry`                      | Playwright trace mode                                                                                                                             |

Two more are set by tooling rather than by hand: **`BLOB_REPORT=true`** switches the reporter to
`blob` for a sharded CI run (see [CI](#ci)), and **`ALL_BROWSERS=true`** adds the opt-in `firefox`
and `webkit` projects. `CI` is read from the environment to pick the CI-side defaults above.

Credentials are read from the environment, never committed: `.env` is git-ignored, and CI reads
`secrets.ADMIN_USERNAME` / `secrets.ADMIN_PASSWORD` (defaulting to the demo's published account).

## CI

`.github/workflows/playwright.yml` runs on push, PR, nightly at 02:00 UTC and on demand:

1. **static-analysis** — typecheck, lint, format check. Gates everything below.
2. **e2e** — the read-only feature tests (`@flow` and `@write` both excluded), split across a
   4-way `--shard` matrix so Playwright balances the load itself. Each shard writes a `blob`
   report rather than its own partial HTML.
3. **report** — merges those blobs into **one** HTML report and **one** JUnit XML for the run,
   and publishes both. Runs even when shards failed, which is when the report matters most.
4. **write-suites** — the `@write` feature tests, nightly and on demand only. Single-worker, so
   the worker-scoped ESS fixture provisions exactly one account per run.
5. **flows** — the `@flow` journeys, nightly and on demand only, since they are slower and write
   the most. Publishes its own HTML report, JUnit XML, and traces on failure.

Only the PR path is read-only. `@write` runs off it deliberately: creating an employee is
reversible, but the ESS login account `tests/access-control/` provisions is not, so putting it on
every push would leave an account behind on a public instance each time a PR was updated.

Traces, screenshots and videos are embedded in the HTML report, and the `@write`/`flows` jobs also
upload the raw `test-results/` on failure. A `concurrency` group cancels superseded PR and push
runs — two runs of one ref against a shared demo only duplicate writes and manufacture flake —
while scheduled runs sit in their own group so a push can never cancel the nightly.

`workflow_dispatch` takes a `grep` input, so a single tag can be run on demand (e.g. `@smoke`).

## Adding a test

1. Add or extend a page object under `src/pages/`, giving it a `path` and an `expectLoaded()`.
2. Expose it as a fixture in `src/fixtures/pages.fixture.ts` (API clients go in
   `api.fixture.ts`; `test.fixture.ts` only composes the modules).
3. Write the spec against the fixture and tag it:

```ts
import { test, expect } from '../../src/fixtures/test.fixture';

test.describe('Leave - Leave List', { tag: '@leave' }, () => {
  test('opens the leave list', async ({ page }) => {
    // ...
  });
});
```

Run `npm run verify` before pushing.
