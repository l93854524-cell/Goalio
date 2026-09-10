import { describe, expect, it } from "vitest";
import { cents, formatYuan, parseYuan } from "./money";

describe("money", () => {
  it.each([
    ["0", 0],
    ["40", 4000],
    ["1199.50", 119950],
    ["1,260", 126000],
  ])("parses %s into integer cents", (input, expected) => {
    expect(parseYuan(input)).toBe(expected);
  });

  it.each(["", "-1", "1.001", "abc"])("rejects invalid money %s", (input) => {
    expect(parseYuan(input)).toBeNull();
  });

  it("formats whole yuan with grouping", () => {
    expect(formatYuan(cents(800000))).toBe("¥8,000");
  });
});
