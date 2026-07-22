import { MessageFlags, TextChannel, type ChatInputCommandInteraction } from "discord.js";
import { addPanel, updateGuildConfig } from "../../../core/store.js";
import { buildPanel } from "../../tickets/panel.js";
import { ensureOption, replyChanges } from "./shared.js";

/** Handles `/goat-config tickets`: saves settings and optionally posts a panel. */
export async function configureTickets(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!interaction.inGuild()) return;

  const staffRole = interaction.options.getRole("staff_role");
  const category = interaction.options.getChannel("category");
  const logChannel = interaction.options.getChannel("logs_channel");
  const panelChannel = interaction.options.getChannel("panel_channel");
  const title = interaction.options.getString("title") ?? undefined;
  const description = interaction.options.getString("description") ?? undefined;

  const hasAny = !!staffRole || !!category || !!logChannel || !!panelChannel;
  const guard = "Indique au moins une option (rôle, catégorie, salon de logs, ou salon du panneau).";
  if (!(await ensureOption(interaction, hasAny, guard))) return;

  const changes: string[] = [];

  if (staffRole || category || logChannel) {
    await updateGuildConfig(interaction.guildId, {
      tickets: {
        ...(staffRole ? { staffRoleId: staffRole.id } : {}),
        ...(category ? { categoryId: category.id } : {}),
        ...(logChannel ? { logChannelId: logChannel.id } : {}),
      },
    });
    if (staffRole) changes.push(`Rôle staff → ${staffRole.toString()}`);
    if (category) changes.push(`Catégorie → ${category.toString()}`);
    if (logChannel) changes.push(`Salon logs → ${logChannel.toString()}`);
  }

  if (panelChannel) {
    if (!(panelChannel instanceof TextChannel)) {
      await interaction.reply({
        content: "Le salon du panneau doit être un salon textuel.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const sent = await panelChannel.send(buildPanel({ title, description }));
    await addPanel(interaction.guildId, {
      integration: "tickets",
      channelId: panelChannel.id,
      messageId: sent.id,
      ...(title ? { title } : {}),
      ...(description ? { description } : {}),
    });
    changes.push(`Panneau publié → ${panelChannel.toString()}`);
  }

  await replyChanges(interaction, "Tickets mis à jour", changes);
}
