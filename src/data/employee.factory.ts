import { faker } from '@faker-js/faker';
import type { NewEmployee } from '../pages/pim/add-employee.page';

/**
 * Builds employee data. Names carry a run-unique suffix so parallel workers - and
 * repeat runs against the shared demo instance - never collide.
 */
export function buildEmployee(overrides: Partial<NewEmployee> = {}): Required<NewEmployee> {
  const unique = faker.string.alphanumeric({ length: 5, casing: 'upper' });
  return {
    firstName: `${faker.person.firstName()}${unique}`,
    middleName: faker.person.middleName(),
    lastName: `${faker.person.lastName()}${unique}`,
    employeeId: faker.string.numeric({ length: 6 }),
    ...overrides,
  };
}

/** A name long enough to exercise the app's field-length handling. */
export function overlongName(length = 60): string {
  return faker.string.alpha({ length, casing: 'lower' });
}

/**
 * A name carrying punctuation and digits. The app applies no character validation to
 * names, so these have to survive a round trip through search and the autocompletes.
 */
export function punctuatedName(stem = "O'Brien-Smith"): string {
  return `${stem}${faker.string.alphanumeric({ length: 5, casing: 'upper' })}`;
}
