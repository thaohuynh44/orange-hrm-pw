import { test as setup, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { env, routes } from './src/config/env';
import { adminUser } from './src/data/credentials';
import { LoginPage } from './src/pages/login.page';
import { logger } from './src/utils/logger';

/**
 * Logs in once per run and saves the session to `.auth/admin.json`.
 * Authenticated projects load it via `use.storageState`, so no other spec pays
 * the cost of the login form.
 */
setup('authenticate as admin', async ({ page }) => {
  logger.step(`Authenticating as "${adminUser.username}" against ${env.baseUrl}`);

  const loginPage = new LoginPage(page);
  await loginPage.open();
  await loginPage.loginSuccessfully(adminUser.username, adminUser.password);

  await expect(page).toHaveURL(new RegExp(routes.dashboard.replace(/\//g, '\\/')));
  await expect(page.locator('.oxd-userdropdown-name')).toBeVisible();

  fs.mkdirSync(path.dirname(env.storageStatePath), { recursive: true });
  await page.context().storageState({ path: env.storageStatePath });
  logger.info(`Session stored at ${env.storageStatePath}`);
});
