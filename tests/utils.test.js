import { describe, it, expect } from "vitest";
import {
  computeTargetClassDate,
  computeOpenTimeForClass,
  toISODate,
  buildScheduleUrl,
  cardMatches,
} from "../src/utils.js";

describe("date logic", () => {
  it("Sunday Feb 22, 2026 -> target Monday Mar 2, 2026 (weekday after now+7)", () => {
    const now = new Date(2026, 1, 22, 12, 0, 0); // Feb 22 2026 (monthIndex 1)
    const classDate = computeTargetClassDate(1, now); // Monday

    expect(toISODate(classDate)).toBe("2026-03-02");
    expect(classDate.getDay()).toBe(1);
  });

  it("Open time is day before at 20:00", () => {
    const classDate = new Date(2026, 2, 2, 0, 0, 0); // Mar 2, 2026
    const openAt = computeOpenTimeForClass(classDate, 20, 0, 0);

    expect(toISODate(openAt)).toBe("2026-02-22");
    expect(openAt.getHours()).toBe(20);
    expect(openAt.getMinutes()).toBe(0);
    expect(openAt.getSeconds()).toBe(0);
  });
});

describe("url + matching", () => {
  it("buildScheduleUrl includes selectedDate", () => {
    const url = buildScheduleUrl({ selectedDate: "2026-03-02" });
    expect(url).toContain("selectedDate=2026-03-02");
    expect(url).toContain("interest=Pickleball+Open+Play");
  });

  it("cardMatches works", () => {
    const text = "8:00 – 10:00 PM\nPickleball Open Play: All Levels";
    expect(cardMatches(text, ["8:00", "10:00", "Pickleball Open Play"])).toBe(true);
    expect(cardMatches(text, ["Advanced"])).toBe(false);
  });
});
