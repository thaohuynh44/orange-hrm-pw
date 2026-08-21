import { Locator, expect } from '@playwright/test';
import { BasePage } from '../core/base.page';
import { routes } from '../config/env';

export class DashboardPage extends BasePage {
  protected readonly path = routes.dashboard;

  readonly widgets: Locator = this.page.locator('.orangehrm-dashboard-widget');
  readonly widgetTitles: Locator = this.page.locator('.orangehrm-dashboard-widget-name');
  readonly quickLaunchButtons: Locator = this.page.locator('.orangehrm-quick-launch-icon');

  override async expectLoaded(): Promise<void> {
    await this.topBar.expectHeader('Dashboard');
    await expect(this.widgetTitles.first()).toBeVisible();
  }

  async widgetNames(): Promise<string[]> {
    return (await this.widgetTitles.allInnerTexts()).map((t) => t.trim());
  }

  widget(name: string): Locator {
    return this.widgets.filter({ hasText: name }).first();
  }

  async expectWidgetVisible(name: string): Promise<void> {
    await expect(this.widget(name)).toBeVisible();
  }
}
