import { describe, expect, it } from "vitest";
import { addDays, daysBetween, formatChineseDate } from "./dates";

describe("calendar dates", () => {
  it("adds local calendar days across a month boundary", () => {
    expect(addDays("2026-09-30", 1)).toBe("2026-10-01");
    expect(daysBetween("2026-09-30", "2026-10-02")).toBe(2);
  });

  it("formats a compact Chinese date", () => {
    expect(formatChineseDate("2026-12-20")).toBe("12 月 20 日");
  });

  it("keeps dates compact when they are in the reference year", () => {
    expect(formatChineseDate("2026-12-20", "2026-09-07")).toBe("12 月 20 日");
  });

  it("adds the year when the date is outside the reference year", () => {
    expect(formatChineseDate("2027-10-06", "2026-09-07")).toBe("2027 年 10 月 6 日");
  });
});
