import { expect, test } from '@playwright/test';

test('callout → builds → list → edit → load → share text, then works offline', async ({ page, context }) => {
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Callout' }).fill('5x4x8 rolling');
  await page.getByRole('button', { name: 'Show builds' }).click();

  // Variant cards, labelled by side.
  await expect(page.getByText("Ladder on 4' side · decks run 5'")).toBeVisible();
  await expect(page.getByText("Ladder on 5' side · decks run 5'")).toBeVisible();
  await expect(page.getByText(/Not possible with current catalog/)).toBeVisible();

  // Open the 4'-side build.
  await page.getByText("Ladder on 4' side · decks run 5'").click();
  await page.waitForURL(/#\/list/);
  // The URL changes before the hashchange re-render; wait for something only the list has.
  await expect(page.getByRole('radiogroup', { name: 'Access' })).toBeVisible();
  await expect(page.getByText(/Legs 8' \(2\.50 m\), asked 8'/)).toBeVisible();
  await expect(page.getByText('Material estimate only — build per Layher instructions, site rules and your competent person.')).toBeVisible();
  await expect(page.getByRole('img', { name: 'Plan view' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Elevation view' })).toBeVisible();

  // Tap a line → explanation → edit qty.
  await page.getByRole('button', { name: /^8\s*Ledger 5'/ }).click();
  await expect(page.getByText(/Ledger 5' × 8 = 2 edges × 4 levels/)).toBeVisible();
  await page.getByRole('button', { name: 'plus one' }).click();
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByText('edited', { exact: true }).first()).toBeVisible();

  // Undo puts it back.
  await page.getByRole('button', { name: /Undo/ }).click();
  await expect(page.getByRole('button', { name: /^8\s*Ledger 5'/ })).toBeVisible();

  // Toggle access side live.
  await page.getByRole('radio', { name: "Ladder 5' side" }).click();
  await expect(page.getByText("Ladder on 5' side · decks run 5'").first()).toBeVisible();

  // Add to load and check combined totals.
  await page.getByRole('button', { name: 'Add to load' }).click();
  await page.getByRole('button', { name: /Load · 1/ }).click();
  await expect(page.getByText('Combined totals')).toBeVisible();
  await expect(page.getByText(/41 pcs · 1 tower/)).toBeVisible();

  // Works offline after first load (service worker).
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText('Combined totals')).toBeVisible();
  await page.goto('/#/');
  await expect(page.getByRole('textbox', { name: 'Callout' })).toBeVisible();
  await context.setOffline(false);
});
