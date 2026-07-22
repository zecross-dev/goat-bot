import {
  MessageFlags,
  type AnySelectMenuInteraction,
  type ButtonInteraction,
  type Client,
  type ModalSubmitInteraction,
} from "discord.js";
import {
  buildEmbed,
  embedToDraft,
  isDraftEmpty,
  parseMessageRef,
  type EmbedDraft,
} from "./draft.js";

/**
 * Terminal editor actions that leave the panel: sending the embed to a channel
 * or DM, editing an existing bot message, and importing an embed from a link.
 */

export async function sendEmbed(
  interaction: ButtonInteraction | AnySelectMenuInteraction,
  draft: EmbedDraft,
  target: "channel" | "dm",
  channelId?: string,
): Promise<void> {
  if (isDraftEmpty(draft)) {
    await interaction.reply({
      content: "L'embed est vide — ajoute au moins un titre, une description ou un champ.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  const embed = buildEmbed(draft);

  try {
    if (target === "dm") {
      await interaction.user.send({ embeds: [embed] });
      await interaction.reply({
        content: "✅ Embed envoyé en message privé.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const channel = await interaction.client.channels.fetch(channelId!);
    if (!channel?.isTextBased() || !channel.isSendable()) {
      throw new Error("channel not sendable");
    }
    await channel.send({ embeds: [embed] });
    await interaction.reply({
      content: `✅ Embed envoyé dans <#${channelId}>.`,
      flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    console.error("[embed] send failed:", error);
    await interaction.reply({
      content:
        target === "dm"
          ? "❌ Impossible de t'envoyer un MP (messages privés fermés ?)."
          : "❌ Envoi impossible (permissions manquantes dans ce salon ?).",
      flags: MessageFlags.Ephemeral,
    });
  }
}

export async function editExistingMessage(
  interaction: ModalSubmitInteraction,
  draft: EmbedDraft,
  link: string,
): Promise<void> {
  if (isDraftEmpty(draft)) {
    await interaction.followUp({
      content: "L'embed est vide — construis-le avant d'éditer un message.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  const ref = parseMessageRef(link);
  if (!ref) {
    await interaction.followUp({
      content: "Lien de message invalide.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  try {
    const channel = await interaction.client.channels.fetch(ref.channelId);
    if (!channel?.isTextBased()) throw new Error("not text");
    const message = await channel.messages.fetch(ref.messageId);
    if (message.author.id !== interaction.client.user.id) {
      await interaction.followUp({
        content: "Je ne peux éditer que **mes propres** messages.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    await message.edit({ embeds: [buildEmbed(draft)] });
    await interaction.followUp({
      content: `✅ Message mis à jour : ${message.url}`,
      flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    console.error("[embed] edit message failed:", error);
    await interaction.followUp({
      content: "❌ Édition impossible (message introuvable ou inaccessible).",
      flags: MessageFlags.Ephemeral,
    });
  }
}

/** Loads the first embed of a linked message into a draft (null on failure). */
export async function importEmbedFromLink(
  client: Client,
  link: string,
): Promise<EmbedDraft | null> {
  const ref = parseMessageRef(link);
  if (!ref) return null;
  try {
    const channel = await client.channels.fetch(ref.channelId);
    if (!channel?.isTextBased()) return null;
    const message = await channel.messages.fetch(ref.messageId);
    const embed = message.embeds[0];
    return embed ? embedToDraft(embed) : null;
  } catch {
    return null;
  }
}
