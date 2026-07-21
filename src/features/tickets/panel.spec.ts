import { describe, expect, it } from "vitest";
import {
  isTicketChannel,
  isTicketType,
  parseCreateType,
  requiresIntake,
} from "./panel.js";

describe("isTicketType", () => {
  it("is true for the known ticket types", () => {
    expect(isTicketType("support")).toBe(true);
    expect(isTicketType("commande")).toBe(true);
  });

  it("is false for anything else", () => {
    expect(isTicketType("")).toBe(false);
    expect(isTicketType("Support")).toBe(false);
    expect(isTicketType("commandes")).toBe(false);
    expect(isTicketType("unknown")).toBe(false);
    expect(isTicketType("intake")).toBe(false);
  });
});

describe("requiresIntake", () => {
  it("does not require intake for support", () => {
    expect(requiresIntake("support")).toBe(false);
  });

  it("requires intake for commande", () => {
    expect(requiresIntake("commande")).toBe(true);
  });
});

describe("parseCreateType", () => {
  it("parses the 3rd colon segment", () => {
    expect(parseCreateType("ticket:create:commande")).toBe("commande");
    expect(parseCreateType("ticket:create:support")).toBe("support");
  });

  it("falls back to support for unknown / missing types", () => {
    expect(parseCreateType("ticket:create:bogus")).toBe("support");
    expect(parseCreateType("ticket:create")).toBe("support");
    expect(parseCreateType("")).toBe("support");
  });
});

describe("isTicketChannel", () => {
  it("is true only when the topic has both creator: and type:", () => {
    expect(isTicketChannel("creator:123 type:support")).toBe(true);
    expect(isTicketChannel("type:commande creator:456")).toBe(true);
  });

  it("is false for null / undefined / empty", () => {
    expect(isTicketChannel(null)).toBe(false);
    expect(isTicketChannel(undefined)).toBe(false);
    expect(isTicketChannel("")).toBe(false);
  });

  it("is false when only one marker is present", () => {
    expect(isTicketChannel("creator:123")).toBe(false);
    expect(isTicketChannel("type:support")).toBe(false);
    expect(isTicketChannel("just a normal channel topic")).toBe(false);
  });
});
