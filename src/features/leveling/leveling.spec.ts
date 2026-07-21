import { describe, expect, it } from "vitest";
import {
  levelFromXp,
  levelProgress,
  totalXpForLevel,
  xpToNext,
} from "./leveling.js";

describe("leveling XP curve", () => {
  it("xpToNext follows the 5·n²+50·n+100 curve", () => {
    expect(xpToNext(0)).toBe(100);
    expect(xpToNext(1)).toBe(155);
    expect(xpToNext(2)).toBe(220);
  });

  it("totalXpForLevel is the cumulative sum of xpToNext", () => {
    expect(totalXpForLevel(0)).toBe(0);
    expect(totalXpForLevel(1)).toBe(100);
    expect(totalXpForLevel(2)).toBe(255);
    expect(totalXpForLevel(3)).toBe(475);
  });

  it("levelFromXp is the inverse of totalXpForLevel", () => {
    expect(levelFromXp(0)).toBe(0);
    expect(levelFromXp(99)).toBe(0);
    expect(levelFromXp(100)).toBe(1);
    expect(levelFromXp(254)).toBe(1);
    expect(levelFromXp(255)).toBe(2);
  });

  it("levelProgress reports progress within the current level", () => {
    expect(levelProgress(0)).toEqual({ level: 0, into: 0, needed: 100 });
    expect(levelProgress(120)).toEqual({ level: 1, into: 20, needed: 155 });
  });

  it("clamps negative / fractional XP", () => {
    expect(levelFromXp(-50)).toBe(0);
    expect(levelProgress(100.9)).toEqual({ level: 1, into: 0, needed: 155 });
  });
});
