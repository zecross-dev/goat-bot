import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
  type ButtonInteraction,
} from "discord.js";
import type { Command } from "../../../core/command.js";

/**
 * `/help` — self-documenting command list. Defaults to the general category;
 * the buttons below the embed (or `/help category:…`) switch to a detailed,
 * per-theme reference. The catalog below is curated by hand so usage strings
 * stay readable.
 */

const GENERAL = new EmbedBuilder()
  .setColor(0x5865f2)
  .setTitle("📖 Aide — Commandes générales")
  .setDescription(
    "Voici les commandes classiques. Utilise les boutons ci-dessous pour voir les autres sections.",
  )
  .addFields(
    { name: "`/ping`", value: "Affiche la latence du bot.", inline: false },
    {
      name: "`/help [category]`",
      value: "Affiche cette aide (`Général`, `Modération`, `Configuration`).",
      inline: false,
    },
    {
      name: "🏆 Niveaux",
      value:
        "`/level [member]` — Ton niveau et ta progression.\n" +
        "`/leaderboard` — Classement du serveur par XP.",
      inline: false,
    },
    {
      name: "Autres sections",
      value: "Clique sur un bouton ci-dessous pour parcourir les sections.",
      inline: false,
    },
  )
  .setFooter({ text: "GOAT • <> = requis, [] = optionnel" });

const LEVELS = new EmbedBuilder()
  .setColor(0xfee75c)
  .setTitle("🏆 Aide — Niveaux")
  .setDescription(
    "Les membres gagnent de l'XP en discutant. Franchir un palier fait monter " +
      "de niveau et peut débloquer des rôles récompenses.",
  )
  .addFields(
    {
      name: "👤 Pour tout le monde",
      value: [
        "`/level [member]` — Niveau, XP et rang (le tien par défaut).",
        "`/leaderboard` — Top 10 des membres par XP.",
      ].join("\n"),
      inline: false,
    },
    {
      name: "⚙️ `/goat-config levels` *(admins)*",
      value: [
        "`enabled` — Active/désactive le gain d'XP.",
        "`xp_per_message` — XP moyen par message (défaut 20).",
        "`cooldown` — Délai entre deux gains, en secondes (défaut 60).",
        "`announce` / `announce_channel` — Annonces de passage de niveau.",
        "`stack_rewards` — Cumuler les rôles récompenses ou garder le plus haut.",
      ].join("\n"),
      inline: false,
    },
    {
      name: "🏅 `/goat-levels` *(admins)*",
      value: [
        "`add-reward <level> <role>` / `remove-reward <level>` — Rôles récompenses.",
        "`rewards` — Liste les récompenses.",
        "`set <member> <level>` — Fixe le niveau d'un membre.",
        "`give <member> <amount>` — Ajoute/retire de l'XP.",
        "`reset [member]` — Réinitialise un membre (ou tout le serveur).",
      ].join("\n"),
      inline: false,
    },
  );

const MODERATION = new EmbedBuilder()
  .setColor(0xed4245)
  .setTitle("🔨 Aide — Modération")
  .addFields(
    {
      name: "⚖️ Sanctions",
      value: [
        "`/warn <member> [reason]` — Avertit un membre (enregistré).",
        "`/warnings <member>` — Historique des sanctions d'un membre.",
        "`/note <member> <content>` — Note interne (non notifiée au membre).",
        "`/kick <member> [reason]` — Expulse un membre.",
        "`/ban <user> [reason] [delete_days]` — Bannit (delete_days : 0-7).",
        "`/tempban <user> <duration> [reason]` — Bannit temporairement.",
        "`/unban <user> [reason]` — Débannit un utilisateur.",
        "`/banlist` — Liste les bannis.",
        "`/mute <member> [duration] [reason]` — Timeout (défaut 1h, max 28j).",
        "`/unmute <member> [reason]` — Retire le timeout.",
        "`/clear <amount> [member]` — Supprime 1-100 messages.",
      ].join("\n"),
      inline: false,
    },
    {
      name: "🎭 Rôles & salons",
      value: [
        "`/addrole <member> <role>` — Ajoute un rôle.",
        "`/delrole <member> <role>` — Retire un rôle.",
        "`/nick <member> [nickname]` — Change/réinitialise le pseudo.",
        "`/lock [channel] [reason]` — Verrouille l'écriture.",
        "`/unlock [channel] [reason]` — Déverrouille l'écriture.",
        "`/hide [channel] [reason]` — Cache le salon à @everyone.",
        "`/unhide [channel] [reason]` — Réaffiche le salon.",
      ].join("\n"),
      inline: false,
    },
    {
      name: "⏱️ Formats de durée",
      value: "`30s`, `10m`, `2h`, `7d`, `1w` — ex : `/mute @x duration:2h`.",
      inline: false,
    },
  )
  .setFooter({
    text: "Chaque commande exige la permission Discord correspondante et respecte la hiérarchie des rôles.",
  });

const CONFIG = new EmbedBuilder()
  .setColor(0x57f287)
  .setTitle("⚙️ Aide — Configuration (admins)")
  .setDescription("Réservé à la permission « Gérer le serveur ».")
  .addFields(
    {
      name: "🎫 `/goat-config`",
      value: [
        "`tickets` — staff_role, support_category, commande_category, logs_channel, panel_channel, title, description.",
        "`welcome` — channel (requis), message.",
        "`moderation` — logs_channel (requis).",
        "`levels` — enabled, xp_per_message, cooldown, announce, announce_channel, stack_rewards.",
        "`raid` — enabled, join_threshold, join_window, action, min_account_age, lockdown_minutes, alert_channel, alert_role.",
        "`antilink` — enabled, allow_role, allow_channel, whitelist, remove.",
        "`display` — config + panneaux actifs (avec suppression).",
      ].join("\n"),
      inline: false,
    },
    {
      name: "🔐 `/goat-perms`",
      value: [
        "`allow` / `disallow` — command, role/member.",
        "`bypass` — role/member, remove.",
        "`group create/delete/assign/unassign` — groupes de commandes.",
        "`display` — permissions configurées.",
      ].join("\n"),
      inline: false,
    },
    {
      name: "🖼️ `/embed [message]`",
      value:
        "Éditeur d'embed interactif : aperçu en direct, import (option `message`), " +
        "envoi salon/MP ou édition d'un message du bot.",
      inline: false,
    },
    {
      name: "🏆 `/goat-levels`",
      value:
        "Récompenses & XP : `add-reward`, `remove-reward`, `rewards`, `set`, " +
        "`give`, `reset`. Détails : bouton « Niveaux » ci-dessous.",
      inline: false,
    },
    {
      name: "🛡️ `/goat-raid`",
      value:
        "Anti-raid : `lockdown` (verrouillage manuel), `unlock`, `status`. " +
        "Réglages via `/goat-config raid`.",
      inline: false,
    },
  );

const CATALOG: Record<string, EmbedBuilder> = {
  general: GENERAL,
  moderation: MODERATION,
  levels: LEVELS,
  config: CONFIG,
};

/** Navigation buttons shown under the help embed, in display order. */
const CATEGORIES: { key: string; label: string; emoji: string }[] = [
  { key: "general", label: "Général", emoji: "📖" },
  { key: "moderation", label: "Modération", emoji: "🔨" },
  { key: "levels", label: "Niveaux", emoji: "🏆" },
  { key: "config", label: "Configuration", emoji: "⚙️" },
];

const HELP_BUTTON_PREFIX = "help:";

export function isHelpButton(customId: string): boolean {
  return customId.startsWith(HELP_BUTTON_PREFIX);
}

/** One row of category buttons; the active category's button is disabled. */
function buildButtons(active: string): ActionRowBuilder<ButtonBuilder> {
  const row = new ActionRowBuilder<ButtonBuilder>();
  for (const { key, label, emoji } of CATEGORIES) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`${HELP_BUTTON_PREFIX}${key}`)
        .setLabel(label)
        .setEmoji(emoji)
        .setStyle(key === active ? ButtonStyle.Secondary : ButtonStyle.Primary)
        .setDisabled(key === active),
    );
  }
  return row;
}

function renderHelp(category: string): {
  embeds: EmbedBuilder[];
  components: ActionRowBuilder<ButtonBuilder>[];
} {
  const key = CATALOG[category] ? category : "general";
  return { embeds: [CATALOG[key]], components: [buildButtons(key)] };
}

/** Routes a `help:` button press — swaps the embed/buttons in place. */
export async function handleHelpButton(interaction: ButtonInteraction): Promise<void> {
  const category = interaction.customId.slice(HELP_BUTTON_PREFIX.length);
  await interaction.update(renderHelp(category));
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Affiche l'aide et la liste des commandes.")
    .addStringOption((o) =>
      o
        .setName("category")
        .setDescription("Catégorie d'aide à afficher.")
        .addChoices(
          { name: "Général", value: "general" },
          { name: "Modération", value: "moderation" },
          { name: "Niveaux", value: "levels" },
          { name: "Configuration", value: "config" },
        ),
    ),

  async execute(interaction) {
    const category = interaction.options.getString("category") ?? "general";
    await interaction.reply({
      ...renderHelp(category),
      flags: MessageFlags.Ephemeral,
    });
  },
};

export default command;
