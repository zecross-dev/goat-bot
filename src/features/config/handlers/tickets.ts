import { MessageFlags, TextChannel, type ChatInputCommandInteraction } from "discord.js";
import { addPanel, getGuildConfig, updateGuildConfig } from "../../../core/store.js";
import { buildPanel, TICKET_TYPES } from "../../tickets/panel.js";
import { ensureOption, replyChanges } from "./shared.js";

/** Handles `/goat-config tickets`: saves settings and optionally posts a panel. */
export async function configureTickets(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!interaction.inGuild()) return;

  const staffRole = interaction.options.getRole("staff_role");
  const logChannel = interaction.options.getChannel("logs_channel");
  const panelChannel = interaction.options.getChannel("panel_channel");
  const title = interaction.options.getString("title") ?? undefined;
  const description = interaction.options.getString("description") ?? undefined;

  // Read the per-type destination categories (e.g. `support_category`) and
  // merge them onto the current map, so setting one type keeps the others.
  const current = (await getGuildConfig(interaction.guildId)).tickets ?? {};
  const categoryIds: Record<string, string> = { ...current.categoryIds };
  const categoryChanges: string[] = [];
  for (const [type, cfg] of Object.entries(TICKET_TYPES)) {
    const channel = interaction.options.getChannel(`${type}_category`);
    if (channel) {
      categoryIds[type] = channel.id;
      categoryChanges.push(`Catégorie « ${cfg.label} » → ${channel.toString()}`);
    }
  }
  const hasCategoryChange = categoryChanges.length > 0;

  const hasAny = !!staffRole || hasCategoryChange || !!logChannel || !!panelChannel;
  const guard = "Indique au moins une option (rôle, catégorie, salon de logs, ou salon du panneau).";
  if (!(await ensureOption(interaction, hasAny, guard))) return;

  const changes: string[] = [];

  if (staffRole || hasCategoryChange || logChannel) {
    await updateGuildConfig(interaction.guildId, {
      tickets: {
        ...(staffRole ? { staffRoleId: staffRole.id } : {}),
        ...(hasCategoryChange ? { categoryIds } : {}),
        ...(logChannel ? { logChannelId: logChannel.id } : {}),
      },
    });
    if (staffRole) changes.push(`Rôle staff → ${staffRole.toString()}`);
    changes.push(...categoryChanges);
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
