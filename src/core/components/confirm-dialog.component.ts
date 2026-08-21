import { Locator, Page, expect } from '@playwright/test';

/**
 * OXD's destructive-action confirmation modal ("Are you Sure?").
 *
 * It is an in-page dialog, not a native browser one, so it is driven with ordinary
 * locators. The confirm button is deliberately not clicked here without the caller
 * having proven which record is selected first.
 */
export class ConfirmDialogComponent {
  readonly root: Locator;
  readonly title: Locator;
  readonly message: Locator;
  readonly confirmButton: Locator;
  readonly cancelButton: Locator;

  constructor(page: Page) {
    this.root = page.locator('.oxd-dialog-container-default');
    this.title = this.root.getByText('Are you Sure?');
    this.message = this.root.locator('.oxd-text--card-body');
    this.confirmButton = this.root.locator('button', { hasText: 'Yes, Delete' });
    this.cancelButton = this.root.locator('button', { hasText: 'No, Cancel' });
  }

  async expectVisible(): Promise<void> {
    await expect(this.title).toBeVisible();
    await expect(this.confirmButton).toBeVisible();
  }

  async confirm(): Promise<void> {
    await this.confirmButton.click();
  }

  /** Backs out of the deletion and waits for the modal to go away. */
  async dismiss(): Promise<void> {
    await this.cancelButton.click();
    await expect(this.root).toHaveCount(0);
  }
}
