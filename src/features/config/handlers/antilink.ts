import type { ChatInputCommandInteraction } from "discord.js";
import { getAntiLinkConfig, updateGuildConfig } from "../../../core/store.js";
import { ensureOption, replyChanges } from "./shared.js";

/** Handles `/goat-config antilink`: toggles the filter and edits allow-lists. */
export async function configureAntiLink(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!interaction.inGuild()) return;

  const enabled = interaction.options.getBoolean("enabled");
  const allowRole = interaction.options.getRole("allow_role");
  const allowChannel = interaction.options.getChannel("allow_channel");
  const whitelist = interaction.options.getString("whitelist")?.toLowerCase().trim();
  const remove = interaction.options.getBoolean("remove") ?? false;

  const hasAny = enabled !== null || !!allowRole || !!allowChannel || !!whitelist;
  if (!(await ensureOption(interaction, hasAny))) return;

  const cfg = await getAntiLinkConfig(interaction.guildId);
  const upsert = (list: string[] | undefined, id: string | undefined) => {
    const set = new Set(list ?? []);
    if (!id) return [...set];
    if (remove) set.delete(id);
    else set.add(id);
    return [...set];
  };

  await updateGuildConfig(interaction.guildId, {
    antilink: {
      ...(enabled !== null ? { enabled } : {}),
      ...(allowRole ? { allowedRoleIds: upsert(cfg.allowedRoleIds, allowRole.id) } : {}),
      ...(allowChannel
        ? { allowedChannelIds: upsert(cfg.allowedChannelIds, allowChannel.id) }
        : {}),
      ...(whitelist ? { whitelist: upsert(cfg.whitelist, whitelist) } : {}),
    },
  });

  const verb = remove ? "retiré" : "ajouté";
  const changes: string[] = [];
  if (enabled !== null) changes.push(`Filtre ${enabled ? "activé ✅" : "désactivé ⛔"}`);
  if (allowRole) changes.push(`Rôle autorisé ${verb} → ${allowRole.toString()}`);
  if (allowChannel) changes.push(`Salon autorisé ${verb} → ${allowChannel.toString()}`);
  if (whitelist) changes.push(`Domaine ${verb} → \`${whitelist}\``);

  await replyChanges(interaction, "Anti-liens mis à jour", changes);
}
