import { expect, test } from '@playwright/test';
import { MongoClient } from 'mongodb';

const shareToken = 'abcDEF012345_-abcDEF01';
let mongo;

test.beforeAll(async () => {
  mongo = new MongoClient(process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/nexus');
  await mongo.connect();
  await mongo.db(process.env.MONGODB_DB ?? 'nexus').collection('savedexperiments').updateOne(
    { shareToken },
    {
      $set: {
        owner: 'playwright-fixture',
        title: 'Playwright shared scenario',
        description: 'Browser restore fixture',
        schemaVersion: 1,
        data: {
          schemaVersion: 1,
          name: 'Playwright shared scenario',
          objects: [{ id: 'earth', name: 'Earth', type: 'planet', parentId: null }],
        },
        visibility: 'unlisted',
        shareToken,
        updatedAt: new Date(),
      },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true },
  );
});

test.afterAll(async () => {
  if (!mongo) return;
  await mongo.db(process.env.MONGODB_DB ?? 'nexus').collection('savedexperiments').deleteOne({ shareToken });
  await mongo.close();
});

test.describe('NEXUS browser journeys', () => {
  test('opens the Solar System and selects a planet', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Not to scale')).toBeVisible();

    // Earth begins near the centre of the view. Selecting the scene object
    // should focus it and reveal its label.
    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    await canvas.click({ position: { x: box.width * 0.52, y: box.height * 0.52 } });
    await expect(page.getByText('Earth', { exact: true })).toBeVisible({ timeout: 10_000 });
  });

  test('runs a star replacement scenario', async ({ page }) => {
    await page.goto('/sandbox');
    await page.locator('select').first().selectOption('star-replacement');
    await expect(page.getByText(/Bu fikriy tajriba, yulduz evolyutsiyasi modeli emas/)).toBeVisible();
    await page.getByRole('button', { name: /To.xtatish/ }).click();
    await page.getByRole('button', { name: /Boshlang.ich holatga qaytarish/ }).click();
    await expect(page.getByText('0.0000 d')).toBeVisible();
  });

  test('runs an impact scenario', async ({ page }) => {
    await page.goto('/sandbox');
    await page.locator('select').first().selectOption('asteroid-impact');
    await expect(page.getByText(/Kinetik energiya:/)).toBeVisible();
    await expect(page.getByText(/TNT ekvivalenti:/)).toBeVisible();
    await page.getByRole('button', { name: /To.xtatish/ }).click();
    await expect(page.getByRole('button', { name: /Ishga tushirish/ })).toBeVisible();
  });

  test('builds and saves a sandbox scenario', async ({ page }) => {
    await page.goto('/sandbox');
    await expect(page.getByRole('heading', { name: /sandbox/i })).toBeVisible();
    await page.getByRole('button', { name: /build scenario/i }).click();
    await page.getByLabel(/scenario name/i).fill('Playwright sandbox');
    await page.getByRole('button', { name: /save/i }).click();
    await expect(page.getByText(/saved.*Playwright sandbox/i)).toBeVisible();
  });

  test('opens Saved, saves locally, refreshes and reloads the scenario', async ({ page }) => {
    await page.goto('/saved');
    await page.getByLabel('Scenario name').fill('Playwright local scenario');
    await page.getByRole('button', { name: 'Save locally' }).click();
    await expect(page.getByText('Saved Playwright local scenario on this device.')).toBeVisible();

    await page.reload();
    const scenario = page.getByRole('listitem').filter({ hasText: 'Playwright local scenario' });
    await expect(scenario).toBeVisible();
    await scenario.getByRole('button', { name: 'Load' }).click();
    await expect(page.getByRole('heading', { name: 'Loaded: Playwright local scenario' })).toBeVisible();
  });

  test('restores a shared scenario from its share link', async ({ page }) => {
    await page.goto(`/e/${shareToken}`);
    await expect(page.getByRole('heading', { name: /restored scenario: playwright shared scenario/i })).toBeVisible();
    await expect(page.getByText('Earth', { exact: true })).toBeVisible();
  });
});
