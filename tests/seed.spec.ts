import { test, expect } from '../src/fixtures/test.fixture';

/**
 * Seed file for the Playwright agents (planner / generator / healer).
 *
 * The MCP `*_setup_page` tools run this test to establish the starting environment before
 * exploring or generating, so it must leave the browser signed in and sitting on the
 * dashboard. It runs in the `chromium` project, which already carries the stored admin
 * session from global.setup.ts - so there is no login step here by design.
 *
 * Keep this test green and keep it cheap. Generate code inside the marked block when
 * exploring interactively; do not commit generated code here.
 */
test.describe('Agent seed', { tag: '@seed' }, () => {
  test('lands signed in on the dashboard', async ({ dashboardPage, page }) => {
    await dashboardPage.open();

    // generate code here.

    await expect(page).toHaveURL(/dashboard\/index/);
  });
});
