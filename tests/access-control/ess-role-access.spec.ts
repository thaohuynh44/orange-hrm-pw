import { test, expect } from '../../src/fixtures/test.fixture';
import { routes } from '../../src/config/env';

/**
 * Role-based access, ESS side.
 *
 * Every test here needs an ESS login, and the demo publishes none - so the `essUser`
 * fixture provisions one. Two consequences shape this file:
 *
 *  - It is `@write`. It creates an employee and a user account it cannot delete, so it is
 *    excluded from `npm run test:readonly`.
 *  - It runs **serial**. That pins the whole file to one worker, so a run provisions exactly
 *    one account instead of one per worker. This is resource sharing, not a journey - each
 *    test still asserts its own independent thing; they only share the login.
 *
 * The Admin counterparts all live in `admin-role-access.spec.ts` beside this file. The coverage is
 * the contrast between the pairs, so the two halves should be read together.
 */
test.describe.configure({ mode: 'serial', timeout: 240_000 });

/** Modules the ESS role must never be offered. */
const FORBIDDEN_MODULES = ['Admin', 'PIM', 'Recruitment', 'Maintenance'];

/** Modules the ESS role must keep. */
const PERMITTED_MODULES = [
  'Leave',
  'Time',
  'My Info',
  'Performance',
  'Dashboard',
  'Directory',
  'Claim',
  'Buzz',
];

/** Fields Personal Details locks for ESS - the Admin suite asserts these same three open. */
const ROLE_GATED_FIELDS = ['Employee Id', "Driver's License Number", 'Date of Birth'] as const;

test.describe('ESS session - provisioning', { tag: ['@admin', '@pim', '@write'] }, () => {
  test('the provisioned account is listed as an enabled ESS user', async ({
    essUser,
    systemUsersPage,
  }) => {
    // Verifies the fixture's own contract once, so a later failure in this file reads as
    // "the ESS role is wrong" rather than "the account was never created properly".
    await systemUsersPage.open();
    const rows = await systemUsersPage.searchByUsername(essUser.credentials.username);

    expect(rows, `account ${essUser.credentials.username} should exist`).toHaveLength(1);
    expect(rows[0].userRole).toBe('ESS');
    expect(rows[0].status).toBe('Enabled');
  });
});

test.describe('ESS session - side menu and top bar', { tag: '@write' }, () => {
  test('side menu exposes only the ESS-permitted modules', async ({ essDashboardPage }) => {
    const modules = await essDashboardPage.sideMenu.moduleNames();

    // Deliberately wider than the hire-to-ESS journey, which checks Admin and PIM only.
    // Enumerating all four hidden and all eight visible modules means a regression in any
    // single module's permission fails here - that breadth is why this earns its own test.
    for (const module of FORBIDDEN_MODULES) {
      expect(modules, `ESS must not be offered ${module}`).not.toContain(module);
    }
    for (const module of PERMITTED_MODULES) {
      expect(modules, `ESS should still have ${module}`).toContain(module);
    }
  });

  test('top bar hides Upgrade but keeps the same user menu as Admin', async ({
    essDashboardPage,
  }) => {
    await expect(essDashboardPage.topBar.upgradeButton).toHaveCount(0);

    // Identical to the Admin session's menu. Asserted explicitly because it is tempting to
    // assume the user menu narrows by role - it does not.
    const items = await essDashboardPage.topBar.userMenuItems();
    expect(items).toHaveLength(4);
    expect(items.sort()).toEqual(['About', 'Change Password', 'Logout', 'Support']);
  });
});

test.describe('ESS session - restricted routes', { tag: '@write' }, () => {
  test('System Users is refused in place with Credential Required', async ({ essPage }) => {
    // Overlaps the journey's assertion on this URL on purpose: this one additionally pins
    // the status code, that the URL does not change, and that no backing API call fires,
    // and it fails fast without running a six-step hire-to-ESS journey first.
    const apiCalls: string[] = [];
    essPage.on('request', (request) => {
      if (request.url().includes('/api/v2/admin/users')) apiCalls.push(request.url());
    });
    const response = await essPage.goto(routes.systemUsers);

    expect(response?.status()).toBe(403);
    expect(essPage.url()).toContain('/admin/viewSystemUsers');
    await expect(essPage.getByText('Credential Required')).toBeVisible();
    expect(apiCalls, 'a refused screen should not query the users API').toHaveLength(0);
  });

  test('Employee List is refused the same way', async ({ essPage, chromeFor }) => {
    const response = await essPage.goto(routes.employeeList);

    expect(response?.status()).toBe(403);
    expect(essPage.url()).toContain('/pim/viewEmployeeList');
    await expect(essPage.getByText('Credential Required')).toBeVisible();
    await chromeFor(essPage).grid.expectNoRows();
  });

  test('a second Admin screen (Job Titles) is refused the same way', async ({ essPage }) => {
    // Proves the refusal is role-wide across Admin screens rather than special-cased to
    // System Users - the Admin suite asserts this same URL opens for an Admin session.
    const response = await essPage.goto(routes.jobTitles);

    expect(response?.status()).toBe(403);
    await expect(essPage.getByText('Credential Required')).toBeVisible();
  });

  test('Maintenance redirects to Purge Records before being refused', async ({
    essPage,
    chromeFor,
  }) => {
    const response = await essPage.goto(routes.maintenance);

    // The one route in this suite that refuses *after* a redirect rather than in place.
    expect(essPage.url()).toContain('/maintenance/purgeEmployee');
    expect(response?.status()).toBe(403);
    await chromeFor(essPage).topBar.expectHeader('Maintenance');
    await expect(essPage.getByText('Credential Required')).toBeVisible();
  });

  test('Recruitment is not served to an ESS session', async ({ essPage }) => {
    // Requested rather than navigated: the demo currently answers this route with a 500 and
    // an empty body for ESS, which makes `page.goto` fail the navigation outright
    // (net::ERR_HTTP_RESPONSE_CODE_FAILURE) instead of rendering a refusal.
    //
    // The assertion is the access-control contract - ESS is not served the module - rather
    // than the specific status, because that 500 looks like an app defect, not an intended
    // response. This passes today and still passes once the app returns a proper 403.
    const response = await essPage.request.get(routes.recruitment, {
      maxRedirects: 0,
      failOnStatusCode: false,
    });

    expect(response.ok(), 'ESS must not be served the Recruitment module').toBe(false);
  });
});

test.describe('ESS session - My Info permissions', { tag: ['@my-info', '@write'] }, () => {
  test('My Info resolves to the ESS user’s own record', async ({ essMyInfoPage, essUser }) => {
    await essMyInfoPage.open();

    await expect(essMyInfoPage.page).toHaveURL(
      new RegExp(`viewPersonalDetails/empNumber/${essUser.employee.empNumber}`),
    );
    // Not asserted anywhere else: the breadcrumb names the module, never "My Info".
    await expect(essMyInfoPage.topBar.breadcrumb).toContainText('PIM');
  });

  test('Personal Details locks the role-gated identity fields', async ({ essMyInfoPage }) => {
    await essMyInfoPage.open();

    for (const label of ROLE_GATED_FIELDS) {
      await expect(
        essMyInfoPage.fieldByLabel(label),
        `${label} should be locked for an ESS session`,
      ).toBeDisabled();
    }

    // The direct contrast with the Admin suite, which finds these same three enabled.
    // The rest of the tab stays editable, so this is field-level gating, not a locked screen.
    await expect(essMyInfoPage.firstNameInput).toBeEnabled();
    await expect(essMyInfoPage.lastNameInput).toBeEnabled();
    await expect(essMyInfoPage.saveButtons.first()).toBeVisible();
  });

  test('the read-only Job tab is not an ESS restriction', async ({ essMyInfoPage }) => {
    await essMyInfoPage.open();
    await essMyInfoPage.openTab('Job');

    // Matches the Admin suite's boundary case exactly: My Info renders Job read-only for
    // every role. Asserted here so nobody later mistakes it for role-based gating.
    await expect(essMyInfoPage.saveButtons).toHaveCount(0);
  });
});
