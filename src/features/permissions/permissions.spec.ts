import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GuildConfig, PermissionsConfig } from "../../core/store.js";

vi.mock("../../core/store.js", () => ({
  getGuildConfig: vi.fn(),
  updateGuildConfig: vi.fn(),
}));

import { getGuildConfig } from "../../core/store.js";
import { hasCommandAccess } from "./permissions.js";

const mockGetConfig = vi.mocked(getGuildConfig);

function fakeMember(opts: {
  id?: string;
  ownerId?: string;
  admin?: boolean;
  roleIds?: string[];
}) {
  const roleIds = new Set(opts.roleIds ?? []);
  return {
    id: opts.id ?? "user1",
    guild: { id: "guild1", ownerId: opts.ownerId ?? "owner" },
    permissions: { has: (_flag: unknown) => !!opts.admin },
    roles: { cache: { has: (r: string) => roleIds.has(r) } },
  } as unknown as import("discord.js").GuildMember;
}

/** Wraps a PermissionsConfig (or undefined) as a resolved GuildConfig. */
function config(permissions?: PermissionsConfig): void {
  mockGetConfig.mockResolvedValue({ permissions } as GuildConfig);
}

describe("hasCommandAccess", () => {
  beforeEach(() => vi.clearAllMocks());

  it("grants the guild owner regardless of config", async () => {
    config({ grants: { ban: { roleIds: ["other"], userIds: [] } } });
    const member = fakeMember({ id: "owner", ownerId: "owner" });
    expect(await hasCommandAccess(member, "ban")).toBe(true);
  });

  it("grants a member with the Administrator permission", async () => {
    config({ grants: { ban: { roleIds: ["other"], userIds: [] } } });
    const member = fakeMember({ id: "user1", admin: true });
    expect(await hasCommandAccess(member, "ban")).toBe(true);
  });

  it("grants access when there is no permissions config at all", async () => {
    config(undefined);
    const member = fakeMember({ id: "user1" });
    expect(await hasCommandAccess(member, "ban")).toBe(true);
  });

  it("grants a bypass user", async () => {
    config({
      bypassUserIds: ["user1"],
      grants: { ban: { roleIds: [], userIds: [] } },
    });
    const member = fakeMember({ id: "user1" });
    expect(await hasCommandAccess(member, "ban")).toBe(true);
  });

  it("grants a member holding a bypass role", async () => {
    config({
      bypassRoleIds: ["modRole"],
      grants: { ban: { roleIds: [], userIds: [] } },
    });
    const member = fakeMember({ id: "user1", roleIds: ["modRole"] });
    expect(await hasCommandAccess(member, "ban")).toBe(true);
  });

  it("allows a role listed in the command's grant allow-list", async () => {
    config({ grants: { ban: { roleIds: ["banners"], userIds: [] } } });
    const member = fakeMember({ id: "user1", roleIds: ["banners"] });
    expect(await hasCommandAccess(member, "ban")).toBe(true);
  });

  it("allows a user listed in the command's grant allow-list", async () => {
    config({ grants: { ban: { roleIds: [], userIds: ["user1"] } } });
    const member = fakeMember({ id: "user1" });
    expect(await hasCommandAccess(member, "ban")).toBe(true);
  });

  it("denies an unlisted normal member for a configured command", async () => {
    config({ grants: { ban: { roleIds: ["banners"], userIds: [] } } });
    const member = fakeMember({ id: "user1", roleIds: ["someOtherRole"] });
    expect(await hasCommandAccess(member, "ban")).toBe(false);
  });

  it("grants access to a command that has no grant/group config", async () => {
    // `ban` is configured, but `kick` is not — kick is unrestricted.
    config({ grants: { ban: { roleIds: ["banners"], userIds: [] } } });
    const member = fakeMember({ id: "user1", roleIds: ["someOtherRole"] });
    expect(await hasCommandAccess(member, "kick")).toBe(true);
  });

  it("grants a command via group membership (role)", async () => {
    config({
      groups: {
        mods: {
          commands: ["ban", "kick"],
          roleIds: ["modRole"],
          userIds: [],
        },
      },
    });
    const member = fakeMember({ id: "user1", roleIds: ["modRole"] });
    expect(await hasCommandAccess(member, "kick")).toBe(true);
  });

  it("grants a command via group membership (user)", async () => {
    config({
      groups: {
        mods: {
          commands: ["ban"],
          roleIds: [],
          userIds: ["user1"],
        },
      },
    });
    const member = fakeMember({ id: "user1" });
    expect(await hasCommandAccess(member, "ban")).toBe(true);
  });

  it("denies a member not in the group for a group-configured command", async () => {
    config({
      groups: {
        mods: {
          commands: ["ban"],
          roleIds: ["modRole"],
          userIds: [],
        },
      },
    });
    const member = fakeMember({ id: "user1", roleIds: ["otherRole"] });
    expect(await hasCommandAccess(member, "ban")).toBe(false);
  });
});
