/* eslint-disable no-console */

/** Minimal step logger - output lands in the Playwright report and CI logs. */
export const logger = {
  info: (message: string): void => console.log(`[INFO ] ${message}`),
  step: (message: string): void => console.log(`[STEP ] ${message}`),
  warn: (message: string): void => console.warn(`[WARN ] ${message}`),
  error: (message: string): void => console.error(`[ERROR] ${message}`),
};
