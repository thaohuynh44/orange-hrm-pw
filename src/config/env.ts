import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env'), quiet: true });

/** Reads a required string, failing loudly at load time rather than mid-test. */
function str(key: string, fallback?: string): string {
  const value = process.env[key]?.trim() || fallback;
  if (value === undefined) {
    throw new Error(
      `Missing required environment variable "${key}". Copy .env.example to .env and fill it in.`,
    );
  }
  return value;
}

function int(key: string, fallback: number): number {
  const raw = process.env[key]?.trim();
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Environment variable "${key}" must be a number, received "${raw}".`);
  }
  return parsed;
}

function bool(key: string, fallback: boolean): boolean {
  const raw = process.env[key]?.trim().toLowerCase();
  if (!raw) return fallback;
  return ['1', 'true', 'yes'].includes(raw);
}

export const isCI = bool('CI', false);

export const env = {
  isCI,

  baseUrl: str('BASE_URL', 'https://opensource-demo.orangehrmlive.com'),

  /** Public demo credentials - see README for the shared-environment caveats. */
  admin: {
    username: str('ADMIN_USERNAME', 'Admin'),
    password: str('ADMIN_PASSWORD', 'admin123'),
  },

  headless: bool('HEADLESS', true),
  slowMo: int('SLOW_MO', 0),
  workers: int('WORKERS', isCI ? 2 : 4),
  retries: int('RETRIES', isCI ? 2 : 1),

  timeouts: {
    action: int('ACTION_TIMEOUT', 15_000),
    navigation: int('NAVIGATION_TIMEOUT', 45_000),
    expect: int('EXPECT_TIMEOUT', 10_000),
    test: int('TEST_TIMEOUT', 90_000),
    /**
     * Budget for the demo committing to a state of its own accord - the OXD spinner
     * clearing, a grid settling on a count, a form finishing its post-mount XHR fill.
     * Longer than `expect` because none of those are user-driven, shorter than a
     * navigation because no round trip to a new page is involved.
     */
    settle: int('SETTLE_TIMEOUT', 30_000),
  },

  trace: str('TRACE', 'on-first-retry') as 'on' | 'off' | 'retain-on-failure' | 'on-first-retry',

  /** Where global.setup.ts parks the authenticated storage state. */
  storageStatePath: path.resolve(__dirname, '../../.auth/admin.json'),
} as const;

/** App routes, kept in one place so specs never hard-code URLs. */
export const routes = {
  login: '/web/index.php/auth/login',
  dashboard: '/web/index.php/dashboard/index',
  employeeList: '/web/index.php/pim/viewEmployeeList',
  addEmployee: '/web/index.php/pim/addEmployee',
  myInfo: '/web/index.php/pim/viewMyDetails',
  /** An employee's own Personal Details tab, which is keyed by the app's internal record id. */
  personalDetails: (empNumber: string) =>
    `/web/index.php/pim/viewPersonalDetails/empNumber/${empNumber}`,
  systemUsers: '/web/index.php/admin/viewSystemUsers',
  addUser: '/web/index.php/admin/saveSystemUser',
  directory: '/web/index.php/directory/viewDirectory',
  jobTitles: '/web/index.php/admin/viewJobTitleList',
  maintenance: '/web/index.php/maintenance/viewMaintenanceModule',
  recruitment: '/web/index.php/recruitment/viewRecruitmentModule',
} as const;
