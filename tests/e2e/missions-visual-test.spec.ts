import { expect, test, type Page } from "@playwright/test";

test.use({ viewport: { width: 390, height: 844 } });

async function openMissionTest(page: Page, seed = 123) {
  await page.goto(`/visual-test-missions?seed=${seed}`, { waitUntil: "domcontentloaded" });

  const testList = page.locator("[data-mission-test-mode]");
  await expect(testList).toBeVisible();
  return testList;
}

test("opens without auth and renders all mission states", async ({ page }) => {
  const testList = await openMissionTest(page);

  await expect(page).toHaveURL(/\/visual-test-missions\?seed=123$/);
  await expect(testList.locator('[data-mission-card][data-mission-status="claimed"]')).not.toHaveCount(0, { timeout: 8_000 });
  await expect(testList.locator('[data-mission-card][data-mission-status="waiting"]')).not.toHaveCount(0, { timeout: 8_000 });
  await expect(testList.locator('[data-mission-card][data-mission-status="locked"]')).not.toHaveCount(0, { timeout: 8_000 });

  const firstSequence = await testList.locator("[data-mission-card]").evaluateAll((cards) =>
    cards.map((card) => `${card.getAttribute("data-mission-card")}:${card.getAttribute("data-mission-status")}`),
  );

  await page.reload({ waitUntil: "domcontentloaded" });
  const reloadedTestList = page.locator("[data-mission-test-mode]");
  await expect(reloadedTestList).toBeVisible();
  const secondSequence = await reloadedTestList.locator("[data-mission-card]").evaluateAll((cards) =>
    cards.map((card) => `${card.getAttribute("data-mission-card")}:${card.getAttribute("data-mission-status")}`),
  );

  expect(secondSequence).toEqual(firstSequence);
});

test("replays the points reward visually without mutating the mission", async ({ page }) => {
  const testList = await openMissionTest(page);
  const waitingPoints = testList.locator('[data-mission-card][data-mission-status="waiting"][data-mission-reward-kind="points"]').first();
  const missionId = await waitingPoints.getAttribute("data-mission-card");
  expect(missionId).toBeTruthy();

  const mutationRequests: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET" && request.url().includes("127.0.0.1:3000")) {
      mutationRequests.push(request.url());
    }
  });

  await waitingPoints.click();
  await expect(testList).toHaveAttribute("data-mission-test-pending-mission", missionId!);
  await expect(page.locator(`[data-mission-card="${missionId}"]`)).toHaveAttribute("data-mission-status", "claimed", { timeout: 10_000 });
  await expect(testList).not.toHaveAttribute("data-mission-test-pending-mission", /.+/);
  expect(mutationRequests).toEqual([]);
});

test("replays the gem reward scatter locally and claims only the visual fixture", async ({ page }) => {
  const testList = await openMissionTest(page);
  const waitingGems = testList.locator('[data-mission-card][data-mission-status="waiting"][data-mission-reward-kind="gems"]').first();
  const missionId = await waitingGems.getAttribute("data-mission-card");
  expect(missionId).toBeTruthy();

  const mutationRequests: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET" && request.url().includes("127.0.0.1:3000")) {
      mutationRequests.push(request.url());
    }
  });

  await waitingGems.click();
  await expect(testList).toHaveAttribute("data-mission-test-pending-mission", missionId!);
  await expect(page.locator("[data-active-gem-reward-count='1']")).toBeVisible();
  await expect(page.locator(`[data-mission-card="${missionId}"]`)).toHaveAttribute("data-mission-status", "claimed", { timeout: 10_000 });
  await expect(testList).not.toHaveAttribute("data-mission-test-pending-mission", /.+/);
  expect(mutationRequests).toEqual([]);
});

test("opens the chest animation and keeps the test flow local", async ({ page }) => {
  const testList = await openMissionTest(page);
  const waitingChest = testList.locator('[data-mission-card][data-mission-status="waiting"][data-mission-reward-kind="chest"]').first();
  const mutationRequests: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET" && request.url().includes("127.0.0.1:3000")) {
      mutationRequests.push(request.url());
    }
  });

  await waitingChest.click();
  await expect(page.locator("[data-mission-reward-overlay]")).toBeVisible();
  await expect(page.locator("[data-chest-opening-view]")).toBeVisible();
  expect(mutationRequests).toEqual([]);
});

test("opens locked details without navigating away", async ({ page }) => {
  const testList = await openMissionTest(page);
  const lockedMission = testList.locator('[data-mission-card][data-mission-status="locked"]').first();

  await lockedMission.click();
  const details = page.locator("[data-mission-details-overlay]");
  await expect(details).toBeVisible();
  await details.locator("button").last().click();
  await expect(page).toHaveURL(/\/visual-test-missions\?seed=123$/);
  await expect(details).toBeHidden({ timeout: 3_000 });
});
