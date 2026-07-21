import { describe, expect, it } from "vitest";
import { parseColor, parseMessageRef } from "./editor.js";

describe("parseColor", () => {
  it("parses #RRGGBB (case-insensitive)", () => {
    expect(parseColor("#5865F2")).toBe(0x5865f2);
    expect(parseColor("#5865F2")).toBe(5793266);
    expect(parseColor("#5865f2")).toBe(0x5865f2);
  });

  it("parses bare RRGGBB without the hash", () => {
    expect(parseColor("ffffff")).toBe(16777215);
    expect(parseColor("FFFFFF")).toBe(16777215);
    expect(parseColor("000000")).toBe(0);
  });

  it("trims surrounding whitespace", () => {
    expect(parseColor("  #5865F2  ")).toBe(0x5865f2);
    expect(parseColor("\tffffff\n")).toBe(16777215);
  });

  it("returns null for invalid input", () => {
    expect(parseColor("")).toBeNull();
    expect(parseColor("#12")).toBeNull();
    expect(parseColor("12345")).toBeNull(); // too short
    expect(parseColor("1234567")).toBeNull(); // too long
    expect(parseColor("gggggg")).toBeNull(); // non-hex
    expect(parseColor("#zzzzzz")).toBeNull();
    expect(parseColor("#")).toBeNull();
  });
});

describe("parseMessageRef", () => {
  it("extracts channel + message id from a full discord link", () => {
    expect(
      parseMessageRef(
        "https://discord.com/channels/111111111111111111/222222222222222222/333333333333333333",
      ),
    ).toEqual({
      channelId: "222222222222222222",
      messageId: "333333333333333333",
    });
  });

  it("uses the last two id runs when more than two are present", () => {
    // The guild id (first run) is ignored; last-two win.
    const ref = parseMessageRef(
      "https://discord.com/channels/111111111111111111/222222222222222222/333333333333333333",
    );
    expect(ref?.channelId).toBe("222222222222222222");
    expect(ref?.messageId).toBe("333333333333333333");
  });

  it("parses a bare `channel-message` pair", () => {
    expect(
      parseMessageRef("222222222222222222-333333333333333333"),
    ).toEqual({
      channelId: "222222222222222222",
      messageId: "333333333333333333",
    });
  });

  it("returns null when fewer than two ids are present", () => {
    expect(parseMessageRef("222222222222222222")).toBeNull();
    expect(parseMessageRef("no ids here at all")).toBeNull();
    expect(parseMessageRef("")).toBeNull();
    expect(parseMessageRef("12345")).toBeNull(); // too short to be an id
  });
});
