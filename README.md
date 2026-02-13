# 🏓 Lifetime Reservation Bot

Automated Lifetime Fitness class reservation bot built with Playwright and GitHub Actions.

This bot logs in, navigates to the correct class week, enters the class details page before reservations open, waits precisely until open time, and reserves instantly when the Reserve button becomes available.

---

# 🚀 What This Bot Does

For a configured weekday (example: Monday):

1. Computes the target class date  
   Target = weekday AFTER (today + 7 days)

2. Computes reservation open time  
   Open time = classDate − 8 days at 8:00 PM (configurable)

3. GitHub Action triggers ~5 minutes before open

4. Script:
   - Logs into Lifetime
   - Navigates to schedule page
   - Finds correct class tile
   - Clicks into class details page BEFORE open
   - Waits until exact open time
   - Retries until Reserve button appears
   - Clicks Reserve → Finish
   - Exits

No laptop needs to be running. Everything runs in GitHub Actions.

---

# 📁 Project Structure

```
lifetime-reservation/
│
├── prodReady.js
├── src/
│   ├── constants.js
│   └── utils.js
├── tests/
│   ├── utils.test.js
│   └── mock-flow.spec.js
└── .github/workflows/prodReady.yml
```

---

# ⚙️ Configuration (src/constants.js)

All configuration lives here.

## Target Weekday

```js
// Sun=0 Mon=1 Tue=2 Wed=3 Thu=4 Fri=5 Sat=6
export const TARGET_WEEKDAY = 1; // Monday
export const TARGET_DAY_INDEX = TARGET_WEEKDAY;
```

## Tile Matching

These strings must exist inside the class tile text:

```js
export const MUST_INCLUDE = [
  "8:00",
  "10:00",
  "Pickleball Open Play"
];
```

You can tighten matching by adding:
- "All Levels"
- "AM" / "PM"

## Reservation Open Time

```js
export const OPEN_TIME = {
  hour: 20,
  minute: 0,
  second: 0,
};
```

Open time is calculated as:

```
classDate - 8 days at OPEN_TIME
```

## Retry Settings

```js
export const RESERVE_RETRY_MS = 350;
export const RESERVE_MAX_WAIT_MS = 5 * 60 * 1000;
```

After open:
- Reloads every 350ms
- Retries for 5 minutes
- Stops if Waitlist appears

## Login URL

```js
export const LOGIN_URL =
  "https://my.lifetime.life/login.html?resource=%2Fclubs%2Fva%2Ffairfax.html";
```

## Schedule Defaults

```js
export const SCHEDULE_DEFAULTS = {
  clubPath: "https://my.lifetime.life/clubs/va/fairfax/classes.html",
  location: "Fairfax",
  interest: "Pickleball Open Play",
  mode: "week",
  teamMemberView: true,
};
```

---

# 🖥 Local Development

## Install dependencies

```
npm ci
```

## Install Playwright browser

```
npx playwright install chromium
```

## Set environment variables

Mac/Linux:

```
export LT_EMAIL="your@email.com"
export LT_PASSWORD="yourpassword"
```

Windows PowerShell:

```
$env:LT_EMAIL="your@email.com"
$env:LT_PASSWORD="yourpassword"
```

## Run locally

```
node prodReady.js
```

Locally:
- Browser opens visible
- Good for debugging

In CI:
- Runs headless automatically

---

# 🧪 Testing

## Unit Tests

```
npm run test:unit
```

Covers:
- Target class date calculation
- Open time calculation
- URL builder
- Tile matching logic

## Mock Flow Test

```
npm run test:mock
```

Simulates:
- Cookie banner
- Tile click
- Reserve → Finish flow

Run all:

```
npm run test:all
```

---

# 🤖 GitHub Actions Setup

## 1. Add Secrets

GitHub → Settings → Secrets → Actions

Add:

- LT_EMAIL
- LT_PASSWORD

## 2. Workflow File

`.github/workflows/prodReady.yml`

```yaml
name: LT Prod Ready

on:
  workflow_dispatch: {}
  schedule:
    - cron: "55 23 * * 0"
    - cron: "55 0 * * 1"

concurrency:
  group: lt-prod-ready
  cancel-in-progress: true

jobs:
  run:
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - run: npm ci

      - run: npx playwright install --with-deps chromium

      - name: Run prodReady
        env:
          LT_EMAIL: ${{ secrets.LT_EMAIL }}
          LT_PASSWORD: ${{ secrets.LT_PASSWORD }}
          CI: "true"
          TZ: "America/New_York"
        run: node prodReady.js
```

---

# ⏱ Cron Timing Explained

GitHub cron runs in UTC.

```
55 23 * * 0  → Sunday 23:55 UTC
55 0  * * 1  → Monday 00:55 UTC
```

These correspond to approximately 7:55 PM Eastern Time year-round (handles DST shifts).

The script:
- Enters class details page
- Waits until open time
- Reserves instantly

---

# 🔐 Security

- Credentials stored in GitHub Secrets
- No passwords committed
- No local machine required

---

# 📦 NPM Scripts

```json
"scripts": {
  "start": "node prodReady.js",
  "test:unit": "vitest run",
  "test:mock": "playwright test tests/mock-flow.spec.js",
  "test:all": "vitest run && playwright test tests/mock-flow.spec.js"
}
```

---

# 🎯 Runtime Flow

Typical logs:

```
Now: ...
Target classDate: ...
Open at: ...
Ready at: ...
Launching browser...
Logged in.
Matched card:
Clicking class...
Waiting until open...
Attempting reserve...
Finish clicked. Reservation complete.
```

---

# 🏁 Summary

This bot:

- Calculates next eligible class automatically
- Enters class page BEFORE open
- Waits precisely until open time
- Retries aggressively but safely
- Runs fully in GitHub Actions
- Requires zero manual intervention

Fully automated. Reliable. Deterministic. 🏓🔥
