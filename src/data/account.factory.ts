import { faker } from '@faker-js/faker';
import type { Credentials } from './credentials';

/**
 * Login credentials for an account a flow creates. Usernames carry a random suffix so
 * parallel workers and repeat runs never collide on the shared demo.
 */
export function buildEssAccount(): Credentials {
  const unique = faker.string.alphanumeric({ length: 6, casing: 'lower' });
  return {
    username: `ess.${unique}`,
    // Meets the demo's complexity rules: upper, lower, digit, symbol.
    password: `Pw!${faker.string.alphanumeric({ length: 8 })}9`,
  };
}
