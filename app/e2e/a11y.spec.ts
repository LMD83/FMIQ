import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Automated accessibility checks (WCAG 2.2 A/AA) on the key screens — the running-app
// counterpart to the jsx-a11y lint, feeding the ACR. Fails on serious/critical violations.

async function scan(page: import('@playwright/test').Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  return results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
}

test('command centre has no serious/critical a11y violations', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Collection-Care Command Centre')).toBeVisible();
  expect(await scan(page)).toEqual([]);
});

test('role dashboards have no serious/critical a11y violations', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Role dashboards' }).click();
  await expect(page.getByRole('tab', { name: /Director/i })).toBeVisible();
  expect(await scan(page)).toEqual([]);
});

test('help desk has no serious/critical a11y violations', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Help desk' }).click();
  await expect(page.getByRole('heading', { name: 'Log an issue' })).toBeVisible();
  expect(await scan(page)).toEqual([]);
});

test('documents register has no serious/critical a11y violations', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Documents & O&M' }).click();
  await expect(page.getByRole('heading', { name: 'Register' })).toBeVisible();
  expect(await scan(page)).toEqual([]);
});

test('planned maintenance has no serious/critical a11y violations', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Planned maintenance' }).click();
  await expect(page.getByRole('heading', { name: 'Schedules' })).toBeVisible();
  expect(await scan(page)).toEqual([]);
});

test('approvals has no serious/critical a11y violations', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Approvals' }).click();
  await expect(page.getByRole('heading', { name: 'Requisitions' })).toBeVisible();
  expect(await scan(page)).toEqual([]);
});
