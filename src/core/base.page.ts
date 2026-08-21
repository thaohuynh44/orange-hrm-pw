import { Locator, Page, Response, expect } from '@playwright/test';
import { env } from '../config/env';
import { AppChrome } from './app.chrome';
import { SideMenuComponent } from './components/side-menu.component';
import { TopBarComponent } from './components/top-bar.component';
import { ToastComponent } from './components/toast.component';

/**
 * Shared behaviour for every page object: navigation, the chrome that surrounds
 * each screen (side menu / top bar / toasts) and the OXD loading spinner.
 *
 * Subclasses declare `path` (the route they own) and implement `expectLoaded()`.
 */
export abstract class BasePage {
  readonly chrome: AppChrome;
  readonly sideMenu: SideMenuComponent;
  readonly topBar: TopBarComponent;
  readonly toast: ToastComponent;
  readonly spinner: Locator;

  /** Route owned by this page, relative to `baseURL`. */
  protected abstract readonly path: string;

  constructor(readonly page: Page) {
    this.chrome = new AppChrome(page);
    this.sideMenu = this.chrome.sideMenu;
    this.topBar = this.chrome.topBar;
    this.toast = this.chrome.toast;
    this.spinner = page.locator('.oxd-loading-spinner');
  }

  /** Navigates straight to the page's own route and asserts it rendered. */
  async open(): Promise<this> {
    await this.page.goto(this.path);
    await this.expectLoaded();
    return this;
  }

  /** Every page object proves it is on screen - specs never guess. */
  abstract expectLoaded(): Promise<void>;

  /**
   * The REST call behind a UI action, as a promise to race the action against.
   *
   * `method` is explicit because the two halves need different verbs: reads await the
   * grid's own GET, writes await their PUT or DELETE. The budget is navigation-grade -
   * the demo's slower saves outlive the action timeout a bare `waitForResponse` inherits.
   */
  protected apiResponse(urlPart: string, method = 'GET'): Promise<Response> {
    return this.page.waitForResponse(
      (response) =>
        response.url().includes(urlPart) && response.request().method() === method && response.ok(),
      { timeout: env.timeouts.navigation },
    );
  }

  /**
   * Performs `action` and waits for the GET it triggers, so the next read sees
   * committed data rather than the previous render.
   */
  protected async withApiResponse(urlPart: string, action: () => Promise<void>): Promise<void> {
    await Promise.all([this.apiResponse(urlPart), action()]);
    await this.waitForSpinner();
  }

  /** Waits for the OXD spinner to clear; safe to call when it never appears. */
  async waitForSpinner(): Promise<void> {
    await expect(this.spinner).toHaveCount(0, { timeout: env.timeouts.settle });
  }

  async currentUrl(): Promise<string> {
    return this.page.url();
  }

  async reload(): Promise<void> {
    await this.page.reload();
    await this.expectLoaded();
  }

  async screenshot(name: string): Promise<Buffer> {
    return this.page.screenshot({ path: `test-results/screenshots/${name}.png`, fullPage: true });
  }
}
