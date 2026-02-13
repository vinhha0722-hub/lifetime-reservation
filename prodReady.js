import { chromium } from "playwright";
import {
  computeTargetClassDate,
  computeOpenTimeForClass,
  toISODate,
  buildScheduleUrl,
  cardMatches,
  sleep,
  msUntilDateTime,
} from "./src/utils.js";
import {
  ENV,
  TARGET_WEEKDAY,
  TARGET_DAY_INDEX,
  MUST_INCLUDE,
  OPEN_TIME,
  READY_MINUTES_BEFORE,
  RESERVE_RETRY_MS,
  RESERVE_MAX_WAIT_MS,
  USE_WAIT_UNTIL_OPEN,
  LOGIN_URL,
  SCHEDULE_DEFAULTS,
} from "./src/constants.js";

const EMAIL = process.env[ENV.EMAIL];
const PASSWORD = process.env[ENV.PASSWORD];

async function dismissCookieBanner(page) {
  const acceptBtn = page.getByRole("button", { name: /accept all/i });
  try {
    await acceptBtn.waitFor({ state: "visible", timeout: 6000 });
    console.log("Cookie banner detected. Clicking Accept All...");
    await acceptBtn.click();
    await sleep(400);
  } catch {
    console.log("No cookie banner.");
  }
}

async function clickReserveAndFinish(page) {
  const reserveBtn = page.getByRole("button", { name: /^Reserve$/i });
  const finishBtn = page.getByRole("button", { name: /^Finish$/i });
  const waitlistBtn = page.getByRole("button", { name: /waitlist/i });

  const start = Date.now();

  while (Date.now() - start < RESERVE_MAX_WAIT_MS) {
    if (await reserveBtn.isVisible().catch(() => false)) {
      console.log("Reserve visible. Clicking Reserve...");
      await reserveBtn.click();

      console.log("Waiting for Finish...");
      await finishBtn.waitFor({ state: "visible", timeout: 15000 });
      await finishBtn.click();

      console.log("Finish clicked. Reservation complete.");
      return;
    }

    if (await waitlistBtn.isVisible().catch(() => false)) {
      console.log("Class is waitlisted. Stopping retries.");
      return;
    }

    await sleep(RESERVE_RETRY_MS);
    await page.reload({ waitUntil: "domcontentloaded" }).catch(() => {});
  }

  throw new Error("Timed out (5 minutes) waiting for Reserve button.");
}

async function run() {
  if (!EMAIL || !PASSWORD) {
    throw new Error(`Missing ${ENV.EMAIL} or ${ENV.PASSWORD} environment variables.`);
  }

  const classDate = computeTargetClassDate(TARGET_WEEKDAY);
  const openAt = computeOpenTimeForClass(
    classDate,
    OPEN_TIME.hour,
    OPEN_TIME.minute,
    OPEN_TIME.second
  );
  const readyAt = new Date(openAt.getTime() - READY_MINUTES_BEFORE * 60000);

  const selectedDate = toISODate(classDate);

  const scheduleUrl = buildScheduleUrl({
    clubPath: SCHEDULE_DEFAULTS.clubPath,
    selectedDate,
    location: SCHEDULE_DEFAULTS.location,
    interest: SCHEDULE_DEFAULTS.interest,
    mode: SCHEDULE_DEFAULTS.mode,
    teamMemberView: SCHEDULE_DEFAULTS.teamMemberView,
  });

  console.log("Now:", new Date().toString());
  console.log("Target classDate:", classDate.toString());
  console.log("Open at:", openAt.toString());
  console.log("Ready at:", readyAt.toString());
  console.log("Schedule URL:", scheduleUrl);

  if (USE_WAIT_UNTIL_OPEN) {
    const msToReady = msUntilDateTime(readyAt);
    if (msToReady > 0) {
      console.log("Sleeping until ready time:", msToReady);
      await sleep(msToReady);
    }
  }

  console.log("Launching browser...");
  const browser = await chromium.launch({
    headless: process.env.CI ? true : false,
    slowMo: process.env.CI ? 0 : 100,
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log("Navigating to login...");
    await page.goto(LOGIN_URL, { waitUntil: "networkidle" });

    await page.fill("#account-username", EMAIL);
    await page.fill('input[type="password"]', PASSWORD);

    await Promise.all([
      page.waitForLoadState("networkidle"),
      page.click('button[type="submit"]'),
    ]);

    console.log("Logged in.");

    console.log("Opening schedule page...");
    await page.goto(scheduleUrl, { waitUntil: "domcontentloaded" });

    await dismissCookieBanner(page);

    await page.locator('[data-testid="classCell"]').first().waitFor({
      state: "visible",
      timeout: 20000,
    });

    const days = page.locator("div.calendar > div.day");
    const dayCount = await days.count();
    if (dayCount < 7) throw new Error("Could not find 7 day columns.");

    const targetCol = days.nth(TARGET_DAY_INDEX);
    const cards = targetCol.locator('[data-testid="classCell"]');
    const cardCount = await cards.count();

    let targetCard = null;

    for (let i = 0; i < cardCount; i++) {
      const text = await cards.nth(i).innerText();
      if (cardMatches(text, MUST_INCLUDE)) {
        targetCard = cards.nth(i);
        console.log("Matched card:\n", text);
        break;
      }
    }

    if (!targetCard) {
      throw new Error("Could not find matching class card.");
    }

    if (USE_WAIT_UNTIL_OPEN) {
      const msToOpen = msUntilDateTime(openAt);
      if (msToOpen > 0) {
        console.log("Waiting until open:", msToOpen);
        if (msToOpen > 400) await sleep(msToOpen - 200);
        while (msUntilDateTime(openAt) > 0) {}
      }
    }

    console.log("Clicking class...");
    const classLink = targetCard.locator('[data-testid="classLink"]').first();

    await Promise.all([
      page.waitForURL(/class-details\.html/i),
      classLink.click(),
    ]);

    console.log("Attempting reserve (retry up to 5 minutes)...");
    await clickReserveAndFinish(page);

    console.log("Done.");
    await page.waitForTimeout(1000);
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error("Error:", err);
  process.exitCode = 1;
});
