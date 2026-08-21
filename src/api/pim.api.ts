import type { APIRequestContext } from '@playwright/test';

/** An employee as `/api/v2/pim/employees/<empNumber>` returns them. */
export interface EmployeeRecord {
  empNumber: number;
  firstName: string;
  middleName: string;
  lastName: string;
  employeeId: string;
  terminationId: number | null;
}

/** The same record with the fields the Personal Details screen owns. */
export interface PersonalDetailsRecord extends EmployeeRecord {
  otherId: string;
  drivingLicenseNo: string;
  drivingLicenseExpiredDate: string | null;
}

/** Status plus the parsed `data` envelope, so callers can assert on a refusal too. */
export interface ApiResult<T> {
  status: number;
  data: T | null;
}

/**
 * Read-only PIM REST client, used to verify from the API what a journey just did
 * through the UI.
 *
 * It is constructed from `page.request`, so it travels on the same authenticated
 * session as the browser and needs no separate login.
 */
export class EmployeeApi {
  private static readonly BASE = '/web/index.php/api/v2/pim';

  constructor(private readonly request: APIRequestContext) {}

  private async fetch<T>(path: string): Promise<ApiResult<T>> {
    const response = await this.request.get(`${EmployeeApi.BASE}${path}`);
    return {
      status: response.status(),
      data: response.ok() ? ((await response.json()).data as T) : null,
    };
  }

  async getEmployee(empNumber: string): Promise<ApiResult<EmployeeRecord>> {
    return this.fetch<EmployeeRecord>(`/employees/${empNumber}`);
  }

  async getPersonalDetails(empNumber: string): Promise<ApiResult<PersonalDetailsRecord>> {
    return this.fetch<PersonalDetailsRecord>(`/employees/${empNumber}/personal-details`);
  }

  /** Employee-id search, mirroring the filter the Employee List grid sends. */
  async findByEmployeeId(
    employeeId: string,
  ): Promise<{ status: number; total: number; records: EmployeeRecord[] }> {
    const response = await this.request.get(
      `${EmployeeApi.BASE}/employees?limit=50&offset=0&employeeId=${encodeURIComponent(employeeId)}`,
    );
    const body = await response.json();
    return {
      status: response.status(),
      total: body.meta?.total ?? 0,
      records: (body.data ?? []) as EmployeeRecord[],
    };
  }
}
