import { test as base } from '@playwright/test';
import { EmployeeApi } from '../api/pim.api';

/**
 * REST clients, kept apart from the page objects on purpose: these observe the app, they
 * never drive it. A journey uses one to confirm from the API what it just did through the
 * UI; driving the app is the UI's job.
 *
 * Built from `page.request`, so the client rides the browser's authenticated session and
 * needs no login of its own.
 */
export interface ApiFixtures {
  /** Read-only PIM REST client on the browser's own session. */
  employeeApi: EmployeeApi;
}

export const apiTest = base.extend<ApiFixtures>({
  employeeApi: async ({ page }, use) => {
    await use(new EmployeeApi(page.request));
  },
});
