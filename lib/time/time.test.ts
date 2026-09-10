import { describe, expect, it } from "vitest";
import { createTimeService } from "./time";

describe("time service", () => {
  it("moves the demo date by calendar days", () => {
    const time = createTimeService({ demo: true, initialDate: "2026-09-06" });
    time.move(2);
    expect(time.today()).toBe("2026-09-08");
  });

  it("rejects mutation outside demo mode", () => {
    const time = createTimeService({ demo: false, initialDate: "2026-09-06" });
    expect(() => time.move(1)).toThrow("Demo date control is disabled");
  });
});
