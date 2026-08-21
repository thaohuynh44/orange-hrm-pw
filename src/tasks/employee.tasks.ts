import { expect } from '@playwright/test';
import type { AddEmployeePage } from '../pages/pim/add-employee.page';
import type { EmployeeListPage } from '../pages/pim/employee-list.page';
import type {
  PersonalDetailsPage,
  PersonalDetailsUpdate,
} from '../pages/pim/personal-details.page';
import { buildEmployee } from '../data/employee.factory';

export interface HiredEmployee {
  firstName: string;
  middleName: string;
  lastName: string;
  employeeId: string;
  /** Internal record id the app assigns, taken from the resulting URL. */
  empNumber: string;
  /** The record as employee autocompletes render it: "First [Middle] Last". */
  fullName: string;
}

/**
 * Business action: hire a new employee and return everything later steps need to
 * recognise them (their id for filtering, their empNumber for record checks).
 */
export async function hireEmployee(
  addEmployeePage: AddEmployeePage,
  overrides: Partial<HiredEmployee> = {},
): Promise<HiredEmployee> {
  const employee = buildEmployee(overrides);

  await addEmployeePage.open();
  await addEmployeePage.createEmployee(employee);

  const empNumber = /empNumber\/(\d+)/.exec(addEmployeePage.page.url())?.[1];
  expect(empNumber, 'the app should assign an empNumber after hiring').toBeTruthy();

  return {
    ...employee,
    empNumber: empNumber as string,
    fullName: [employee.firstName, employee.middleName, employee.lastName]
      .filter(Boolean)
      .join(' '),
  };
}

/** Business action: confirm an employee is findable in PIM by their employee id. */
export async function findEmployeeById(
  employeeListPage: EmployeeListPage,
  employeeId: string,
): Promise<void> {
  await employeeListPage.open();
  const rows = await employeeListPage.searchByEmployeeId(employeeId);

  expect(rows, `employee ${employeeId} should be listed in PIM`).toHaveLength(1);
  expect(rows[0].id).toBe(employeeId);
}

/**
 * Business action: amend an existing employee's personal details and prove the change
 * survived a reload rather than only showing a success toast.
 */
export async function amendPersonalDetails(
  personalDetailsPage: PersonalDetailsPage,
  empNumber: string,
  details: PersonalDetailsUpdate,
): Promise<void> {
  await personalDetailsPage.openFor(empNumber);
  await personalDetailsPage.update(details);
}

/**
 * Business action: delete an employee by their employee id.
 *
 * This is the one PIM write the demo lets a test undo, so journeys that create an
 * employee can hand the record back rather than leaving it on the shared instance.
 */
export async function deleteEmployee(
  employeeListPage: EmployeeListPage,
  employeeId: string,
): Promise<void> {
  await employeeListPage.open();
  await employeeListPage.deleteByEmployeeId(employeeId);
}
