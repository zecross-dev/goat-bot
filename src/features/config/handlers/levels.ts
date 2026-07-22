import type { ChatInputCommandInteraction } from "discord.js";
import { updateGuildConfig } from "../../../core/store.js";
import { ensureOption, replyChanges } from "./shared.js";

/** Handles `/goat-config levels`: saves the base leveling settings. */
export async function configureLevels(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!interaction.inGuild()) return;

  const enabled = interaction.options.getBoolean("enabled");
  const xpPerMessage = interaction.options.getInteger("xp_per_message");
  const cooldown = interaction.options.getInteger("cooldown");
  const announce = interaction.options.getBoolean("announce");
  const announceChannel = interaction.options.getChannel("announce_channel");
  const stackRewards = interaction.options.getBoolean("stack_rewards");

  const hasAny =
    enabled !== null ||
    xpPerMessage !== null ||
    cooldown !== null ||
    announce !== null ||
    !!announceChannel ||
    stackRewards !== null;
  if (!(await ensureOption(interaction, hasAny))) return;

  await updateGuildConfig(interaction.guildId, {
    leveling: {
      ...(enabled !== null ? { enabled } : {}),
      ...(xpPerMessage !== null ? { xpPerMessage } : {}),
      ...(cooldown !== null ? { cooldownSeconds: cooldown } : {}),
      ...(announce !== null ? { announce } : {}),
      ...(announceChannel ? { announceChannelId: announceChannel.id } : {}),
      ...(stackRewards !== null ? { stackRewards } : {}),
    },
  });

  const changes: string[] = [];
  if (enabled !== null) changes.push(`Système ${enabled ? "activé ✅" : "désactivé ⛔"}`);
  if (xpPerMessage !== null) changes.push(`XP/message → ${xpPerMessage}`);
  if (cooldown !== null) changes.push(`Cooldown → ${cooldown}s`);
  if (announce !== null) changes.push(`Annonces ${announce ? "activées" : "désactivées"}`);
  if (announceChannel) changes.push(`Salon d'annonce → ${announceChannel.toString()}`);
  if (stackRewards !== null)
    changes.push(`Cumul des récompenses ${stackRewards ? "activé" : "désactivé"}`);

  await replyChanges(interaction, "Niveaux mis à jour", changes);
}
