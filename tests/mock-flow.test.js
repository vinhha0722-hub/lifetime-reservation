// tests/mock-flow.test.js
import { test, expect } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test("mock flow: accept cookies -> click tile -> reserve -> finish", async ({ page }) => {
  const schedulePath = path.join(__dirname, "fixtures", "schedule.html");
  await page.goto("file://" + schedulePath);

  // Accept cookies
  await page.getByRole("button", { name: /accept all/i }).click();
  await expect(page.locator("#cookie")).toHaveCount(0);

  // Click the tile link
  await page.locator('[data-testid="classLink"]').click();
  await expect(page).toHaveURL(/class-details\.html/);

  // Reserve appears after a delay
  await page.getByRole("button", { name: /^Reserve$/i }).waitFor({ state: "visible", timeout: 5000 });
  await page.getByRole("button", { name: /^Reserve$/i }).click();

  // Finish
  await expect(page).toHaveURL(/pending\.html/);
  await page.getByRole("button", { name: /^Finish$/i }).click();
  await expect(page.getByText("Success")).toBeVisible();
});
