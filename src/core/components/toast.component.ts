import { Locator, Page, expect } from '@playwright/test';

/** The `.oxd-toast` flash message shown after saves, deletes and failures. */
export class ToastComponent {
  readonly root: Locator;
  readonly title: Locator;
  readonly message: Locator;
  /**
   * The same toast narrowed to its outcome variant.
   *
   * Exposed as locators because a spec has to own its own `expect()` (the repo's
   * `playwright/expect-expect` rule), so it needs something assertable rather than a
   * component method that asserts on its behalf.
   */
  readonly success: Locator;
  readonly error: Locator;

  constructor(page: Page) {
    this.root = page.locator('.oxd-toast');
    this.title = this.root.locator('.oxd-text--toast-title');
    this.message = this.root.locator('.oxd-text--toast-message');
    this.success = page.locator('.oxd-toast.oxd-toast--success');
    this.error = page.locator('.oxd-toast.oxd-toast--error');
  }

  async expectSuccess(message?: string | RegExp): Promise<void> {
    await expect(this.success, 'a success toast should be shown').toBeVisible();
    if (message) await expect(this.message).toHaveText(message);
  }

  async expectError(message?: string | RegExp): Promise<void> {
    await expect(this.error, 'an error toast should be shown').toBeVisible();
    if (message) await expect(this.message).toHaveText(message);
  }

  async text(): Promise<string> {
    return (await this.message.innerText()).trim();
  }

  /** Toasts stack and can cover controls; dismiss before the next interaction. */
  async dismiss(): Promise<void> {
    const close = this.root.locator('.oxd-toast-close');
    let remaining = await close.count();

    while (remaining > 0) {
      // The click races the toast's own auto-dismiss, so a target that vanishes first is
      // not a failure - either way the stack has to shrink, which is what we wait on.
      await close
        .first()
        .click()
        .catch(() => undefined);
      await expect
        .poll(() => close.count(), { message: 'the toast stack should shrink' })
        .toBeLessThan(remaining);
      remaining = await close.count();
    }

    await expect(this.root).toHaveCount(0);
  }
}
