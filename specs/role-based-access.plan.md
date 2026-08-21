# Role-Based Access: Admin vs ESS on the OrangeHRM Demo

## Application Overview

Feature-level checks of what an Admin-role session and an ESS-role session can each see and do on the public OrangeHRM demo (https://opensource-demo.orangehrmlive.com), going wider than the single existing journey `tests/flows/hire-to-ess-access.flow.spec.ts` (which only asserts three seams: side menu omits Admin/PIM, `viewSystemUsers` shows "Credential Required" with 0 `.oxd-table-card` rows, and My Info resolves to the ESS user's own empNumber).

Ground truth gathered live during planning (chromium, OrangeHRM OS 5.9, 2026-08-20):

- Admin side menu (12 items, already fully covered by `tests/dashboard/dashboard.spec.ts` "lists every navigable module" — NOT re-planned here): Admin, PIM, Leave, Time, Recruitment, My Info, Performance, Dashboard, Directory, Maintenance, Claim, Buzz.
- ESS side menu (8 items, confirmed live): Leave, Time, My Info, Performance, Dashboard, Directory, Claim, Buzz. Omits Admin, PIM, Recruitment, Maintenance.
- The top-bar user dropdown menu (`.oxd-userdropdown-link`) is IDENTICAL for both roles: About, Support, Change Password, Logout. This is a real finding worth asserting explicitly (it would be easy to wrongly assume it differs by role).
- The "Upgrade" link/button in the top-bar banner is shown for Admin on every screen checked (Dashboard, System Users, Add Employee, Add User, My Info) and is absent for ESS on every screen checked (Dashboard, My Info). Not covered by any existing spec.
- Direct navigation to an admin-only or PIM-only route as ESS: the app returns HTTP 403, renders the module's own breadcrumb (e.g. "Admin / User Management" or "PIM"), shows the exact string "Credential Required" in an `.oxd-alert`-like banner, and fires no backing `/api/v2/...` request. Verified on `/admin/viewSystemUsers` (already covered by the flow — kept here only as a finer-grained, standalone-runnable feature check), `/pim/viewEmployeeList`, `/admin/viewJobTitleList`, and `/pim/addEmployee`. The URL does NOT change for any of these four.
- `/maintenance/viewMaintenanceModule` is the one exception found: as ESS it redirects to `/maintenance/purgeEmployee` (breadcrumb "Maintenance / Purge Records") and is refused there — i.e. refusal-after-redirect rather than refusal-in-place. Not covered anywhere else.
- `/recruitment/viewRecruitmentModule` as ESS causes Chromium's navigation itself to fail (`net::ERR_HTTP_RESPONSE_CODE_FAILURE`) because the server answers HTTP 500 with an empty body (confirmed twice via `page.request` with `maxRedirects: 0`, headers `content-length: 0`). This is flagged UNVERIFIED AS STABLE — it looks like an app/environment quirk on the shared demo rather than an intentional access-control response, so the case below is written to be resilient (uses `page.request`, not `page.goto`) and is explicitly not a hard release-blocking assertion.
- My Info (`/pim/viewMyDetails` → `/pim/viewPersonalDetails/empNumber/<n>`) is reachable by both roles and always resolves to the signed-in user's own empNumber (Admin: empNumber 7 in this session; the ESS account created below: empNumber 220). The breadcrumb on My Info reads the module name "PIM", never "My Info" — an existing quirk, but not asserted anywhere yet for the breadcrumb specifically.
- On My Info's Personal Details tab, three inputs are `disabled` for the ESS session (Employee Id, Driver's License Number, Date of Birth) but NOT disabled for the Admin session viewing their own record. First Name/Middle Name/Last Name/Nickname/Military Service/the Smoker checkbox/Nationality/Marital Status selects are enabled for both. This is the cleanest same-screen, role-gated-actions example found.
- My Info's Job and Salary tabs are read-only for BOTH roles when viewed via My Info (no Save button on Job; no "Add" button and no row-selection checkbox column on Salary's "Assigned Salary Components" or its Attachments table) — confirmed for Admin's own record (empNumber 7) and for the ESS record (empNumber 220). This is NOT a role difference and the plan includes one boundary-clarifying case to prevent a future false claim that ESS's read-only Job/Salary tabs are role-specific. Admin only gets an _editable_ Job/Salary view of the same employee by going through PIM's employee record instead of My Info — a route ESS cannot reach at all (see the restricted-routes suite).
- Confirmed `/api/v2/...` calls: System Users search — `/api/v2/admin/users` (already in `SystemUsersPage`); Job Titles grid — `/api/v2/admin/job-titles?limit=50&offset=0&sortField=jt.jobTitleName&sortOrder=ASC`; My Info Personal Details — `/api/v2/pim/employees/<empNumber>`, `/api/v2/pim/employees/<empNumber>/personal-details`, `/api/v2/pim/employees/<empNumber>/custom-fields?screen=personal`, `/api/v2/pim/employees/<empNumber>/screen/personal/attachments?limit=50&offset=0`.

One ESS account was created during planning to obtain this ground truth (employee "RoleQaXK4P9 ExploreXK4P9", empNumber 220, username `ess.roleqa4p9`) and no more than one should ever be created by the resulting suite — see the provisioning suite below. `src/config/env.ts`'s `routes` map will need three additions before these specs can be written: `jobTitles: '/web/index.php/admin/viewJobTitleList'`, `maintenance: '/web/index.php/maintenance/viewMaintenanceModule'`, `recruitment: '/web/index.php/recruitment/viewRecruitmentModule'`. A new `tests/access-control/` directory is proposed for the cross-module, role-crossing suites (provisioning + all ESS-session suites); the Admin-only suites stay under the existing `tests/admin/` and `tests/my-info/`.

Because the repo forbids creating more than one ESS account for this plan, and Playwright specs should stay independent of each other, implement the provisioning suite's outcome as a **shared test fixture** (e.g. a file- or worker-scoped `provisionedEssAccount` fixture that runs `hireEmployee` + `grantEssAccess` once and returns `{ credentials, empNumber, fullName }`) rather than letting later spec files depend on another spec file having run first. The "ESS account provisioning" suite below still describes the one-time action as its own test (so its own contract — the row appears in System Users as Enabled ESS — is verified once) but every other ESS suite is written against that fixture's output, not against test-execution order.

## Test Scenarios

### 1. Admin session — top bar and user menu surface

**Seed:** `tests/seed.spec.ts`

#### 1.1. top bar shows the Upgrade prompt for an Admin session

**File:** `tests/admin/admin-topbar-user-menu.spec.ts`

**Steps:**

1. Starting already authenticated as Admin (no login step), open the dashboard via dashboardPage.open(). - expect: Dashboard loads (existing expectLoaded contract only, not re-asserted here).
2. Locate the 'Upgrade' link/button in the top-bar banner (next to the breadcrumb). - expect: The Upgrade link is visible for the Admin session. - expect: Tag suggestion: @admin @smoke.

#### 1.2. user menu offers About, Support, Change Password and Logout

**File:** `tests/admin/admin-topbar-user-menu.spec.ts`

**Steps:**

1. On the dashboard, open the top-bar user dropdown via topBar.userMenuItems() (or equivalent). - expect: The returned item texts are exactly ['About', 'Support', 'Change Password', 'Logout'] in any order. - expect: The list has length 4 — assert the shape (4 items, these exact strings), not an arbitrary superset, since this is fixed app chrome rather than fluctuating demo data. - expect: Tag suggestion: @admin.

### 2. Admin session — reaching admin-only screens directly

**Seed:** `tests/seed.spec.ts`

#### 2.1. a second admin-only screen (Job Titles) opens for Admin via direct URL, no refusal

**File:** `tests/admin/admin-only-routes.spec.ts`

**Steps:**

1. Add `jobTitles: '/web/index.php/admin/viewJobTitleList'` to the routes map, then navigate directly to it as the already-authenticated Admin. - expect: The navigation response status is not 403 (i.e. ok()). - expect: The breadcrumb reads 'Admin' (and the sub-breadcrumb for Job Titles, exact string to be confirmed against the live app at implementation time — record it rather than guessing). - expect: The page does not contain the string 'Credential Required'. - expect: A request to /api/v2/admin/job-titles fires (assert via withApiResponse or by inspecting the request list) and the grid renders at least one row OR the empty-state, i.e. some rendered content beyond a blank shell. - expect: Tag suggestion: @admin.

### 3. Admin's My Info — field-level editability and the Job/Salary read-only boundary

**Seed:** `tests/seed.spec.ts`

#### 3.1. Personal Details identity fields are editable for the signed-in Admin viewing their own record

**File:** `tests/my-info/my-info-field-permissions.spec.ts`

**Steps:**

1. Open My Info (myInfoPage.open()); stay on the default Personal Details tab. - expect: Page is loaded per MyInfoPage.expectLoaded() (not re-asserted as this test's own point).
2. Locate the Employee Id input (myInfoPage.fieldByLabel('Employee Id')), the Driver's License Number input, and the Date of Birth input. - expect: None of the three inputs has the `disabled` attribute for the Admin session. - expect: First Name, Middle Name, Last Name, Nickname, Military Service inputs and the Smoker checkbox are also not disabled (sanity check that the screen isn't globally locked). - expect: Tag suggestion: @admin @my-info.

#### 3.2. Job and Salary tabs render read-only even for the record's own Admin owner

**File:** `tests/my-info/my-info-field-permissions.spec.ts`

**Steps:**

1. From My Info, open the Job tab (myInfoPage.openTab('Job')). - expect: The 'Joined Date' input carries the `disabled` attribute. - expect: There is no visible Save button in the Job Details panel. - expect: Job Title / Job Category / Sub Unit / Location / Employment Status render as plain text, not as an interactive OXD select (no clickable combobox affordance).
2. Open the Salary tab (myInfoPage.openTab('Salary')). - expect: There is no 'Add' button next to the 'Assigned Salary Components' heading. - expect: The Assigned Salary Components table has no leading row-selection checkbox column. - expect: This same read-only rendering was independently confirmed on the ESS account during exploration — record this as a boundary note in the test file: My Info's Job/Salary tabs are read-only for every role, so the ESS suite below must not re-claim this as an access-control restriction. The only way to get an editable Job/Salary view of an employee is via PIM's employee record, a path ESS cannot reach at all (see the restricted-routes suite). - expect: Tag suggestion: @admin @my-info.

### 4. ESS account provisioning for role exploration (write, exactly once)

**Seed:** `tests/seed.spec.ts`

#### 4.1. Admin hires an employee and grants them an enabled ESS account

**File:** `tests/access-control/ess-provisioning.spec.ts`

**Steps:**

1. WRITE. Using addEmployeePage, hire one employee via buildEmployee() (unique-suffixed names) through PIM > Add Employee. - expect: The save redirects to /pim/viewPersonalDetails/empNumber/<n>; capture <n> as empNumber.
2. Using addUserPage, go to Admin > User Management > Add User, select User Role 'ESS', pick the just-created employee by autocomplete, set Status 'Enabled', fill a generated username/password (buildEssAccount()), and save. - expect: The save redirects to /admin/viewSystemUsers. - expect: Searching System Users by the new username returns exactly one row with User Role 'ESS' and Status 'Enabled'.
3. Implementation note (not a runtime step): wrap this exact sequence in a shared, file- or worker-scoped fixture (e.g. `provisionedEssAccount`) returning { credentials, empNumber, fullName }, so the suites below consume the fixture rather than depending on this spec file having executed first. - expect: No additional employee or ESS account is ever created beyond this single one for the whole role-based-access suite — verify this constraint at code-review time, not with a runtime assertion. - expect: Tag suggestion: @admin @pim @write.

### 5. ESS session — side menu and top bar surface (depends on the provisioned ESS account)

**Seed:** `tests/seed.spec.ts`

#### 5.1. side menu exposes only the ESS-permitted modules

**File:** `tests/access-control/ess-side-menu-topbar.spec.ts`

**Steps:**

1. WRITE-DEPENDENT (uses the account from the provisioning suite/fixture, creates no new data itself). In a fresh signed-out context (the `secondSession` fixture), sign in as the provisioned ESS account and land on its dashboard. - expect: Sign-in succeeds and lands on /dashboard/index.
2. Read the side menu module names via sideMenu.moduleNames(). - expect: The list does NOT contain 'Admin', 'PIM', 'Recruitment', or 'Maintenance'. - expect: The list DOES contain 'Leave', 'Time', 'My Info', 'Performance', 'Dashboard', 'Directory', 'Claim', 'Buzz'. - expect: This is deliberately broader than the flow's two-entry check (Admin/PIM only): it enumerates all four modules that must stay hidden and all eight that must stay visible, so a regression in any single module's permission — not just Admin or PIM — fails this test. That breadth is why it earns a place alongside the existing journey rather than duplicating it. - expect: Tag suggestion: @write.

#### 5.2. top bar hides the Upgrade prompt but keeps the same user menu as Admin

**File:** `tests/access-control/ess-side-menu-topbar.spec.ts`

**Steps:**

1. WRITE-DEPENDENT. Using the same signed-in ESS session's dashboard, look for the 'Upgrade' link/button in the top-bar banner. - expect: The Upgrade link/button has a count of 0 for the ESS session — contrast directly with the Admin case in the top-bar suite above, which found it visible.
2. Open the ESS session's user dropdown and read its item texts. - expect: The items are exactly ['About', 'Support', 'Change Password', 'Logout'] — identical to the Admin session's menu. Assert this explicitly: the user menu's contents do not vary by role, which is easy to wrongly assume otherwise. - expect: Tag suggestion: @write.

### 6. ESS session — direct URL access to restricted routes (depends on the provisioned ESS account)

**Seed:** `tests/seed.spec.ts`

#### 6.1. System Users is refused in place with 'Credential Required'

**File:** `tests/access-control/ess-restricted-routes.spec.ts`

**Steps:**

1. WRITE-DEPENDENT. Overlaps deliberately with the flow's assertion on the same URL — kept as its own standalone test because it additionally pins the HTTP status code, confirms the URL does not change, and confirms no backing API call fires, none of which the journey checks; a regression here should fail fast without running the whole hire-to-ESS journey. As the signed-in ESS session, navigate directly (page.goto, not via the side menu) to routes.systemUsers while recording network requests. - expect: The navigation response status is 403. - expect: The page URL is unchanged (still ends in /admin/viewSystemUsers — no redirect). - expect: The page text contains the exact string 'Credential Required'. - expect: Zero requests are made to /api/v2/admin/users.

#### 6.2. Employee List (PIM) is refused the same way

**File:** `tests/access-control/ess-restricted-routes.spec.ts`

**Steps:**

1. WRITE-DEPENDENT. As the signed-in ESS session, navigate directly to routes.employeeList. - expect: The navigation response status is 403. - expect: The page URL is unchanged (still ends in /pim/viewEmployeeList). - expect: The page text contains 'Credential Required'. - expect: There are zero `.oxd-table-card` rows.

#### 6.3. a second Admin-only screen (Job Titles) is refused the same way

**File:** `tests/access-control/ess-restricted-routes.spec.ts`

**Steps:**

1. WRITE-DEPENDENT. As the signed-in ESS session, navigate directly to the newly-added routes.jobTitles ('/web/index.php/admin/viewJobTitleList'). - expect: The navigation response status is 403. - expect: The page text contains 'Credential Required'. - expect: This confirms the refusal is role-wide across Admin screens rather than special-cased to System Users alone — the reason this case earns its place beyond the flow's single System Users check.

#### 6.4. Maintenance redirects to Purge Records before being refused

**File:** `tests/access-control/ess-restricted-routes.spec.ts`

**Steps:**

1. WRITE-DEPENDENT. Add `maintenance: '/web/index.php/maintenance/viewMaintenanceModule'` to the routes map. As the signed-in ESS session, navigate directly to it. - expect: Unlike the three cases above, the URL changes: the app redirects to '/web/index.php/maintenance/purgeEmployee'. - expect: The breadcrumb reads 'Maintenance / Purge Records'. - expect: The navigation response status is still 403 and the page text still contains 'Credential Required' at the landed URL. - expect: Document this explicitly as the one route in this suite where refusal happens after a redirect rather than in place.

#### 6.5. Recruitment fails at the network layer instead of rendering a refusal page (unverified, monitor only)

**File:** `tests/access-control/ess-restricted-routes.spec.ts`

**Steps:**

1. UNVERIFIED AS STABLE BEHAVIOR — reproduced twice during planning but looks like an app/environment quirk on the shared demo (a 500 with an empty body) rather than an intentional access-control response; do not let this block CI. Add `recruitment: '/web/index.php/recruitment/viewRecruitmentModule'` to the routes map. As the signed-in ESS session, request it via `page.request.get(url, { maxRedirects: 0, failOnStatusCode: false })` rather than `page.goto`, to avoid a hard navigation failure (`net::ERR_HTTP_RESPONSE_CODE_FAILURE`) flaking the run. - expect: As observed during planning: response status 500, with `content-length: 0` (empty body). - expect: If a future run instead sees a normal 403 'Credential Required' response like the other routes, treat that as the app quirk having been fixed, update this case to match the standard refusal pattern, and remove the 'unverified' framing — do not silently keep asserting the 500. - expect: Consider tagging this case for quarantine (e.g. skip-on-CI or a soft assertion) rather than a hard release gate given the uncertainty.

### 7. ESS session — My Info renders the same screen with fewer permitted actions (depends on the provisioned ESS account)

**Seed:** `tests/seed.spec.ts`

#### 7.1. My Info resolves to the ESS user's own empNumber and the breadcrumb reads the module, not 'My Info'

**File:** `tests/access-control/ess-my-info-permissions.spec.ts`

**Steps:**

1. WRITE-DEPENDENT. The empNumber-resolution seam itself is already asserted by the flow spec, so it is not restated as this test's headline assertion — it is only the necessary navigation step for what follows. As the signed-in ESS session, navigate to routes.myInfo. - expect: The URL matches /viewPersonalDetails\/empNumber\/<the empNumber captured during provisioning>/. - expect: NEW assertion not made by the flow: the top-bar breadcrumb text reads 'PIM' (the module heading), never 'My Info' — confirms the quirk documented in MyInfoPage/CLAUDE.md from the ESS side too, not just the Admin side.

#### 7.2. Personal Details locks Employee Id, Driver's License Number and Date of Birth for ESS

**File:** `tests/access-control/ess-my-info-permissions.spec.ts`

**Steps:**

1. WRITE-DEPENDENT. On the ESS session's My Info Personal Details tab, locate the same three inputs checked in the Admin My Info suite: Employee Id, Driver's License Number, Date of Birth. - expect: All three inputs carry the `disabled` attribute for the ESS session — the direct contrast with the Admin case, which found them enabled on the same screen for the same tab. - expect: First Name, Last Name, Nickname, Military Service inputs and the Smoker checkbox remain enabled (not globally locked). - expect: A Save button is still rendered on the tab (ESS can still save the fields it's allowed to edit).
2. Open the ESS session's Job tab. - expect: No Save button is present — consistent with the Admin boundary case (Job/Salary are read-only via My Info for every role, not an ESS-specific restriction); this closes the loop rather than mis-attributing the read-only state to role. - expect: Tag suggestion: @write @my-info.
