import { test, expect } from '@playwright/test';

// Functional E2E against the real stack (seeded API + Vite). Drives the hero loop,
// navigation, the role dashboards, bilingual toggle and the field app.

test('command centre loads with the NMI portfolio', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Collection-Care Command Centre')).toBeVisible();
  // Seeded NMI sites render as portfolio cards.
  await expect(page.getByText(/Archaeology|Collins Barracks|Natural History|Country Life/).first()).toBeVisible();
});

test('the closed loop fires: simulate excursion → named objects + work order', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Simulate RH excursion/i }).click();
  // The engine names at-risk objects and raises a work order.
  await expect(page.getByText(/Work order/i).first()).toBeVisible();
  await expect(page.getByText(/Silk court mantua|Vellum charter|Polychrome/).first()).toBeVisible();
});

test('role dashboards render the four front-doors', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Role dashboards' }).click();
  await expect(page.getByRole('tab', { name: /Director/i })).toBeVisible();
  await page.getByRole('tab', { name: /Conservation/i }).click();
  await expect(page.getByText('Monitored zones')).toBeVisible();
});

test('bilingual toggle switches the UI to Gaeilge', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Role dashboards' }).click();
  await page.getByRole('button', { name: 'Switch language' }).click();
  // The nav label is Irish after toggling.
  await expect(page.getByText('Deaisbhoird róil')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ga');
});

test('field app shows the mobile job list', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Field app/i }).click();
  await expect(page.getByRole('heading', { name: 'My jobs today' })).toBeVisible();
});

test('live floor map renders monitored zones', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Live floor map', exact: true }).click();
  // Seeded NMI zones appear as accessible tiles (text + status, not colour alone).
  await expect(page.getByRole('button', { name: /Textile Gallery.*RH/i }).first()).toBeVisible();
});

test('help desk: log an issue and see it auto-triaged in the queue', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Help desk' }).click();
  await expect(page.getByRole('heading', { name: 'Log an issue' })).toBeVisible();
  const desc = `E2E water leak above the print store ${Date.now()}`;
  await page.getByLabel('Issue description').fill(desc);
  await page.getByRole('button', { name: 'Log issue' }).click();
  // The new request appears in the queue (auto-triaged on the server).
  await expect(page.getByRole('cell', { name: desc })).toBeVisible();
});

test('documents register renders with the golden-thread filter', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Documents & O&M' }).click();
  await expect(page.getByRole('heading', { name: 'Register' })).toBeVisible();
  await expect(page.getByLabel('Golden-thread only')).toBeVisible();
});

test('evidence packs: build a pack for a seeded work order', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Evidence packs' }).click();
  await expect(page.getByRole('heading', { name: 'Work orders' })).toBeVisible();
  await page.getByRole('button', { name: /Build evidence pack for/i }).first().click();
  // The assembled pack content panel shows the chain counts.
  await expect(page.getByText('Gate checks')).toBeVisible();
  await expect(page.getByRole('button', { name: /print-ready pack/i })).toBeVisible();
});

test('planned maintenance lists schedules', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Planned maintenance' }).click();
  await expect(page.getByRole('heading', { name: 'Schedules' })).toBeVisible();
});

test('certificates register renders', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Certificates' }).click();
  await expect(page.getByRole('heading', { name: 'Certificate register' })).toBeVisible();
});

test('stores & inventory lists the catalogue', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Stores & inventory' }).click();
  await expect(page.getByRole('heading', { name: 'Catalogue' })).toBeVisible();
});

test('approvals lists requisitions', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Approvals' }).click();
  await expect(page.getByRole('heading', { name: 'Requisitions' })).toBeVisible();
});

test('contractor compliance shows the vault register', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Contractor compliance' }).click();
  await expect(page.getByRole('heading', { name: 'Contractor register' })).toBeVisible();
});

test('field app can open the QR issue capture flow', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Field app (mobile)' }).click();
  await page.getByRole('button', { name: /Report an issue/ }).click();
  await expect(page.getByLabel('Asset QR code')).toBeVisible();
});
