import { MessageFlags, type RepliableInteraction } from "discord.js";
import type { EmbedDraft } from "./draft.js";

/**
 * Editor session state: the shared `embed:` customId prefix and the in-memory
 * draft store keyed by user id (one editor per user), plus the guard that
 * fetches the caller's draft.
 */

export const PREFIX = "embed:";

const sessions = new Map<string, EmbedDraft>();

/** Whether an interaction customId belongs to the embed editor. */
export function isEmbedInteraction(customId: string): boolean {
  return customId.startsWith(PREFIX);
}

export function setSession(userId: string, draft: EmbedDraft): void {
  sessions.set(userId, draft);
}

export function clearSession(userId: string): void {
  sessions.delete(userId);
}

/** Fetches the caller's draft, replying with a hint if the editor expired. */
export async function requireSession(
  interaction: RepliableInteraction,
): Promise<EmbedDraft | null> {
  const draft = sessions.get(interaction.user.id);
  if (!draft) {
    await interaction.reply({
      content: "⏱️ Éditeur expiré ou introuvable. Relance `/embed`.",
      flags: MessageFlags.Ephemeral,
    });
    return null;
  }
  return draft;
}
