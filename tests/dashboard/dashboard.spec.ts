import { test, expect } from '../../src/fixtures/test.fixture';
import { MODULES } from '../../src/core/components/side-menu.component';

test.describe('Dashboard', { tag: '@smoke' }, () => {
  test.beforeEach(async ({ dashboardPage }) => {
    await dashboardPage.open();
  });

  test('reuses the stored session without hitting the login form', async ({ page, loginPage }) => {
    await expect(page).toHaveURL(/dashboard\/index/);
    await loginPage.expectFormAbsent();
  });

  test('shows the core widgets', async ({ dashboardPage }) => {
    const names = await dashboardPage.widgetNames();

    expect(names).toContain('Time at Work');
    expect(names).toContain('My Actions');
    expect(names).toContain('Quick Launch');
    expect(names.length).toBeGreaterThanOrEqual(5);
  });

  test('lists every navigable module in the side menu', async ({ dashboardPage }) => {
    const modules = await dashboardPage.sideMenu.moduleNames();

    for (const module of MODULES) {
      expect(modules, `"${module}" should be in the side menu`).toContain(module);
    }
  });

  test.describe('Module navigation', () => {
    const destinations = [
      { module: 'PIM', urlPattern: /pim\/viewEmployeeList/, header: 'PIM' },
      { module: 'Admin', urlPattern: /admin\/viewSystemUsers/, header: 'Admin' },
      { module: 'Leave', urlPattern: /leave\/viewLeaveList/, header: 'Leave' },
      { module: 'Time', urlPattern: /time\//, header: 'Time' },
      { module: 'Directory', urlPattern: /directory\/viewDirectory/, header: 'Directory' },
    ] as const;

    for (const { module, urlPattern, header } of destinations) {
      test(`side menu opens ${module}`, async ({ dashboardPage, page }) => {
        await dashboardPage.sideMenu.goTo(module);

        await expect(page).toHaveURL(urlPattern);
        await dashboardPage.topBar.expectHeader(header);
      });
    }
  });

  test('side menu search filters the module list', async ({ dashboardPage }) => {
    await dashboardPage.sideMenu.filter('PIM');

    await expect(dashboardPage.sideMenu.items).toHaveCount(1);
    await expect(dashboardPage.sideMenu.items.first()).toContainText('PIM');
  });
});
