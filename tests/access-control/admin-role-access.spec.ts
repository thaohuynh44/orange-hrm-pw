import { test, expect } from '../../src/fixtures/test.fixture';
import { routes } from '../../src/config/env';

/**
 * Role-based access, Admin side - the mirror of `ess-role-access.spec.ts`.
 *
 * Every test here is the positive half of something that suite asserts is denied. Neither
 * half means much alone: a 403 for ESS only proves a restriction if the same URL opens for
 * an Admin, and an Admin screen only proves a privilege if somebody else is turned away
 * from it. Change the two files together.
 *
 * Unlike its ESS counterpart this one needs no provisioned account, so it is read-only,
 * stays in `npm run test:readonly`, and has no reason to run serial.
 *
 * Not repeated here because `tests/dashboard/dashboard.spec.ts` already asserts it for an
 * Admin session: all twelve side-menu modules, including the four ESS is denied.
 */

/** Fields the app gates by role on Personal Details - open for Admin, locked for ESS. */
const ROLE_GATED_FIELDS = ['Employee Id', "Driver's License Number", 'Date of Birth'] as const;

test.describe('Admin session - top bar', { tag: '@admin' }, () => {
  test.beforeEach(async ({ dashboardPage }) => {
    await dashboardPage.open();
  });

  test('top bar shows the Upgrade prompt', { tag: '@smoke' }, async ({ dashboardPage }) => {
    await expect(dashboardPage.topBar.upgradeButton).toBeVisible();
  });

  test('user menu offers About, Support, Change Password and Logout', async ({ dashboardPage }) => {
    const items = await dashboardPage.topBar.userMenuItems();

    // Fixed app chrome rather than fluctuating demo data, so the exact set is fair to pin.
    // The ESS suite asserts this same set, because the menu does not vary by role.
    expect(items).toHaveLength(4);
    expect(items.sort()).toEqual(['About', 'Change Password', 'Logout', 'Support']);
  });
});

test.describe('Admin session - permitted routes', { tag: '@admin' }, () => {
  test('System Users is served, and queries the users API', async ({ page }) => {
    // The exact inverse of the ESS assertion: there the screen is refused in place and the
    // users API is never called, so calling it is what proves the privilege was honoured.
    const usersApi = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v2/admin/users') &&
        response.request().method() === 'GET' &&
        response.ok(),
    );

    const response = await page.goto(routes.systemUsers);

    expect(response?.status()).toBe(200);
    expect(page.url()).toContain('/admin/viewSystemUsers');
    await expect(page.getByText('Credential Required')).toHaveCount(0);
    await usersApi;
  });

  test('Employee List is served, with a populated grid', async ({ page, employeeListPage }) => {
    const response = await page.goto(routes.employeeList);

    expect(response?.status()).toBe(200);
    await expect(page.getByText('Credential Required')).toHaveCount(0);

    // ESS is refused this route with zero rows rendered; Admin gets the real grid.
    await employeeListPage.expectLoaded();
    expect(await employeeListPage.rowCount()).toBeGreaterThan(0);
  });

  test('a second Admin screen (Job Titles) opens via direct URL, with no refusal', async ({
    page,
    chromeFor,
  }) => {
    // Job Titles rather than another System Users check: a second, unrelated Admin screen is
    // what proves the permission is role-wide instead of special-cased to one route.
    const jobTitlesApi = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v2/admin/job-titles') &&
        response.request().method() === 'GET' &&
        response.ok(),
    );

    const response = await page.goto(routes.jobTitles);

    expect(response?.status(), 'Admin should not be refused an Admin screen').not.toBe(403);
    expect(response?.ok()).toBe(true);
    await jobTitlesApi;

    // Breadcrumb renders as "Admin\nJob" here - not "Admin / Job Titles" as one might guess.
    await chromeFor(page).topBar.expectHeader('Admin');
    await expect(page.getByRole('heading', { name: /Job Titles/i }).first()).toBeVisible();
    await expect(page.getByText('Credential Required')).toHaveCount(0);
  });

  test('Maintenance asks an Admin to re-authenticate rather than refusing', async ({ page }) => {
    const response = await page.goto(routes.maintenance);

    // The redirect itself is not the restriction - both roles are bounced to Purge Records.
    // What differs is what waits there: ESS gets "Credential Required", an Admin gets a
    // credential *re-validation* form guarding a critical function.
    expect(response?.status()).toBe(200);
    expect(page.url()).toContain('/maintenance/purgeEmployee');
    await expect(page.getByText('Credential Required')).toHaveCount(0);
    await expect(page.getByText('Administrator Access')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Confirm' })).toBeVisible();
  });

  test('Recruitment is served to an Admin session', async ({ page, chromeFor }) => {
    // Asserted through a real navigation, which the ESS counterpart cannot do: the demo
    // answers that route with a 500 and an empty body for ESS, failing `goto` outright, so
    // the ESS half has to fall back to `page.request`.
    const response = await page.goto(routes.recruitment);

    expect(response?.status()).toBe(200);
    expect(page.url()).toContain('/recruitment/viewCandidates');
    await expect(page.getByText('Credential Required')).toHaveCount(0);
    await chromeFor(page).topBar.expectHeader('Recruitment');
  });
});

/**
 * My Info is the one screen both roles reach, which makes it the cleanest place to see
 * role-gated *actions* rather than role-gated navigation.
 */
test.describe('Admin session - My Info permissions', { tag: ['@admin', '@my-info'] }, () => {
  test.beforeEach(async ({ myInfoPage }) => {
    await myInfoPage.open();
  });

  test('Personal Details identity fields are editable for their Admin owner', async ({
    myInfoPage,
  }) => {
    for (const label of ROLE_GATED_FIELDS) {
      await expect(
        myInfoPage.fieldByLabel(label),
        `${label} should be editable for an Admin session`,
      ).toBeEnabled();
    }

    // Sanity check that the screen is not globally locked, which would make the
    // assertions above pass for the wrong reason.
    await expect(myInfoPage.firstNameInput).toBeEnabled();
    await expect(myInfoPage.lastNameInput).toBeEnabled();
  });

  /**
   * Boundary case, not a role case. Verified on both an Admin's own record and an ESS
   * user's: My Info renders Job and Salary read-only for *every* role, so the ESS suite must
   * not claim its read-only Job tab as an access-control restriction. An editable Job/Salary
   * view only exists through PIM's employee record - a route ESS cannot reach at all, which
   * is what the permitted-routes suite above covers from the Admin side.
   */
  test('Job and Salary tabs are read-only even for the record owner', async ({ myInfoPage }) => {
    await myInfoPage.openTab('Job');

    await expect(myInfoPage.fieldByLabel('Joined Date')).toBeDisabled();
    await expect(myInfoPage.saveButtons).toHaveCount(0);

    await myInfoPage.openTab('Salary');

    await expect(myInfoPage.page.getByRole('button', { name: 'Add' })).toHaveCount(0);
  });
});
