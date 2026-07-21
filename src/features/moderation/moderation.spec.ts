import { describe, expect, it } from "vitest";
import { formatDuration, parseDuration } from "./moderation.js";

describe("parseDuration", () => {
  it("parses each supported unit into milliseconds", () => {
    expect(parseDuration("30s")).toBe(30 * 1000);
    expect(parseDuration("10m")).toBe(10 * 60_000);
    expect(parseDuration("2h")).toBe(2 * 3_600_000);
    expect(parseDuration("7d")).toBe(7 * 86_400_000);
    expect(parseDuration("1w")).toBe(604_800_000);
  });

  it("is case-insensitive", () => {
    expect(parseDuration("10M")).toBe(10 * 60_000);
    expect(parseDuration("2H")).toBe(2 * 3_600_000);
    expect(parseDuration("1W")).toBe(604_800_000);
  });

  it("tolerates surrounding and internal whitespace", () => {
    expect(parseDuration("  10m  ")).toBe(10 * 60_000);
    expect(parseDuration("10 m")).toBe(10 * 60_000);
    expect(parseDuration("2  h")).toBe(2 * 3_600_000);
  });

  it("returns null for invalid input", () => {
    expect(parseDuration("abc")).toBeNull();
    expect(parseDuration("10")).toBeNull();
    expect(parseDuration("5x")).toBeNull();
    expect(parseDuration("")).toBeNull();
    expect(parseDuration("m10")).toBeNull();
    expect(parseDuration("10mm")).toBeNull();
  });
});

describe("formatDuration", () => {
  it("uses the largest fitting unit", () => {
    expect(formatDuration(604_800_000)).toBe("1 semaine(s)");
    expect(formatDuration(86_400_000)).toBe("1 jour(s)");
    expect(formatDuration(3_600_000)).toBe("1 heure(s)");
    expect(formatDuration(60_000)).toBe("1 minute(s)");
    expect(formatDuration(1000)).toBe("1 seconde(s)");
  });

  it("floors to whole units of the largest fitting unit", () => {
    expect(formatDuration(2 * 86_400_000 + 3_600_000)).toBe("2 jour(s)");
    expect(formatDuration(90 * 60_000)).toBe("1 heure(s)");
  });

  it("returns 'quelques secondes' below one second", () => {
    expect(formatDuration(0)).toBe("quelques secondes");
    expect(formatDuration(999)).toBe("quelques secondes");
  });
});

describe("parseDuration + formatDuration round-trip", () => {
  it("formats a parsed duration back to the same unit", () => {
    expect(formatDuration(parseDuration("2h")!)).toBe("2 heure(s)");
    expect(formatDuration(parseDuration("3d")!)).toBe("3 jour(s)");
    expect(formatDuration(parseDuration("1w")!)).toBe("1 semaine(s)");
  });
});
