import { describe, expect, it } from "vitest";
import { isIntakeModal, parseIntakeType } from "./intake.js";

describe("isIntakeModal", () => {
  it("is true when the customId starts with the intake prefix", () => {
    expect(isIntakeModal("ticket:intake")).toBe(true);
    expect(isIntakeModal("ticket:intake:commande")).toBe(true);
    expect(isIntakeModal("ticket:intake:support")).toBe(true);
  });

  it("is false for other customIds", () => {
    expect(isIntakeModal("ticket:create:commande")).toBe(false);
    expect(isIntakeModal("ticket:close")).toBe(false);
    expect(isIntakeModal("")).toBe(false);
  });
});

describe("parseIntakeType", () => {
  it("parses the type from the intake customId", () => {
    expect(parseIntakeType("ticket:intake:commande")).toBe("commande");
    expect(parseIntakeType("ticket:intake:support")).toBe("support");
  });

  it("falls back to commande for unknown / missing types", () => {
    expect(parseIntakeType("ticket:intake:bogus")).toBe("commande");
    expect(parseIntakeType("ticket:intake")).toBe("commande");
    expect(parseIntakeType("")).toBe("commande");
  });
});
