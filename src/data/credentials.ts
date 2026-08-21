import { env } from '../config/env';

export interface Credentials {
  username: string;
  password: string;
}

/** The demo's published admin account. */
export const adminUser: Credentials = {
  username: env.admin.username,
  password: env.admin.password,
};

/** Negative-path inputs for the login suite. */
export const invalidCredentials: Array<{ title: string } & Credentials> = [
  { title: 'unknown username', username: 'not_a_user', password: env.admin.password },
  { title: 'wrong password', username: env.admin.username, password: 'wrong_password_123' },
  { title: 'both fields wrong', username: 'nobody', password: 'nothing' },
  { title: 'password with different casing', username: env.admin.username, password: 'ADMIN123' },
];
