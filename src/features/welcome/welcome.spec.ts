import { describe, expect, it } from "vitest";
import { renderWelcome } from "./welcome.js";

const member = {
  toString: () => "<@123>",
  user: { username: "Bob" },
  guild: { name: "MyServer", memberCount: 42 },
} as unknown as import("discord.js").GuildMember;

describe("renderWelcome", () => {
  it("replaces {user} with the member mention", () => {
    expect(renderWelcome("hi {user}", member)).toBe("hi <@123>");
  });

  it("replaces {username} with the username", () => {
    expect(renderWelcome("hi {username}", member)).toBe("hi Bob");
  });

  it("replaces {server} with the guild name", () => {
    expect(renderWelcome("welcome to {server}", member)).toBe("welcome to MyServer");
  });

  it("replaces {count} with the member count", () => {
    expect(renderWelcome("member #{count}", member)).toBe("member #42");
  });

  it("replaces all placeholders in one template", () => {
    expect(
      renderWelcome("{user} joined {server} as #{count} ({username})", member),
    ).toBe("<@123> joined MyServer as #42 (Bob)");
  });

  it("replaces every occurrence of the same placeholder", () => {
    expect(renderWelcome("{user} {user} {user}", member)).toBe("<@123> <@123> <@123>");
    expect(renderWelcome("{count}-{count}", member)).toBe("42-42");
  });

  it("leaves a template without placeholders unchanged", () => {
    expect(renderWelcome("just plain text", member)).toBe("just plain text");
  });
});
