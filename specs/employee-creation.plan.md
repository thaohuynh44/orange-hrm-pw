# Employee Creation (PIM Add Employee) — Test Plan

## Application Overview

## Scope and starting state

All tests assume the seeded, authenticated Admin session (`tests/seed.spec.ts`) — no login step. Every
test in this plan is new; it deliberately does **not** re-plan the five cases already passing in
`tests/pim/add-employee.spec.ts` (prefilled employee id, required first/last name, create-and-find-by-id,
no-middle-name, duplicate employee id). Where a planned case sits next to one of those five, the overview
below says so instead of duplicating it.

## Exploration write budget (shared demo constraint)

Exploration created exactly **2 employees** and **1 login account** on the shared demo, both left in place:

> CORRECTION (verified live while writing `tests/e2e/employee-lifecycle.spec.ts`): PIM **does** support
> deleting an employee — the row's trash action opens an OXD "Are you Sure?" modal, `Yes, Delete` fires
> `DELETE /api/v2/pim/employees` (200) and toasts "Successfully Deleted". Employee-creating tests can
> therefore clean up after themselves; only the login accounts they create are permanent.

- Employee Id `0396` (empNumber `195`), name "PlanTest QAExplore1", with a login account
  `qaplan.explore01` / role ESS / status Enabled — used to verify Personal Details, Employee List
  name-autocomplete, Directory findability, and System Users visibility.
- Employee Id `0399` (empNumber `198`), name "Test@123! Last#Name9" — created while probing
  character validation (see finding below); reused to confirm punctuation/digits round-trip through
  search and autocomplete correctly.

The planned suite below is designed to add only **2 more writes per full run** (one per `@write` test),
reusing each created record for every assertion that test needs rather than creating one employee per
observation.

## Key verified findings (drive the plan; anything not verified live is marked UNVERIFIED)

- **Toggling "Create Login Details" must click the `.oxd-switch-input` span**, not the underlying
  `<input type="checkbox">` — clicking the checkbox directly times out because the span intercepts
  pointer events. `AddEmployeePage.createLoginToggle` already targets the span correctly; it just needs
  a documented `.click()`.
- Toggling it on reveals: **Username*** (textbox, no `name` attr — reach by label "Username"),
  **Status** (a **radio group** "Enabled"/"Disabled" — _not_ a select, unlike Admin ▸ Add User's Status
  select), **Password*** and **Confirm Password*** (textboxes, no `name` attr — reach by label). There is
  **no User Role field** on this screen — accounts created this way are always **ESS** (verified: the
  resulting account showed role "ESS" in System Users with no way to pick Admin).
- A live password-strength indicator renders as `span.orangehrm-password-chip` immediately above the
  Password field, updating on every keystroke, no submit needed. Verified text content: "Very Weak " and
  "Strongest ", trailing space included. CORRECTED during generation: the top rating reads **"Strongest"**,
  not "Strong". The element is absent entirely before anything is typed, not present and empty, and only
  the top rating adds a modifier class (`--strength-strongest`), so text is the reliable assertion target.
- All inline validation messages render via the same `.oxd-input-field-error-message` class that
  `AddEmployeePage.validationErrors` / `validationMessages()` already reads — confirmed across every
  message type below, so no new locator is needed for assertions, only new triggering steps.
- Verified exact message strings (submit or live, as noted):
  - `Required` — First Name, Last Name, Username (submit-time).
  - `Should not exceed 30 characters` — First Name, fired at 61 characters (submit-time). The repo's
    `overlongName()` factory default of 60 chars is confirmed to trigger it.
  - `Should not exceed 10 characters` — Employee Id, fired at 27 characters; the input has no `maxlength`
    attribute, so this is purely JS/submit-time validated.
  - `Should have at least 7 characters` — Password, appears **live while typing** (no submit needed),
    alongside the "Very Weak" strength chip.
  - `Passwords do not match` — Confirm Password. Verified quirk: **Confirm Password never shows
    "Required"**, even when both Password and Confirm are empty, or when Password is filled and Confirm
    is empty — it always shows "Passwords do not match" instead. This means: submitting the whole form
    empty with Create Login Details on yields **five** messages, not four: `Required` ×4 (First Name,
    Last Name, Username, Password) + `Passwords do not match` ×1 (Confirm Password).
  - `Username already exists` — fires **live**, before Save is clicked (verified by typing "Admin").
  - `Employee Id already exists` — already covered by existing test #5; not replanned.
- **No character validation exists on First/Last Name.** Submitting `Test@123!` / `Last#Name9` saved
  successfully ("Successfully Saved" toast, class `.oxd-toast--success`) and the record round-tripped
  correctly through Personal Details, the Employee List name-autocomplete, and Directory search. This
  contradicts an assumption that the app rejects unusual characters — plan the case as an
  **acceptance** test, not a rejection test.
- **Profile picture control**: `input[type="file"]` (unique on the page, no `name`/`accept` attribute).
  Its own preview image is `img.employee-image` (unique class — do not use the bare
  `img[alt="profile picture"]` selector, it also matches the top-bar avatar, which has class
  `.oxd-userdropdown-img`). After `setInputFiles()`, the preview's `src` becomes a `data:image/...;base64,`
  URL **immediately, client-side, before any Save** — verified.
- **Save**, with Create Login Details on, fires (in this order, some repeated live as fields are typed):
  `GET /api/v2/core/validation/unique?...&attributeName=employeeId`,
  `POST /api/v2/auth/public/validation/password`,
  `GET /api/v2/core/validation/unique?...&attributeName=userName&matchByField=deleted&matchByValue=false`,
  then on Save: `POST /api/v2/pim/employees` (creates the employee) and `POST /api/v2/admin/users` (creates
  the login — only fires when the toggle is on). Landing page is `/pim/viewPersonalDetails/empNumber/<n>`
  (already asserted by existing tests), which itself triggers
  `GET /api/v2/pim/employees/<n>/personal-details` and `GET /api/v2/pim/employees/<n>` among others.
- Personal Details renders an `h6` heading reading `"<FirstName> <LastName>"` — a cheap additional
  assertion alongside the existing firstName/lastName input-value checks.
- **Findable in Employee List by name autocomplete** (`AutocompleteComponent.byLabel(page, 'Employee
Name')` on `EmployeeListPage`, already exists): verified — returns exactly one option rendered as
  `"First Last"`, matching the `fullName` convention already documented in `employee.tasks.ts`. Not
  currently covered by any existing test.
- **Findable in Directory**: verified — `/web/index.php/directory/viewDirectory` has its own "Employee
  Name" autocomplete (same OXD widget) and a results line reading `"(1) Record Found"` rendered as
  `span.oxd-text.oxd-text--span`, the exact pattern `ResultsSummaryComponent` already parses. Backing
  calls: `GET /api/v2/directory/employees?nameOrId=<query>` and
  `GET /api/v2/directory/employees?...&empNumber=<n>`. **No page object exists for Directory yet** — see
  "Infrastructure additions needed" below.
- **Cancel** navigates immediately to `/pim/viewEmployeeList`, discarding all entered data, no
  confirmation dialog. Clicking any side-menu link (verified with "Dashboard") while the form is dirty
  behaves the same way — there is no beforeunload/dirty-state guard anywhere on this screen.
- **Creating an employee with Create Login Details in one pass** produces a row in Admin ▸ System Users
  with User Role "ESS" and the selected Status ("Enabled" verified live; "Disabled" was not exercised to
  avoid a third write — mark UNVERIFIED, low priority, the control is a plain radio so the risk is low).

## Not verified / explicitly out of scope for this plan

- Oversized (>1MB) or non-image file uploads (`.txt`, `.pdf` renamed to `.png`, etc.) — not exercised live;
  UNVERIFIED. Would need real invalid binary fixtures and is left for a follow-up pass.
- "Disabled" status on the inline Create Login Details radio — UNVERIFIED (see above).
- Directory's own empty-results rendering — UNVERIFIED (not exercised; likely mirrors
  `ResultsSummaryComponent`'s "No Records Found" handling given the shared span class, but unconfirmed).

## Infrastructure additions needed before/while automating this plan

1. **`src/pages/pim/add-employee.page.ts`**: add `usernameInput`, `passwordInput`, `confirmPasswordInput`
   (by label, mirroring `AddUserPage`'s `fieldByLabel` pattern), `statusRadio(status: 'Enabled' |
'Disabled')`, `passwordStrengthChip` (`page.locator('.orangehrm-password-chip')`), `fileInput`
   (`page.locator('input[type="file"]')`), `photoPreview` (`page.locator('img.employee-image')`), and a
   `toggleCreateLoginDetails()` method (`await this.createLoginToggle.click()`). No changes needed to the
   existing `NewEmployee` interface's shape is required to be broken — extend with an optional
   `login?: { username: string; password: string; status?: 'Enabled' | 'Disabled' }` field and thread it
   through `fillForm()`/`createEmployee()`.
2. **New page object `src/pages/directory.page.ts`**: `path: routes.directory` (already defined), an
   `employeeName` getter returning `AutocompleteComponent.byLabel(this.page, 'Employee Name')`, and a
   `results = new ResultsSummaryComponent(this.page)` (both components are already generic enough to
   reuse verbatim). Register a `directoryPage` fixture in `src/fixtures/test.fixture.ts`.
3. **`src/data/employee.factory.ts`**: no change required — `overlongName()` already defaults to 60
   characters, comfortably over the verified 30-character limit. Consider adding a
   `punctuatedName()` helper (e.g. `"O'Brien-${suffix}"`) for the acceptance test, or simply pass a
   literal override to `buildEmployee()`.
4. **Test fixture image**: add a small (`<50 KB`) valid PNG under version control, e.g.
   `src/data/fixtures/avatar.png`, for the upload-preview test — do not depend on paths inside
   `node_modules` (used only for ad hoc exploration, not appropriate for a committed test).
5. No changes needed to `routes` in `src/config/env.ts` — `addEmployee`, `employeeList`, `systemUsers`
   and `directory` are all already present.

## Test Scenarios

### 1. Add Employee - inline login details validation

**Seed:** `tests/seed.spec.ts`

#### 1.1. submitting the form empty with Create Login Details enabled reports five messages, including a non-Required confirm-password mismatch

**File:** `tests/pim/add-employee.spec.ts`

**Steps:**

1. Open Add Employee (fresh generated Employee Id, blank name fields).
2. Click the Create Login Details toggle (`.oxd-switch-input` span) to reveal Username / Status / Password / Confirm Password. - expect: Username*, Status (Enabled/Disabled radios), Password* and Confirm Password* fields become visible
3. Click Save without filling any field. - expect: Exactly 5 validation messages appear across the form - expect: First Name field shows 'Required' - expect: Last Name field shows 'Required' - expect: Username field shows 'Required' - expect: Password field shows 'Required' - expect: Confirm Password field shows 'Passwords do not match' (never 'Required') - expect: The page stays on /pim/addEmployee

#### 1.2. rejects a first name longer than 30 characters

**File:** `tests/pim/add-employee.spec.ts`

**Steps:**

1. Open Add Employee.
2. Fill First Name with `overlongName()` (60 chars) and Last Name with a valid generated name; leave Employee Id as generated.
3. Click Save. - expect: First Name field shows 'Should not exceed 30 characters' - expect: No navigation occurs; still on /pim/addEmployee - expect: No employee is created (this is a validation-only, non-@write test)

#### 1.3. rejects an employee id longer than 10 characters

**File:** `tests/pim/add-employee.spec.ts`

**Steps:**

1. Open Add Employee.
2. Fill Employee Id with an 11+ character value (e.g. 'EMP-ID-TOO-LONG-1234567890'), and fill valid First/Last Name.
3. Click Save. - expect: Employee Id field shows 'Should not exceed 10 characters' - expect: No navigation occurs; still on /pim/addEmployee - expect: No employee is created

#### 1.4. confirm password is flagged as not matching, never as Required, and clears once it matches

**File:** `tests/pim/add-employee.spec.ts`

**Steps:**

1. Open Add Employee and toggle Create Login Details on.
2. Fill Password with a strong generated value (e.g. matching the demo's complexity rule: upper+lower+digit+symbol) and leave Confirm Password empty, then click Save. - expect: Confirm Password shows 'Passwords do not match' (not 'Required')
3. Fill Confirm Password with a different strong value than Password. - expect: Confirm Password still shows 'Passwords do not match'
4. Overwrite Confirm Password so it matches Password exactly. - expect: The 'Passwords do not match' message for Confirm Password disappears

#### 1.5. password strength chip and length error update live as the password is typed, without submitting

**File:** `tests/pim/add-employee.spec.ts`

**Steps:**

1. Open Add Employee and toggle Create Login Details on.
2. Type a short password, e.g. 'abc', into the Password field (do not click Save). - expect: A chip reading 'Very Weak' (element `.orangehrm-password-chip`) appears above the Password field - expect: Password field shows 'Should have at least 7 characters' live, with no Save click
3. Replace the Password value with a strong one (upper+lower+digit+symbol, 12+ chars). - expect: The strength chip now reads 'Strong' - expect: The 'Should have at least 7 characters' message is gone

#### 1.6. an existing username is flagged live as already taken, before Save is clicked

**File:** `tests/pim/add-employee.spec.ts`

**Steps:**

1. Open Add Employee and toggle Create Login Details on.
2. Type the known Admin username ('Admin', from `env.admin.username`) into the Username field (do not click Save). - expect: Username field shows 'Username already exists' without any Save click

#### 1.7. selecting a profile picture shows a live base64 preview before saving

**File:** `tests/pim/add-employee.spec.ts`

**Steps:**

1. Open Add Employee. - expect: The form's own photo preview (`img.employee-image`) is visible and does not yet have a data: URL src
2. Use `fileInput.setInputFiles()` to select a small committed test PNG (e.g. `src/data/fixtures/avatar.png`). - expect: `img.employee-image`'s `src` attribute now starts with 'data:image' - expect: The distinct top-bar avatar image (`img.oxd-userdropdown-img`) is unaffected
3. Click Cancel rather than Save. - expect: Navigates to /pim/viewEmployeeList; no employee is created by this test

#### 1.8. Cancel discards all entered data and returns to the Employee List

**File:** `tests/pim/add-employee.spec.ts`

**Steps:**

1. Open Add Employee and fill First Name, Last Name, and a custom Employee Id with generated unique values (do not click Save).
2. Click Cancel. - expect: Navigates immediately to /pim/viewEmployeeList with no confirmation dialog
3. Search the Employee List by the Employee Id that was typed (but never saved). - expect: The search returns 0 records ('No Records Found'), proving Cancel created nothing

### 2. Add Employee - successful save and downstream effects (@write)

**Seed:** `tests/seed.spec.ts`

#### 2.1. creates an employee with a punctuated name that lands correctly on Personal Details and is findable by name autocomplete in the Employee List and in Directory

**File:** `tests/pim/add-employee.spec.ts`

**Steps:**

1. Build employee data via `buildEmployee()`, overriding firstName/lastName to include punctuation alongside the usual unique suffix (e.g. "O'Brien-<suffix>"), to combine the 'no character validation' finding with the findability checks below in a single write.
2. Open Add Employee and call `createEmployee(employee)`. - expect: Lands on /pim/viewPersonalDetails/empNumber/<n> - expect: The h6 heading reads '<firstName> <lastName>' exactly - expect: First Name and Last Name inputs hold the punctuated values unchanged
3. Open the Employee List and type the employee's first name into the 'Employee Name' autocomplete. - expect: Exactly one option renders as '<firstName> <lastName>'
4. Open Directory (new `DirectoryPage`) and search its 'Employee Name' autocomplete for the same first name. - expect: Exactly one option renders as '<firstName> <lastName>' - expect: After selecting it and searching, the results line reads '(1) Record Found' and one card shows '<firstName> <lastName>'

#### 2.2. creating an employee with Create Login Details enabled also creates an enabled ESS account visible in Admin > System Users

**File:** `tests/pim/add-employee.spec.ts`

**Steps:**

1. Build employee data via `buildEmployee()` and a unique username/strong password (mirroring `buildEssAccount()`'s complexity rule).
2. Open Add Employee, toggle Create Login Details on, fill Username/Password/Confirm Password (leave Status at its default 'Enabled'), fill First/Last Name, then Save. - expect: Lands on /pim/viewPersonalDetails/empNumber/<n> (same confirmation used by the existing create-employee test) - expect: A POST to /api/v2/admin/users fired during the save, in addition to POST /api/v2/pim/employees
3. Open Admin > System Users and search by the created username. - expect: Exactly one row is returned - expect: Its User Role column reads 'ESS' (there was no role selector on Add Employee, so this is always ESS) - expect: Its Status column reads 'Enabled' - expect: Its Employee Name column reads '<firstName> <lastName>'
