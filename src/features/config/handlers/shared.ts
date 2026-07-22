import { MessageFlags, type ChatInputCommandInteraction } from "discord.js";

/**
 * Shared helpers for the `/goat-config` subcommand handlers: the common
 * "at least one option" guard and the "✅ … :\n• change" recap reply.
 */

/**
 * Ensures the user provided at least one option; otherwise replies with a hint
 * and returns false (the caller should stop).
 */
export async function ensureOption(
  interaction: ChatInputCommandInteraction,
  hasAny: boolean,
  message = "Indique au moins une option à modifier.",
): Promise<boolean> {
  if (hasAny) return true;
  await interaction.reply({ content: message, flags: MessageFlags.Ephemeral });
  return false;
}

/** Replies with the standard "✅ <heading> :" bulleted change list. */
export async function replyChanges(
  interaction: ChatInputCommandInteraction,
  heading: string,
  changes: string[],
): Promise<void> {
  await interaction.reply({
    content: `✅ ${heading} :\n${changes.map((c) => `• ${c}`).join("\n")}`,
    flags: MessageFlags.Ephemeral,
  });
}
