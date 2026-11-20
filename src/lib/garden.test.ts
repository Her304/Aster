import { describe, expect, it } from "vitest";
import { plantingOrder, plotSize, seed } from "./garden";

describe("garden", () => {
  it("grows the plot only when everyone no longer fits", () => {
    expect(plotSize(0)).toBe(4);
    expect(plotSize(16)).toBe(4);
    expect(plotSize(17)).toBe(5);
    expect(plotSize(30)).toBe(6);
    expect(plotSize(100)).toBe(10);
  });

  it("plants on every tile exactly once, in the same order each time", () => {
    for (const size of [4, 5, 9]) {
      const order = plantingOrder(size);
      expect(order).toHaveLength(size * size);
      expect(new Set(order.map(([row, col]) => `${row}:${col}`)).size).toBe(size * size);
      expect(plantingOrder(size)).toEqual(order);
    }
  });

  it("gives each response a stable seed", () => {
    expect(seed("abc")).toBe(seed("abc"));
    expect(seed("abc")).not.toBe(seed("abd"));
  });
});
