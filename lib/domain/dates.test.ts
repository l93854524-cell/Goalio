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
});
