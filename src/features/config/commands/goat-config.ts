import {
  ChannelType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import type { Command } from "../../../core/command.js";
import { WELCOME_PLACEHOLDERS } from "../../welcome/welcome.js";
import { TICKET_TYPES } from "../../tickets/panel.js";
import { updateGuildConfig } from "../../../core/store.js";
import { buildConfigDisplay } from "../config-ui.js";
import { configureTickets } from "../handlers/tickets.js";
import { configureLevels } from "../handlers/levels.js";
import { configureRaid } from "../handlers/raid.js";
import { configureAntiLink } from "../handlers/antilink.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("goat-config")
    .setDescription("Configure les intégrations du bot (tickets, arrivées).")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addSubcommand((sub) => {
      sub
        .setName("tickets")
        .setDescription("Configure le système de tickets et publie son panneau.")
        .addRoleOption((o) =>
          o.setName("staff_role").setDescription("Rôle qui voit et gère les tickets."),
        );
      // One destination-category option per ticket type (e.g. support_category).
      for (const [type, cfg] of Object.entries(TICKET_TYPES)) {
        sub.addChannelOption((o) =>
          o
            .setName(`${type}_category`)
            .setDescription(`Catégorie où créer les tickets « ${cfg.label} ».`)
            .addChannelTypes(ChannelType.GuildCategory),
        );
      }
      return sub
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
        );
    })
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

export default command;
