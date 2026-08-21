import { Locator, expect } from '@playwright/test';

/**
 * Reads one grid row's cells.
 *
 * OXD grids re-render in place after every search, so the cell count is asserted first -
 * otherwise a row can be read mid-render and yield undefined fields.
 */
export async function readRowCells(row: Locator, expectedCells: number): Promise<string[]> {
  const cells = row.locator('[role="cell"]');
  await expect(cells).toHaveCount(expectedCells);
  return (await cells.allInnerTexts()).map((cell) => cell.trim());
}
