import { test, expect } from '../../src/fixtures/test.fixture';

test.describe('My Info', { tag: '@my-info' }, () => {
  test.beforeEach(async ({ myInfoPage }) => {
    await myInfoPage.open();
  });

  test('opens Personal Details for the signed-in user', async ({ myInfoPage, page }) => {
    await expect(page).toHaveURL(/viewPersonalDetails\/empNumber\/\d+/);

    const name = await myInfoPage.fullName();
    expect(name.first).not.toBe('');
    expect(name.last).not.toBe('');
  });

  test('the header name matches the record', async ({ myInfoPage }) => {
    const { first, last } = await myInfoPage.fullName();
    const header = await myInfoPage.topBar.userName.innerText();

    expect(header).toContain(first);
    expect(header).toContain(last);
  });

  test('offers the expected sub-tabs', async ({ myInfoPage }) => {
    const tabs = await myInfoPage.tabNames();

    expect(tabs).toEqual(
      expect.arrayContaining([
        'Personal Details',
        'Contact Details',
        'Emergency Contacts',
        'Dependents',
        'Immigration',
        'Job',
        'Salary',
        'Qualifications',
      ]),
    );
  });

  test('navigating to a sub-tab loads that section', async ({ myInfoPage, page }) => {
    await myInfoPage.openTab('Contact Details');

    await expect(page).toHaveURL(/pim\/contactDetails/);
    await expect(page.getByRole('heading', { name: 'Contact Details' })).toBeVisible();
  });

  test('nationality dropdown lists selectable values', async ({ myInfoPage }) => {
    const options = await myInfoPage.nationality.options();

    expect(options.length).toBeGreaterThan(1);
    expect(options).toContain('-- Select --');
  });

  test('saving personal details confirms with a success toast', async ({ myInfoPage }) => {
    await myInfoPage.savePersonalDetails();

    await expect(myInfoPage.toast.success).toBeVisible();
    await expect(myInfoPage.toast.message).toHaveText('Successfully Updated');
  });
});
