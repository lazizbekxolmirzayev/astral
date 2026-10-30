import { expect, test } from '@playwright/test';

/** A flyable Earth mission, picked the way a player would. */
async function designEarthMission(page) {
  await page.getByTestId('objective-earth-climate').click();
  await page.getByTestId('part-bus-medium').click();
  await page.getByTestId('part-battery-medium').click();
  await page.getByTestId('part-computer-standard').click();
  await page.getByTestId('next-step').click();
  await page.getByTestId('part-camera-hires').click();
  await page.getByTestId('part-radiometer').click();
  await page.getByTestId('next-step').click();
  await page.getByTestId('launcher-alpha').click();
  await page.getByTestId('next-step').click();
}

test.describe('Space Mission Design Game', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await page.context().addCookies([{ name: 'nexus_locale', value: 'en', url: baseURL }]);
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.getByTestId('tutorial-done').click();
  });

  test('takes a player from objective to mission report and back', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));

    await designEarthMission(page);
    await expect(page.getByTestId('resource-budget')).toHaveAttribute('data-status', /ok|tight/);

    await page.getByTestId('launch').click();
    await page.getByTestId('skip-flight').click();
    await page.getByTestId('open-report').click();

    await expect(page.getByTestId('report-outcome')).toBeVisible();
    await expect(page.getByTestId('report-score')).toHaveText(/\d+/);

    await page.getByTestId('redesign').click();
    await expect(page.getByTestId('part-bus-medium').locator('input')).toBeChecked();
    expect(errors).toEqual([]);
  });

  test('refuses to launch a design that cannot fly and says why', async ({ page }) => {
    await page.getByTestId('objective-mars-water').click();
    await page.getByTestId('next-step').click();
    await page.getByTestId('next-step').click();
    await page.getByTestId('launcher-electron').click();
    await page.getByTestId('next-step').click();
    await expect(page.getByTestId('issue-noInstruments')).toBeVisible();
    await expect(page.getByTestId('issue-launcherCannotReach')).toBeVisible();
    await expect(page.getByTestId('launch')).toBeDisabled();
  });

  test('team play needs all four roles to sign off', async ({ page }) => {
    await page.getByRole('button', { name: 'Team of 4' }).click();
    await page.getByLabel(/Mission director/).fill('Aziza');
    await designEarthMission(page);
    await expect(page.getByTestId('launch')).toBeDisabled();
    for (const checkbox of await page.getByRole('checkbox').all()) await checkbox.check();
    await expect(page.getByTestId('launch')).toBeEnabled();
  });

  test('switches language without losing the design', async ({ page }) => {
    await page.getByTestId('objective-moon-ice').click();
    await page.getByTestId('part-bus-large').click();
    await page.getByRole('radio', { name: /O'zbek/i }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText("Kosmik missiyani loyihalash o'yini");
    await expect(page.getByTestId('part-bus-large').locator('input')).toBeChecked();
  });

  test('opens a shared design at the launch review', async ({ page }) => {
    await designEarthMission(page);
    const encoded = await page.evaluate(() => {
      const { design } = JSON.parse(localStorage.getItem('mission-game')).state;
      return btoa(encodeURIComponent(JSON.stringify(design))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    });
    await page.evaluate(() => localStorage.clear());
    await page.goto(`/?design=${encoded}`);
    await expect(page.getByTestId('launch')).toBeEnabled();
  });

  test('survives a reload in the middle of designing', async ({ page }) => {
    await page.getByTestId('objective-moon-ice').click();
    await page.getByTestId('part-bus-large').click();
    await page.reload();
    await page.getByRole('button', { name: /Spacecraft/ }).click();
    await expect(page.getByTestId('part-bus-large').locator('input')).toBeChecked();
  });
});
