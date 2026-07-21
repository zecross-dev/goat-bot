import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  type ButtonInteraction,
} from "discord.js";
import { getGuildConfig, removePanel } from "../../core/store.js";

/**
 * Shared UI for `/goat-config display`: renders the current config + one
 * "delete" button per active panel, and handles those delete buttons. Kept
 * separate so both the command and the button router can rebuild the view.
 */

const PANEL_DELETE_PREFIX = "panel:delete";

/** Human label for an integration id. */
const INTEGRATION_LABELS: Record<string, string> = {
  tickets: "🎫 Tickets",
};

/** Whether a button press is a config-UI panel action. */
export function isConfigButton(customId: string): boolean {
  return customId.startsWith(PANEL_DELETE_PREFIX);
}

/** Builds the `/goat-config display` message (embed + delete buttons). */
export async function buildConfigDisplay(guildId: string) {
  const cfg = await getGuildConfig(guildId);
  const t = cfg.tickets;
  const w = cfg.welcome;
  const m = cfg.moderation;
  const l = cfg.leveling;
  const r = cfg.raid;
  const a = cfg.antilink;
  const panels = cfg.panels ?? [];

  const rewards = l?.rewards?.length
    ? l.rewards
        .slice()
        .sort((a, b) => a.level - b.level)
        .map((r) => `niv. ${r.level} → <@&${r.roleId}>`)
        .join(", ")
    : "*aucune*";

  const panelList = panels.length
    ? panels
        .map((p, i) => {
          const label = INTEGRATION_LABELS[p.integration] ?? p.integration;
          const link = `https://discord.com/channels/${guildId}/${p.channelId}/${p.messageId}`;
          return `**${i + 1}.** ${label} — [aller au panneau](${link}) dans <#${p.channelId}>`;
        })
        .join("\n")
    : "*aucun panneau actif*";

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("⚙️ Configuration du bot")
    .addFields(
      {
        name: "🎫 Tickets",
        value: [
          `Rôle staff : ${t?.staffRoleId ? `<@&${t.staffRoleId}>` : "*non défini*"}`,
          `Catégorie : ${t?.categoryId ? `<#${t.categoryId}>` : "*non définie*"}`,
          `Salon logs : ${t?.logChannelId ? `<#${t.logChannelId}>` : "*non défini*"}`,
        ].join("\n"),
      },
      {
        name: "👋 Arrivées",
        value: [
          `Salon : ${w?.channelId ? `<#${w.channelId}>` : "*non défini*"}`,
          `Message : ${w?.message ? `\`${w.message}\`` : "*message par défaut*"}`,
        ].join("\n"),
      },
      {
        name: "🔨 Modération",
        value: `Salon logs : ${m?.logChannelId ? `<#${m.logChannelId}>` : "*non défini*"}`,
      },
      {
        name: "🏆 Niveaux",
        value: [
          `Statut : ${l?.enabled ? "activé ✅" : "désactivé ⛔"}`,
          `XP/message : ${l?.xpPerMessage ?? 20} • Cooldown : ${l?.cooldownSeconds ?? 60}s`,
          `Annonces : ${l?.announce === false ? "désactivées" : "activées"}${l?.announceChannelId ? ` → <#${l.announceChannelId}>` : ""}`,
          `Récompenses : ${rewards}`,
        ].join("\n"),
      },
      {
        name: "🛡️ Anti-raid",
        value: [
          `Statut : ${r?.enabled ? "activé ✅" : "désactivé ⛔"}`,
          `Seuil : ${r?.joinThreshold ?? 5} arrivées / ${r?.joinWindowSeconds ?? 10}s • Action : ${r?.action ?? "kick"}`,
          `Âge min. compte : ${r?.minAccountAgeHours ? `${r.minAccountAgeHours}h` : "désactivé"}`,
          `Alertes : ${r?.alertChannelId ? `<#${r.alertChannelId}>` : "*non défini*"}${r?.alertRoleId ? ` (ping <@&${r.alertRoleId}>)` : ""}`,
        ].join("\n"),
      },
      {
        name: "🔗 Anti-liens",
        value: [
          `Statut : ${a?.enabled ? "activé ✅" : "désactivé ⛔"}`,
          `Rôles autorisés : ${a?.allowedRoleIds?.length ? a.allowedRoleIds.map((r) => `<@&${r}>`).join(", ") : "*Gérer les messages*"}`,
          `Salons autorisés : ${a?.allowedChannelIds?.length ? a.allowedChannelIds.map((c) => `<#${c}>`).join(", ") : "*tickets uniquement*"}`,
          `Domaines whitelist : ${a?.whitelist?.length ? a.whitelist.map((d) => `\`${d}\``).join(", ") : "*aucun*"}`,
        ].join("\n"),
      },
      { name: "📋 Panneaux actifs", value: panelList },
    );

  // One delete button per panel, chunked into rows of 5 (Discord max), capped
  // at 25 buttons (5 rows) which is the component limit.
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  for (let i = 0; i < panels.length && i < 25; i += 5) {
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      panels.slice(i, i + 5).map((p, j) =>
        new ButtonBuilder()
          .setCustomId(`${PANEL_DELETE_PREFIX}:${p.channelId}:${p.messageId}`)
          .setLabel(`Supprimer #${i + j + 1}`)
          .setEmoji("🗑️")
          .setStyle(ButtonStyle.Danger),
      ),
    );
    rows.push(row);
  }

  return { embeds: [embed], components: rows };
}

/** Handles a "delete panel" button: removes the message + store entry. */
export async function handleConfigButton(
  interaction: ButtonInteraction,
): Promise<void> {
  if (!interaction.inGuild() || !interaction.guild) return;

  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    await interaction.reply({
      content: "Tu n'as pas la permission de supprimer un panneau.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const [, , channelId, messageId] = interaction.customId.split(":");

  // Best-effort delete of the panel message; ignore if already gone.
  try {
    const channel = await interaction.guild.channels.fetch(channelId);
    if (channel?.isTextBased()) {
      const message = await channel.messages.fetch(messageId);
      await message.delete();
    }
  } catch (error) {
    console.error("[config] Could not delete panel message:", error);
  }

  await removePanel(interaction.guildId, channelId, messageId);

  // Refresh the (ephemeral) display in place with the panel now gone.
  await interaction.update(await buildConfigDisplay(interaction.guildId));
}
