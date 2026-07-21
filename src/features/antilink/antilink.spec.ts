import { describe, expect, it } from "vitest";
import { containsLink } from "./antilink.js";

/**
 * Detection is deliberately conservative for a developer community: real URLs
 * (http(s)://, www., domain.tld/path) must be flagged, but bare dev tokens like
 * `discord.js`, `index.ts` or `node.js` — a name with a dotted extension but no
 * path/scheme — must NOT be caught, or normal code talk would be deleted.
 */
describe("containsLink", () => {
  it("flags real links", () => {
    expect(containsLink("https://example.com")).toBe(true);
    expect(containsLink("http://a.b")).toBe(true);
    expect(containsLink("check www.site.fr now")).toBe(true);
    expect(containsLink("youtube.com/watch?v=x")).toBe(true);
    expect(containsLink("discord.gg/abcdef")).toBe(true);
    expect(containsLink("join at discord.gg/xyz please")).toBe(true);
  });

  it("does not flag dev tokens or plain text", () => {
    expect(containsLink("discord.js")).toBe(false);
    expect(containsLink("index.ts")).toBe(false);
    expect(containsLink("node.js")).toBe(false);
    expect(containsLink("regarde le fichier src/index.ts")).toBe(false);
    expect(containsLink("j'utilise discord.js et node")).toBe(false);
    expect(containsLink("hello world")).toBe(false);
    expect(containsLink("version 2.0")).toBe(false);
  });
});
