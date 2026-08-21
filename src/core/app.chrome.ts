import { Page } from '@playwright/test';
import { SideMenuComponent } from './components/side-menu.component';
import { TopBarComponent } from './components/top-bar.component';
import { ToastComponent } from './components/toast.component';
import { GridComponent } from './components/grid.component';

/**
 * The furniture every authenticated screen shares, bundled so it can be bound to any
 * `Page` rather than only to a page object.
 *
 * `BasePage` exposes these to page objects. The `chromeFor` fixture hands the same bundle
 * to a spec holding a bare page - a second session, or a route asserted to be refused,
 * where there is no screen worth a page object of its own but the breadcrumb and the grid
 * still have to be read without naming an `.oxd-*` class in the test.
 */
export class AppChrome {
  readonly sideMenu: SideMenuComponent;
  readonly topBar: TopBarComponent;
  readonly toast: ToastComponent;
  readonly grid: GridComponent;

  constructor(page: Page) {
    this.sideMenu = new SideMenuComponent(page);
    this.topBar = new TopBarComponent(page);
    this.toast = new ToastComponent(page);
    this.grid = new GridComponent(page);
  }
}
