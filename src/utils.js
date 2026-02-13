export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export function msUntilDateTime(targetDate, nowMs = Date.now()) {
  return targetDate.getTime() - nowMs;
}

export function toISODate(date) {
  const year = date.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// ---------- date math ----------

// Sun=0 Mon=1 ... Sat=6
export function nextWeekdayOnOrAfter(baseDate, weekday) {
  const d = new Date(baseDate);
  const diff = (weekday - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + diff);
  return d;
}

/**
 * RULE:
 * Target class date = weekday AFTER (today + 7 days)
 * Example: if today is Sun Feb 22 -> base is Sun Mar 1 -> next Monday is Mar 2.
 */
export function computeTargetClassDate(targetWeekday, now = new Date()) {
  const base = new Date(now);
  base.setDate(base.getDate() + 7);
  return nextWeekdayOnOrAfter(base, targetWeekday);
}

export function computeOpenTimeForClass(classDate, hour, minute, second) {
  const openAt = new Date(classDate);

  openAt.setDate(openAt.getDate() - 8);

  openAt.setHours(hour, minute, second, 0);
  return openAt;
}

// ---------- schedule URL + matching ----------

export function buildScheduleUrl({
  clubPath = "https://my.lifetime.life/clubs/va/fairfax/classes.html",
  selectedDate,
  location = "Fairfax",
  interest = "Pickleball Open Play",
  mode = "week",
  teamMemberView = true,
}) {
  if (!selectedDate) {
    throw new Error("buildScheduleUrl requires selectedDate (YYYY-MM-DD)");
  }

  const params = new URLSearchParams();

  if (teamMemberView) params.set("teamMemberView", "true");
  params.set("mode", mode);
  params.set("selectedDate", selectedDate);
  params.set("interest", interest);
  params.set("location", location);

  return `${clubPath}?${params.toString()}`;
}


export function cardMatches(cardText, mustInclude) {
  return mustInclude.every((s) => cardText.includes(s));
}
