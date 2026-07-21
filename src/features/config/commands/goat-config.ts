import {
  ChannelType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  TextChannel,
} from "discord.js";
import type { Command } from "../../../core/command.js";
import { buildPanel } from "../../tickets/panel.js";
import { WELCOME_PLACEHOLDERS } from "../../welcome/welcome.js";
import {
  addPanel,
  getAntiLinkConfig,
  updateGuildConfig,
} from "../../../core/store.js";
import { buildConfigDisplay } from "../config-ui.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("goat-config")
    .setDescription("Configure les intégrations du bot (tickets, arrivées).")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addSubcommand((sub) =>
      sub
        .setName("tickets")
        .setDescription("Configure le système de tickets et publie son panneau.")
        .addRoleOption((o) =>
          o.setName("staff_role").setDescription("Rôle qui voit et gère les tickets."),
        )
        .addChannelOption((o) =>
          o
            .setName("category")
            .setDescription("Catégorie où créer les tickets.")
            .addChannelTypes(ChannelType.GuildCategory),
        )
        .addChannelOption((o) =>
          o
            .setName("logs_channel")
            .setDescription("Salon des logs d'ouverture/fermeture + transcripts.")
            .addChannelTypes(ChannelType.GuildText),
        )
        .addChannelOption((o) =>
          o
            .setName("panel_channel")
            .setDescription("Publie le panneau de tickets dans ce salon.")
            .addChannelTypes(ChannelType.GuildText),
        )
        .addStringOption((o) =>
          o.setName("title").setDescription("Titre personnalisé du panneau."),
        )
        .addStringOption((o) =>
          o.setName("description").setDescription("Description personnalisée du panneau."),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("welcome")
        .setDescription("Règle le message d'arrivée des nouveaux membres.")
        .addChannelOption((o) =>
          o
            .setName("channel")
            .setDescription("Salon où envoyer le message d'arrivée.")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true),
        )
        .addStringOption((o) =>
          o
            .setName("message")
            .setDescription(`Message. Variables : ${WELCOME_PLACEHOLDERS}`),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("moderation")
        .setDescription("Règle le salon de logs de modération.")
        .addChannelOption((o) =>
          o
            .setName("logs_channel")
            .setDescription("Salon où logger les sanctions.")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("levels")
        .setDescription("Configure le système de niveaux (XP par message, salon, etc.).")
        .addBooleanOption((o) =>
          o.setName("enabled").setDescription("Active/désactive le gain d'XP."),
        )
        .addIntegerOption((o) =>
          o
            .setName("xp_per_message")
            .setDescription("XP moyen gagné par message (défaut 20).")
            .setMinValue(1)
            .setMaxValue(500),
        )
        .addIntegerOption((o) =>
          o
            .setName("cooldown")
            .setDescription("Délai minimum entre deux gains, en secondes (défaut 60).")
            .setMinValue(0)
            .setMaxValue(3600),
        )
        .addBooleanOption((o) =>
          o.setName("announce").setDescription("Annoncer les passages de niveau."),
        )
        .addChannelOption((o) =>
          o
            .setName("announce_channel")
            .setDescription("Salon des annonces (par défaut : le salon du message).")
            .addChannelTypes(ChannelType.GuildText),
        )
        .addBooleanOption((o) =>
          o
            .setName("stack_rewards")
            .setDescription("Cumuler les rôles récompenses (sinon garder le plus haut)."),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("raid")
        .setDescription("Configure la protection anti-raid.")
        .addBooleanOption((o) =>
          o.setName("enabled").setDescription("Active/désactive la protection anti-raid."),
        )
        .addIntegerOption((o) =>
          o
            .setName("join_threshold")
            .setDescription("Nombre d'arrivées déclenchant le mode raid (défaut 5).")
            .setMinValue(2)
            .setMaxValue(100),
        )
        .addIntegerOption((o) =>
          o
            .setName("join_window")
            .setDescription("Fenêtre de détection en secondes (défaut 10).")
            .setMinValue(1)
            .setMaxValue(600),
        )
        .addStringOption((o) =>
          o
            .setName("action")
            .setDescription("Action sur les arrivants pendant un raid.")
            .addChoices(
              { name: "Expulser (kick)", value: "kick" },
              { name: "Bannir (ban)", value: "ban" },
              { name: "Alerter seulement", value: "alert" },
            ),
        )
        .addIntegerOption((o) =>
          o
            .setName("min_account_age")
            .setDescription("Pendant un raid : n'agit que sur les comptes < N heures (0 = tous).")
            .setMinValue(0)
            .setMaxValue(8760),
        )
        .addIntegerOption((o) =>
          o
            .setName("lockdown_minutes")
            .setDescription("Durée du verrouillage après détection (défaut 5 min).")
            .setMinValue(1)
            .setMaxValue(1440),
        )
        .addChannelOption((o) =>
          o
            .setName("alert_channel")
            .setDescription("Salon où envoyer les alertes de raid.")
            .addChannelTypes(ChannelType.GuildText),
        )
        .addRoleOption((o) =>
          o.setName("alert_role").setDescription("Rôle à mentionner lors d'une alerte."),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("antilink")
        .setDescription("Configure le filtre anti-liens (autorisé dans les tickets).")
        .addBooleanOption((o) =>
          o.setName("enabled").setDescription("Active/désactive le filtre anti-liens."),
        )
        .addRoleOption((o) =>
          o.setName("allow_role").setDescription("Rôle autorisé à poster des liens."),
        )
        .addChannelOption((o) =>
          o
            .setName("allow_channel")
            .setDescription("Salon où les liens sont toujours autorisés.")
            .addChannelTypes(ChannelType.GuildText),
        )
        .addStringOption((o) =>
          o
            .setName("whitelist")
            .setDescription("Domaine à autoriser (ex : github.com)."),
        )
        .addBooleanOption((o) =>
          o
            .setName("remove")
            .setDescription("Cocher pour retirer le rôle/salon/domaine au lieu de l'ajouter."),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("display")
        .setDescription("Affiche la configuration et les panneaux actifs."),
    ),

  async execute(interaction) {
    if (!interaction.inGuild()) return;
    const sub = interaction.options.getSubcommand();

    if (sub === "tickets") {
      await configureTickets(interaction);
      return;
    }

    if (sub === "welcome") {
      const channel = interaction.options.getChannel("channel", true);
      const message = interaction.options.getString("message");

      await updateGuildConfig(interaction.guildId, {
        welcome: { channelId: channel.id, ...(message ? { message } : {}) },
      });

      await interaction.reply({
        content: `✅ Message d'arrivée configuré dans ${channel.toString()}.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (sub === "moderation") {
      const channel = interaction.options.getChannel("logs_channel", true);
      await updateGuildConfig(interaction.guildId, {
        moderation: { logChannelId: channel.id },
      });
      await interaction.reply({
        content: `✅ Logs de modération configurés dans ${channel.toString()}.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (sub === "levels") {
      await configureLevels(interaction);
      return;
    }

    if (sub === "raid") {
      await configureRaid(interaction);
      return;
    }

    if (sub === "antilink") {
      await configureAntiLink(interaction);
      return;
    }

    if (sub === "display") {
      await interaction.reply({
        ...(await buildConfigDisplay(interaction.guildId)),
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};

/** Handles `/goat-config levels`: saves the base leveling settings. */
async function configureLevels(
  interaction: import("discord.js").ChatInputCommandInteraction,
): Promise<void> {
  if (!interaction.inGuild()) return;

  const enabled = interaction.options.getBoolean("enabled");
  const xpPerMessage = interaction.options.getInteger("xp_per_message");
  const cooldown = interaction.options.getInteger("cooldown");
  const announce = interaction.options.getBoolean("announce");
  const announceChannel = interaction.options.getChannel("announce_channel");
  const stackRewards = interaction.options.getBoolean("stack_rewards");

  if (
    enabled === null &&
    xpPerMessage === null &&
    cooldown === null &&
    announce === null &&
    !announceChannel &&
    stackRewards === null
  ) {
    await interaction.reply({
      content: "Indique au moins une option à modifier.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const changes: string[] = [];
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

  if (enabled !== null) changes.push(`Système ${enabled ? "activé ✅" : "désactivé ⛔"}`);
  if (xpPerMessage !== null) changes.push(`XP/message → ${xpPerMessage}`);
  if (cooldown !== null) changes.push(`Cooldown → ${cooldown}s`);
  if (announce !== null) changes.push(`Annonces ${announce ? "activées" : "désactivées"}`);
  if (announceChannel) changes.push(`Salon d'annonce → ${announceChannel.toString()}`);
  if (stackRewards !== null)
    changes.push(`Cumul des récompenses ${stackRewards ? "activé" : "désactivé"}`);

  await interaction.reply({
    content: `✅ Niveaux mis à jour :\n${changes.map((c) => `• ${c}`).join("\n")}`,
    flags: MessageFlags.Ephemeral,
  });
}

/** Handles `/goat-config raid`: saves the anti-raid settings. */
async function configureRaid(
  interaction: import("discord.js").ChatInputCommandInteraction,
): Promise<void> {
  if (!interaction.inGuild()) return;

  const enabled = interaction.options.getBoolean("enabled");
  const threshold = interaction.options.getInteger("join_threshold");
  const window = interaction.options.getInteger("join_window");
  const action = interaction.options.getString("action") as
    | "kick"
    | "ban"
    | "alert"
    | null;
  const minAge = interaction.options.getInteger("min_account_age");
  const lockdown = interaction.options.getInteger("lockdown_minutes");
  const alertChannel = interaction.options.getChannel("alert_channel");
  const alertRole = interaction.options.getRole("alert_role");

  if (
    enabled === null &&
    threshold === null &&
    window === null &&
    action === null &&
    minAge === null &&
    lockdown === null &&
    !alertChannel &&
    !alertRole
  ) {
    await interaction.reply({
      content: "Indique au moins une option à modifier.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await updateGuildConfig(interaction.guildId, {
    raid: {
      ...(enabled !== null ? { enabled } : {}),
      ...(threshold !== null ? { joinThreshold: threshold } : {}),
      ...(window !== null ? { joinWindowSeconds: window } : {}),
      ...(action !== null ? { action } : {}),
      ...(minAge !== null ? { minAccountAgeHours: minAge } : {}),
      ...(lockdown !== null ? { lockdownMinutes: lockdown } : {}),
      ...(alertChannel ? { alertChannelId: alertChannel.id } : {}),
      ...(alertRole ? { alertRoleId: alertRole.id } : {}),
    },
  });

  const changes: string[] = [];
  if (enabled !== null) changes.push(`Protection ${enabled ? "activée ✅" : "désactivée ⛔"}`);
  if (threshold !== null) changes.push(`Seuil → ${threshold} arrivées`);
  if (window !== null) changes.push(`Fenêtre → ${window}s`);
  if (action !== null) changes.push(`Action → ${action}`);
  if (minAge !== null)
    changes.push(`Âge min. du compte → ${minAge === 0 ? "désactivé" : `${minAge}h`}`);
  if (lockdown !== null) changes.push(`Durée de verrouillage → ${lockdown} min`);
  if (alertChannel) changes.push(`Salon d'alerte → ${alertChannel.toString()}`);
  if (alertRole) changes.push(`Rôle alerté → ${alertRole.toString()}`);

  await interaction.reply({
    content: `✅ Anti-raid mis à jour :\n${changes.map((c) => `• ${c}`).join("\n")}`,
    flags: MessageFlags.Ephemeral,
  });
}

/** Handles `/goat-config antilink`: toggles the filter and edits allow-lists. */
async function configureAntiLink(
  interaction: import("discord.js").ChatInputCommandInteraction,
): Promise<void> {
  if (!interaction.inGuild()) return;

  const enabled = interaction.options.getBoolean("enabled");
  const allowRole = interaction.options.getRole("allow_role");
  const allowChannel = interaction.options.getChannel("allow_channel");
  const whitelist = interaction.options.getString("whitelist")?.toLowerCase().trim();
  const remove = interaction.options.getBoolean("remove") ?? false;

  if (enabled === null && !allowRole && !allowChannel && !whitelist) {
    await interaction.reply({
      content: "Indique au moins une option à modifier.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

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

  await interaction.reply({
    content: `✅ Anti-liens mis à jour :\n${changes.map((c) => `• ${c}`).join("\n")}`,
    flags: MessageFlags.Ephemeral,
  });
}

/** Handles `/goat-config tickets`: saves settings and optionally posts a panel. */
async function configureTickets(
  interaction: import("discord.js").ChatInputCommandInteraction,
): Promise<void> {
  if (!interaction.inGuild()) return;

  const staffRole = interaction.options.getRole("staff_role");
  const category = interaction.options.getChannel("category");
  const logChannel = interaction.options.getChannel("logs_channel");
  const panelChannel = interaction.options.getChannel("panel_channel");
  const title = interaction.options.getString("title") ?? undefined;
  const description = interaction.options.getString("description") ?? undefined;

  if (!staffRole && !category && !logChannel && !panelChannel) {
    await interaction.reply({
      content:
        "Indique au moins une option (rôle, catégorie, salon de logs, ou salon du panneau).",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

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

  await interaction.reply({
    content: `✅ Tickets mis à jour :\n${changes.map((c) => `• ${c}`).join("\n")}`,
    flags: MessageFlags.Ephemeral,
  });
}

export default command;
