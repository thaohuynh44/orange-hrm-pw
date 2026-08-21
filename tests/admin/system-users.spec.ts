import { test, expect } from '../../src/fixtures/test.fixture';
import { adminUser } from '../../src/data/credentials';

test.describe('Admin - System Users', { tag: '@admin' }, () => {
  test.beforeEach(async ({ systemUsersPage }) => {
    await systemUsersPage.open();
  });

  test('lists system users with their roles', async ({ systemUsersPage }) => {
    expect(await systemUsersPage.recordCount()).toBeGreaterThan(0);

    const rows = await systemUsersPage.allRows();
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.username).not.toBe('');
      expect(['Admin', 'ESS']).toContain(row.userRole);
      expect(['Enabled', 'Disabled']).toContain(row.status);
    }
  });

  test('finds the admin account by username', async ({ systemUsersPage }) => {
    const rows = await systemUsersPage.searchByUsername(adminUser.username);

    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows.map((r) => r.username)).toContain(adminUser.username);
  });

  test('filters by the Admin user role', async ({ systemUsersPage }) => {
    await systemUsersPage.userRole.selectOption('Admin');
    await systemUsersPage.search();

    const rows = await systemUsersPage.allRows();
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.userRole).toBe('Admin');
    }
  });

  test('exposes both user roles as filter options', async ({ systemUsersPage }) => {
    const options = await systemUsersPage.userRole.options();

    expect(options).toEqual(expect.arrayContaining(['Admin', 'ESS']));
  });

  test('an unmatched username yields no records', async ({ systemUsersPage }) => {
    await systemUsersPage.searchByUsername('zzz_no_such_user_zzz');

    await systemUsersPage.expectNoResults();
    expect(await systemUsersPage.recordCount()).toBe(0);
  });
});
