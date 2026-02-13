const { chromium } = require("playwright");

// ======== CONFIG ========
const EMAIL = process.env.LT_EMAIL;
const PASSWORD = process.env.LT_PASSWORD;

const RES_EVENT_URL_BASE =
  "https://my.lifetime.life/clubs/va/fairfax/classes.html?teamMemberView=true&mode=week&interest=Pickleball+Open+Play&location=Fairfax";

// Sun=0 Mon=1 Tue=2 Wed=3 Thu=4 Fri=5 Sat=6
const TARGET_WEEKDAY = 1; // Monday
const TARGET_DAY_INDEX = TARGET_WEEKDAY; // calendar columns match weekday index

// Session match (edit as needed)
const MUST_INCLUDE = ["8:00", "10:00", "Pickleball Open Play"]; // add "All Levels"/"Advanced" if you want

// Reservations open (local time)
const OPEN_HOUR = 20; // 8 PM
const OPEN_MINUTE = 0;
const OPEN_SECOND = 0;

// Login early and wait on the page
const READY_MINUTES_BEFORE = 1;

// Retry behavior after entering details page
const RESERVE_RETRY_MS = 400;
const RESERVE_MAX_WAIT_MS = 45_000;

// Set false to test clicking immediately (no waiting)
const USE_WAIT_UNTIL_OPEN = false;

// ---- TEST OVERRIDE ----
// Hardcode "today" as Feb 22, 2026 (Sunday) for testing the date math.
// Month index is 0-based, so Feb = 1.
const NOW_OVERRIDE = new Date(2026, 1, 22, 12, 0, 0);
// Set to null to use real current time:
const USE_NOW_OVERRIDE = true;
// ========================

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function toISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Returns the next occurrence of `weekday` on or after `baseDate`
function nextWeekdayOnOrAfter(baseDate, weekday) {
  const d = new Date(baseDate);
  const diff = (weekday - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + diff);
  return d;
}

// Your rule: pick the target weekday after (today + 7 days)
// Example: if "today" is Sun Feb 22, +7 => Sun Mar 1, next Monday => Mon Mar 2
function computeTargetClassDate(targetWeekday, nowDate) {
  const base = new Date(nowDate);
  base.setDate(base.getDate() + 7);
  return nextWeekdayOnOrAfter(base, targetWeekday);
}

// Open time is the day before class date at OPEN_HOUR:OPEN_MINUTE:OPEN_SECOND
function computeOpenTimeForClass(classDate, openHour, openMinute, openSecond) {
  const openAt = new Date(classDate);
  openAt.setDate(openAt.getDate() - 1);
  openAt.setHours(openHour, openMinute, openSecond, 0);
  return openAt;
}

function msUntilDateTime(targetDate, nowMs) {
  return targetDate.getTime() - nowMs;
}

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

      console.log("Finish clicked. Done.");
      return;
    }

    if (await waitlistBtn.isVisible().catch(() => false)) {
      console.log("Waitlist is shown. Stopping (Reserve not available).");
      return;
    }

    await sleep(RESERVE_RETRY_MS);
    await page.reload({ waitUntil: "domcontentloaded" }).catch(() => {});
  }

  throw new Error("Timed out waiting for Reserve button to appear.");
}

async function run() {
  if (!EMAIL || !PASSWORD) {
    throw new Error("Missing LT_EMAIL or LT_PASSWORD environment variables.");
  }

  const nowDate = USE_NOW_OVERRIDE ? NOW_OVERRIDE : new Date();
  const nowMs = nowDate.getTime();

  const classDate = computeTargetClassDate(TARGET_WEEKDAY, nowDate);
  const openAt = computeOpenTimeForClass(classDate, OPEN_HOUR, OPEN_MINUTE, OPEN_SECOND);
  const readyAt = new Date(openAt.getTime() - READY_MINUTES_BEFORE * 60_000);

  const selectedDate = toISODate(classDate);
  const RES_EVENT_URL = `${RES_EVENT_URL_BASE}&selectedDate=${selectedDate}`;

  console.log("Now (used for date math):", nowDate.toString(), "ISO:", toISODate(nowDate));
  console.log("Target classDate:", classDate.toString(), "ISO:", selectedDate);
  console.log("Open at:", openAt.toString(), "ISO:", toISODate(openAt));
  console.log("Ready at:", readyAt.toString(), "ISO:", toISODate(readyAt));
  console.log("Schedule URL:", RES_EVENT_URL);

  if (USE_WAIT_UNTIL_OPEN) {
    const msToReady = msUntilDateTime(readyAt, nowMs);
    if (msToReady > 0) {
      console.log(`Sleeping until ready time: ${msToReady} ms`);
      await sleep(msToReady);
    }
  }

  console.log("Launching browser (local)...");
  const browser = await chromium.launch({ headless: false, slowMo: 100 });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // ---- LOGIN ----
    console.log("Navigating to login...");
    await page.goto(
      "https://my.lifetime.life/login.html?resource=%2Fclubs%2Fva%2Ffairfax.html",
      { waitUntil: "networkidle" }
    );

    console.log("Filling credentials...");
    await page.fill("#account-username", EMAIL);
    await page.fill('input[type="password"]', PASSWORD);

    await Promise.all([
      page.waitForLoadState("networkidle"),
      page.click('button[type="submit"]'),
    ]);

    console.log("Logged in.");

    // ---- OPEN SCHEDULE ----
    console.log("Opening schedule page...");
    await page.goto(RES_EVENT_URL, { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    console.log("Waiting for schedule cells...");
    await page.locator('[data-testid="classCell"]').first().waitFor({
      state: "visible",
      timeout: 20000,
    });

    const days = page.locator("div.calendar > div.day");
    const dayCount = await days.count();
    console.log("Day columns found:", dayCount);
    if (dayCount < 7) throw new Error("Could not find 7 day columns.");

    const targetCol = days.nth(TARGET_DAY_INDEX);
    await targetCol.scrollIntoViewIfNeeded();

    console.log("Scanning target day cards...");
    const cards = targetCol.locator('[data-testid="classCell"]');
    const cardCount = await cards.count();
    console.log("Cards in target column:", cardCount);

    let targetCard = null;
    for (let i = 0; i < cardCount; i++) {
      const card = cards.nth(i);
      const text = await card.innerText();
      if (MUST_INCLUDE.every((s) => text.includes(s))) {
        console.log("Matched card index:", i);
        console.log("Matched card text:\n", text);
        targetCard = card;
        break;
      }
    }

    if (!targetCard) {
      console.log("No match found. Card previews:");
      const previewN = Math.min(8, cardCount);
      for (let i = 0; i < previewN; i++) {
        console.log(`--- card ${i} ---\n${await cards.nth(i).innerText()}\n`);
      }
      throw new Error("Could not find target class card.");
    }

    if (USE_WAIT_UNTIL_OPEN) {
      const remaining = openAt.getTime() - Date.now();
      if (remaining > 0) {
        console.log(`Ready. Waiting until open: ${remaining} ms`);
        if (remaining > 400) await sleep(remaining - 200);
        while (openAt.getTime() - Date.now() > 0) {}
      }
    }

    console.log("Clicking classLink...");
    const classLink = targetCard.locator('[data-testid="classLink"]').first();
    await Promise.all([
      page.waitForURL(/class-details\.html/i, { timeout: 15000 }),
      classLink.click(),
    ]);

    console.log("On details page. Trying Reserve then Finish...");
    // Uncomment to actually reserve (will loop if only Waitlist is available):
    // await clickReserveAndFinish(page);

    console.log("Done (test).");
    await page.waitForTimeout(1500);
  } finally {
    // await browser.close();
  }
}

run().catch((err) => {
  console.error("Error:", err);
  process.exitCode = 1;
});
