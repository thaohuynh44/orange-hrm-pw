# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

End-to-end test suite for the **public OrangeHRM demo** (`https://opensource-demo.orangehrmlive.com`),
written in Playwright + TypeScript. There is no application source here — the app under test is a
remote, shared, third-party instance. That single fact drives most of the conventions below.

## Commands

```bash
npm test                      # full suite (setup + guest + chromium projects)
npm run test:readonly         # everything except @write — creates no data on the demo
npm run test:smoke            # @smoke only
npm run verify                # typecheck + lint + format:check — run before finishing work
npm run report                # open the HTML report of the last run
```

Running a subset:

```bash
npx playwright test tests/pim/employee-list.spec.ts                 # one file
npx playwright test -g "reset clears the applied filters"           # one test by title
npx playwright test --project=guest                                 # unauthenticated suites only
npx playwright test tests/pim --retries=0 --repeat-each=3            # prove stability, not luck
npx playwright test --headed --project=chromium -g "..."             # watch it happen
```

`--project=chromium` automatically runs the `setup` project first. Firefox/WebKit exist but are
opt-in: `ALL_BROWSERS=true npx playwright test`.

## Architecture

Five layers, each with one job. Read `src/core/base.page.ts` and `src/fixtures/test.fixture.ts`
first — they explain most of the rest.

1. **`src/config/env.ts`** — all environment parsing plus a `routes` map. Specs never hard-code a
   URL or a timeout, and neither does the framework: `env.timeouts` has `action`, `navigation`,
   `expect`, `test` and `settle` (the app committing to a state by itself - spinner clearing, grid
   settling, a form finishing its post-mount XHR fill). No `ms` literal belongs in `src/`.
   `routes.personalDetails(empNumber)` is a function, since that screen is keyed by the app's
   internal record id.
2. **`src/core/`** — app-agnostic machinery. `BasePage` gives every page `open()`,
   `expectLoaded()`, `waitForSpinner()`, `apiResponse()` and `withApiResponse()`.
   `core/components/` wraps the OXD widgets (select, autocomplete, results-summary, grid,
   side-menu, top-bar, toast, confirm-dialog) so no spec ever touches an `.oxd-*` class directly.
   `core/table.ts` reads grid rows safely. `core/app.chrome.ts` bundles the chrome every screen
   shares (top bar, side menu, toast, grid) against any `Page`: `BasePage` exposes it to page
   objects, and the **`chromeFor` fixture** hands the same bundle to a spec holding a bare page —
   a second session, or a route asserted to be refused, where there is no screen worth a page
   object but the breadcrumb or the grid still has to be read without naming a class in the test.
3. **`src/pages/`** — one class per screen, each declaring `path` and implementing `expectLoaded()`.
   Page objects own _navigation_ assertions; they do not own the assertion a test exists to make.
4. **`src/api/pim.api.ts`** — a **read-only** REST client built from `page.request`, so it rides the
   browser's authenticated session with no separate login. Journeys use it to confirm from the API
   what they just did through the UI. It never drives the app; that is the UI's job.
5. **`src/fixtures/test.fixture.ts`** — every page object, and the API client, is a fixture. Specs
   import `test`/`expect` from here, never from `@playwright/test` directly.

### Authentication is done once, not per test

`global.setup.ts` runs as its own project, logs in, and writes `.auth/admin.json`. Projects are
split accordingly, and this split is why `tests/auth/` is special:

| Project    | Tests                           | Session            |
| ---------- | ------------------------------- | ------------------ |
| `setup`    | `global.setup.ts`               | performs the login |
| `guest`    | `tests/auth/**`                 | signed out         |
| `chromium` | everything except `tests/auth/` | stored session     |

A test that needs to be signed out belongs in `tests/auth/`. Anywhere else, assume you are
already authenticated as Admin — do not log in inside a spec.

## Conventions that matter here

- **Never `page.waitForTimeout()`.** Grid actions await the REST call behind them through
  `BasePage.withApiResponse()` (`/api/v2/pim/employees`, `/api/v2/admin/users`), then wait for the
  grid to commit via `ResultsSummaryComponent.waitForSettled()`. Copy that pattern for new grids.
  `withApiResponse()` awaits a **GET**; writes race their own verb through
  `BasePage.apiResponse(urlPart, 'PUT' | 'DELETE')` (see `PersonalDetailsPage.save()` and
  `EmployeeListPage.deleteByEmployeeId()`). Use that helper rather than a bare
  `page.waitForResponse()`, which inherits the 15s action timeout the demo's slower saves exceed —
  `apiResponse()` already carries the navigation-grade budget.
- **Every spec makes its own `expect()` call.** ESLint enforces this
  (`playwright/expect-expect` with `assertFunctionNames: ['expect']`). A page object's
  `expectLoaded()` guards navigation; it is not the test's assertion.
- **Verify locators against the live app before writing them.** The app ships no `data-testid`,
  so prefer roles, labels and `name` attributes, and fall back to OXD classes only when nothing
  better exists. Confirm with `npx playwright codegen` or the `playwright-test` MCP tools rather
  than guessing — guessed OXD classes are the main source of wasted cycles in this repo.
- **Assert on shape, not on the demo's current data.** Record counts, employee names and which
  filters match anything all change between runs. `expect(count).toBeGreaterThan(0)`, not `=== 143`.
- **Generate test data.** `buildEmployee()` in `src/data/employee.factory.ts` adds a random suffix
  so parallel workers and repeat runs never collide.
- **Title tests to a fixed shape.** `test.describe()` is `<Scope> - <Subject>`: the module
  (`PIM`, `Auth`), the actor for role suites (`ESS session`), or `Journey` for `tests/flows/` — the
  scope omitted only when it would repeat the subject (`Dashboard`). A test title is one
  present-tense sentence stating the observable outcome: **verb-first** when the describe names a
  screen, because the describe is then its subject (`PIM - Add Employee › prefills a generated
employee id`); **subject-first** when the describe names a concern, role or journey, because it
  is not one (`Admin session - permitted routes › System Users is served`). No `should`/`must`, no
  tags in the title, ≤ 72 characters. `playwright/valid-title` enforces the mechanical half;
  reasoning in `specs/test-title-format.design.md`.
- **Tag new tests**: one scope tag — `@pim`, `@admin`, `@my-info`, `@auth`, `@flow` or `@seed` —
  plus the traits that apply: `@smoke` for the critical path, and `@write` for anything that
  creates data (even if it cleans up afterwards). Full table in the README.

## Feature tests vs journeys

Two test types, kept apart on purpose:

- **`tests/<module>/`** — feature tests: one behaviour on one screen, fast, mostly read-only.
- **`tests/flows/`** — journeys: one business outcome across modules, tagged `@flow @write`, run by
  `npm run test:flows` (nightly in CI, not on the PR path).

Journeys are written against the **task layer** in `src/tasks/` — business actions composed from
page objects (`hireEmployee()`, `grantEssAccess()`, `signInAs()`). The layering is
**spec → task → page object → component**; a task may span several page objects, a page object never
knows about tasks.

When writing a journey:

- One journey = **one test**, staged with `test.step()` — never `describe.serial` with a test per
  stage (Playwright isolates state per test, so those chains leak state or cascade).
- Assert the **seams** between modules and roles. Never re-assert field validation a feature test
  already covers — that only makes the journey slower and noisier.
- Cross roles with the **`secondSession` fixture** (a page in its own signed-out context), not by
  logging the admin out.
- Call **`test.slow()`** — journeys exceed the 90s default.
- Tasks return what later steps need: `employeeId` to filter by, `empNumber` to prove identity,
  `fullName` as autocompletes render it (`First [Middle] Last` — the user menu omits the middle name).

## The app's quirks (already handled — don't re-discover them)

These were verified against the live site; the handling lives in the component named beside each.

| Behaviour                                                                                                                                                                                                                                                     | Handled in                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Autocomplete shows a transient `Searching....` option                                                                                                                                                                                                         | `AutocompleteComponent`                                         |
| Count reads `(1) Record Found` (singular), and vanishes when empty                                                                                                                                                                                            | `ResultsSummaryComponent`                                       |
| `No Records Found` renders in the grid **and** in a toast                                                                                                                                                                                                     | `ResultsSummaryComponent`                                       |
| Grids re-render in place, so rows can be read mid-update                                                                                                                                                                                                      | `src/core/table.ts`, `withApiResponse`                          |
| Personal Details (via `My Info` **or** PIM) fills its inputs by XHR _after_ mount. Typing sooner is silently overwritten, and the save then writes the record's **original** values back — a 200 PUT and a `Successfully Updated` toast while nothing changed | `MyInfoPage.expectLoaded`, `PersonalDetailsPage.expectLoaded`   |
| Employee Id is **optional**, so grid rows can show a blank Id (`employeeId: null` from the API)                                                                                                                                                               | asserted on the name in `employee-list.spec.ts`                 |
| Employee Id input has no `name` attribute                                                                                                                                                                                                                     | located by label                                                |
| Vue mounts after `domcontentloaded`, so inputs appear late                                                                                                                                                                                                    | `expectLoaded()` on every page                                  |
| A route ESS may not see answers **403 with the page rendered**, URL unchanged                                                                                                                                                                                 | `ess-role-access.spec.ts`                                       |
| `/maintenance/*` is the exception: it redirects to `purgeEmployee`, _then_ refuses                                                                                                                                                                            | `ess-role-access.spec.ts`                                       |
| That redirect is not the restriction - Admin is bounced too, to an `Administrator Access` re-auth form                                                                                                                                                        | `admin-role-access.spec.ts`                                     |
| My Info's Job/Salary tabs are read-only for **every** role, not just ESS                                                                                                                                                                                      | asserted in both role suites                                    |
| Job Titles' breadcrumb reads `Admin / Job`, not `Admin / Job Titles`                                                                                                                                                                                          | `admin-role-access.spec.ts`                                     |
| The top-bar `Upgrade` button is Admin-only; the user dropdown is identical for both roles                                                                                                                                                                     | `TopBarComponent.upgradeButton`                                 |
| `Create Login Details` must be clicked on the `.oxd-switch-input` span; the checkbox under it intercepts nothing and times out                                                                                                                                | `AddEmployeePage.toggleCreateLoginDetails`                      |
| Confirm Password reports `Passwords do not match`, **never** `Required` — even when both password fields are empty                                                                                                                                            | `add-employee-validation.spec.ts`                               |
| The password-strength chip is absent until typing, and its top rating reads `Strongest`, not `Strong`                                                                                                                                                         | `AddEmployeePage.passwordStrengthChip`                          |
| Add Employee's **prefilled** Employee Id periodically collides with another demo user's record, adding an extra `Employee Id already exists` message — fill a generated id when asserting a message count                                                     | `add-employee-validation.spec.ts`                               |
| First/Middle/Last Name share one `Employee Full Name` label, so field errors are reached from the input's own `.oxd-input-group`                                                                                                                              | `AddEmployeePage.errorFor(field)`                               |
| Deleting confirms through an OXD `Are you Sure?` modal (`Yes, Delete`); its success toast auto-dismisses before the grid finishes settling                                                                                                                    | `ConfirmDialogComponent`, `EmployeeListPage.deleteByEmployeeId` |
| A deleted `empNumber` answers **422 Invalid Parameter**, not 404                                                                                                                                                                                              | `EmployeeApi`, `employee-lifecycle.spec.ts`                     |

Verified message strings: `Invalid credentials`, `Required`, `Employee Id already exists`,
`Successfully Saved`, `Successfully Updated`, `Successfully Deleted`, `Credential Required`,
`Passwords do not match`, `Username already exists`, `Should not exceed 30 characters`,
`Should not exceed 10 characters`, `Should have at least 7 characters`, `Administrator Access`.

**Known app defect, not handled:** as ESS, `/recruitment/viewRecruitmentModule` answers HTTP 500 with
an empty body instead of the usual 403 refusal, so `page.goto()` fails the navigation outright
(`net::ERR_HTTP_RESPONSE_CODE_FAILURE`). The test asserts only that the module is not served
(`response.ok()` is false) rather than pinning the 500, so it keeps passing once this is fixed.

## Shared demo instance — the standing constraint

The target is public and shared with the world. `@write` tests are tagged and excluded by
`npm run test:readonly`. Data resets periodically, the instance is sometimes slow (hence retries and
the navigation-grade timeout on the login page), and a filter that matched records yesterday may
match none today.

**PIM employees _can_ be deleted** — the row's trash action fires `DELETE /api/v2/pim/employees` and
`tests/flows/employee-lifecycle.spec.ts` hands its record back, so it leaves nothing behind. Login
accounts have no such undo, which is why the ESS fixture provisions exactly one. A test that creates
an employee is still `@write`: a failed run can die before its cleanup.

**Prefer `npm run test:readonly` while iterating.** Only run `@write` tests when the change you are
making actually touches employee creation.

### Role-based access tests

`tests/access-control/` holds both halves of the role pairs. The demo publishes no ESS credentials, so the
`essUser` fixture provisions one account (and `essPage` signs in as it). Both are **worker-scoped**,
and the spec sets `test.describe.configure({ mode: 'serial' })` — that pins the file to one worker so
a whole run provisions exactly **one** account rather than one per worker. Keep both properties if you
add tests here, and run repeats with `--workers=1` for the same reason.

The Admin halves all live in one read-only mirror, `tests/access-control/admin-role-access.spec.ts`
(top bar, permitted routes, My Info permissions) - no provisioned account, no serial mode. Each role
assertion only means something against its counterpart, so change the two together.

## Branching

`main` is the only long-lived branch. Start every change with `git switch -c <type>/<kebab-summary>`
off an updated `main` — never continue on a branch that has already merged, and never reuse a merged
name. Types: `test/` (coverage), `fix/` (a wrong or flaky test), `flake/` (a flakiness hunt),
`refactor/` (structure under `src/`, from a `specs/*.design.md`), `ci/`, `docs/`, `chore/`. Take
updates with `git pull --rebase origin main`, not by merging `main` in.

A green PR is not a full run: the PR path is `test:features:readonly`, so `@write` and `@flow`
first run at 02:00 UTC on `main`. If a change touches `tests/flows/`, `src/tasks/`, the
ESS-provisioning fixture under `src/fixtures/`, `src/data/employee.factory.ts` or any `@write`
spec, say so in the PR and tell the user to dispatch the workflow on the branch (Actions → E2E
Tests → Run workflow) before merging — that is the only way to run those suites off the nightly.

## Changing the framework itself

Coverage work and structural work have different failure modes, so they have different entry points.
`/architect` measures the current shape and writes a proposal to `specs/<name>.design.md` without
touching code; `/refactor` executes one, baselining `npx playwright test --list` counts and a green
`npm run test:readonly` **before** the first edit and proving them again afterwards. The suite is
the only regression net this repo has — a refactor that loses a test silently has broken the net,
so account for every difference in those counts.

## AI-assisted workflow

`.claude/agents/` holds Playwright's planner / generator / healer subagents, driven through the
`playwright-test` MCP server in `.mcp.json` (it drives a real browser against the demo). The
commands in `.claude/commands/` are the entry points: `/probe`, `/new-test`, `/triage`,
`/flake-check` for day-to-day work, `/plan-tests` → `/generate-tests` → `/heal-tests` to drive
the agent loop, and `/architect` → `/refactor` for changes to the framework itself rather than to
its coverage. `tests/seed.spec.ts` is the authenticated starting point those
agents use — keep it green.

Generated tests must be rewritten into the conventions above before they are committed: fixtures
instead of raw `@playwright/test`, page objects instead of inline selectors, no `waitForTimeout`.
Run `npm run verify` afterwards.
