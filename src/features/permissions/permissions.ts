import { PermissionFlagsBits, type GuildMember } from "discord.js";
import {
  getGuildConfig,
  updateGuildConfig,
  type PermissionsConfig,
} from "../../core/store.js";

/**
 * Internal granular permission layer, applied on top of Discord's native
 * command permissions. Supports:
 *  - bypass: roles/users that skip every check (full access),
 *  - grants: per-command allow-lists (once a command is configured, only
 *    listed roles/users — plus bypass/admins — may run it),
 *  - groups: named command bundles assigned to roles/users.
 *
 * A "target" is a role or user id passed to the mutators below.
 */

export interface PermTarget {
  roleId?: string;
  userId?: string;
}

/** Loads a guild's permissions with every field defaulted to empty. */
async function loadPerms(guildId: string): Promise<Required<PermissionsConfig>> {
  const p = (await getGuildConfig(guildId)).permissions ?? {};
  return {
    bypassRoleIds: p.bypassRoleIds ?? [],
    bypassUserIds: p.bypassUserIds ?? [],
    grants: p.grants ?? {},
    groups: p.groups ?? {},
  };
}

async function savePerms(
  guildId: string,
  perms: Required<PermissionsConfig>,
): Promise<void> {
  await updateGuildConfig(guildId, { permissions: perms });
}

/** Public read access for display commands. */
export function getPermissions(
  guildId: string,
): Promise<Required<PermissionsConfig>> {
  return loadPerms(guildId);
}

/**
 * Whether a member may run a command, given the internal permission layer.
 * Owners, administrators and bypass targets always pass. If the command has
 * no internal config, access is granted (Discord's own perms still apply).
 */
export async function hasCommandAccess(
  member: GuildMember,
  commandName: string,
): Promise<boolean> {
  if (member.id === member.guild.ownerId) return true;
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;

  const perms = (await getGuildConfig(member.guild.id)).permissions;
  if (!perms) return true;

  const memberRoles = member.roles.cache;

  if (perms.bypassUserIds?.includes(member.id)) return true;
  if (perms.bypassRoleIds?.some((r) => memberRoles.has(r))) return true;

  const allowUsers = new Set<string>();
  const allowRoles = new Set<string>();
  let configured = false;

  const grant = perms.grants?.[commandName];
  if (grant) {
    configured = true;
    grant.userIds.forEach((u) => allowUsers.add(u));
    grant.roleIds.forEach((r) => allowRoles.add(r));
  }
  for (const group of Object.values(perms.groups ?? {})) {
    if (group.commands.includes(commandName)) {
      configured = true;
      group.userIds.forEach((u) => allowUsers.add(u));
      group.roleIds.forEach((r) => allowRoles.add(r));
    }
  }

  if (!configured) return true; // defer to Discord permissions

  if (allowUsers.has(member.id)) return true;
  return [...allowRoles].some((r) => memberRoles.has(r));
}

// ── Mutators ────────────────────────────────────────────────────────────────

/** Adds a role/user to a command's allow-list. */
export async function addGrant(
  guildId: string,
  command: string,
  target: PermTarget,
): Promise<void> {
  const perms = await loadPerms(guildId);
  const grant = perms.grants[command] ?? { roleIds: [], userIds: [] };
  if (target.roleId && !grant.roleIds.includes(target.roleId))
    grant.roleIds.push(target.roleId);
  if (target.userId && !grant.userIds.includes(target.userId))
    grant.userIds.push(target.userId);
  perms.grants[command] = grant;
  await savePerms(guildId, perms);
}

/** Removes a role/user from a command's allow-list (dropping it if empty). */
export async function removeGrant(
  guildId: string,
  command: string,
  target: PermTarget,
): Promise<void> {
  const perms = await loadPerms(guildId);
  const grant = perms.grants[command];
  if (!grant) return;
  if (target.roleId) grant.roleIds = grant.roleIds.filter((r) => r !== target.roleId);
  if (target.userId) grant.userIds = grant.userIds.filter((u) => u !== target.userId);
  if (grant.roleIds.length === 0 && grant.userIds.length === 0)
    delete perms.grants[command];
  else perms.grants[command] = grant;
  await savePerms(guildId, perms);
}

/** Adds or removes a bypass target. */
export async function setBypass(
  guildId: string,
  target: PermTarget,
  add: boolean,
): Promise<void> {
  const perms = await loadPerms(guildId);
  const upsert = (list: string[], id?: string) => {
    if (!id) return list;
    if (add) return list.includes(id) ? list : [...list, id];
    return list.filter((x) => x !== id);
  };
  perms.bypassRoleIds = upsert(perms.bypassRoleIds, target.roleId);
  perms.bypassUserIds = upsert(perms.bypassUserIds, target.userId);
  await savePerms(guildId, perms);
}

/** Creates or replaces a group with the given command list. */
export async function createGroup(
  guildId: string,
  name: string,
  commands: string[],
): Promise<void> {
  const perms = await loadPerms(guildId);
  const existing = perms.groups[name];
  perms.groups[name] = {
    commands,
    roleIds: existing?.roleIds ?? [],
    userIds: existing?.userIds ?? [],
  };
  await savePerms(guildId, perms);
}

/** Deletes a group. Returns false if it did not exist. */
export async function deleteGroup(
  guildId: string,
  name: string,
): Promise<boolean> {
  const perms = await loadPerms(guildId);
  if (!perms.groups[name]) return false;
  delete perms.groups[name];
  await savePerms(guildId, perms);
  return true;
}

/** Assigns or unassigns a role/user to a group. Returns false if no group. */
export async function assignGroup(
  guildId: string,
  name: string,
  target: PermTarget,
  add: boolean,
): Promise<boolean> {
  const perms = await loadPerms(guildId);
  const group = perms.groups[name];
  if (!group) return false;
  const upsert = (list: string[], id?: string) => {
    if (!id) return list;
    if (add) return list.includes(id) ? list : [...list, id];
    return list.filter((x) => x !== id);
  };
  group.roleIds = upsert(group.roleIds, target.roleId);
  group.userIds = upsert(group.userIds, target.userId);
  await savePerms(guildId, perms);
  return true;
}
