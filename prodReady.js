import { chromium } from "playwright";
import {
  computeTargetClassDate,
  computeOpenTimeForClass,
  toISODate,
  buildScheduleUrl,
  cardMatches,
  sleep,
  msUntilDateTime,
  withinWindow,
  clickReserveAndFinish,
  dismissCookieBanner,
} from "./src/utils.js";
import {
  ENV,
  TARGET_WEEKDAY,
  TARGET_DAY_INDEX,
  MUST_INCLUDE,
  OPEN_TIME,
  READY_MINUTES_BEFORE,
  USE_WAIT_UNTIL_OPEN,
  LOGIN_URL,
  SCHEDULE_DEFAULTS,
} from "./src/constants.js";

const EMAIL = process.env[ENV.EMAIL];
const PASSWORD = process.env[ENV.PASSWORD];

async function run({ classDate, openAt }) {
  if (!EMAIL || !PASSWORD) {
    throw new Error(
      `Missing ${ENV.EMAIL} or ${ENV.PASSWORD} environment variables.`
    );
  }

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

  // Sleep until we want to start doing browser work
  if (USE_WAIT_UNTIL_OPEN) {
    const msToReady = msUntilDateTime(readyAt);
    if (msToReady > 0) {
      console.log("Sleeping until ready time (ms):", msToReady);
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

    // Wait for schedule to render
    await page.locator('[data-testid="classCell"]').first().waitFor({
      state: "visible",
      timeout: 20000,
    });

    // Find target day column
    const days = page.locator("div.calendar > div.day");
    const dayCount = await days.count();
    if (dayCount < 7) throw new Error("Could not find 7 day columns.");

    const targetCol = days.nth(TARGET_DAY_INDEX);

    // Find target card in that day column
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

    // Click into class details BEFORE open time, then wait there
    console.log("Clicking class (entering details page)...");
    const classLink = targetCard.locator('[data-testid="classLink"]').first();

    await Promise.all([
      page.waitForURL(/class-details\.html/i, { timeout: 15000 }),
      classLink.click(),
    ]);

    // Cookie banner can sometimes re-appear on details
    await dismissCookieBanner(page);

    console.log("On class details page. Waiting until open time...");
    if (USE_WAIT_UNTIL_OPEN) {
      const msToOpen = msUntilDateTime(openAt);
      if (msToOpen > 0) {
        console.log("Waiting until open (ms):", msToOpen);
        if (msToOpen > 400) await sleep(msToOpen - 200);
        while (msUntilDateTime(openAt) > 0) {}
      }
    }

    console.log("Attempting reserve (retry up to 5 minutes)...");
    await clickReserveAndFinish(page);

    console.log("Done.");
    await page.waitForTimeout(1000);
  } finally {
    await browser.close();
  }
}

// ---- compute openAt BEFORE window check ----
const classDate = computeTargetClassDate(TARGET_WEEKDAY);
const openAt = computeOpenTimeForClass(
  classDate,
  OPEN_TIME.hour,
  OPEN_TIME.minute,
  OPEN_TIME.second
);

const now = new Date();
if (!withinWindow(now, openAt)) {
  console.log("Not in booking window. Exiting.");
  console.log("Now:", now.toString());
  console.log("OpenAt:", openAt.toString());
  process.exit(0);
}

run({ classDate, openAt }).catch((err) => {
  console.error("Error:", err);
  process.exitCode = 1;
});
