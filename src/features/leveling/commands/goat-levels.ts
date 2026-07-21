import {
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import type { Command } from "../../../core/command.js";
import {
  getLevelingConfig,
  getUserLevel,
  resetLevels,
  setUserLevel,
} from "../../../core/store.js";
import {
  applyRewards,
  levelFromXp,
  removeReward,
  setReward,
  totalXpForLevel,
} from "../leveling.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("goat-levels")
    .setDescription("Gère les rôles récompenses et l'XP des membres.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addSubcommand((s) =>
      s
        .setName("add-reward")
        .setDescription("Attribue un rôle récompense à un palier de niveau.")
        .addIntegerOption((o) =>
          o
            .setName("level")
            .setDescription("Niveau à atteindre pour obtenir le rôle.")
            .setMinValue(1)
            .setRequired(true),
        )
        .addRoleOption((o) =>
          o.setName("role").setDescription("Rôle à donner.").setRequired(true),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("remove-reward")
        .setDescription("Retire le rôle récompense d'un palier.")
        .addIntegerOption((o) =>
          o
            .setName("level")
            .setDescription("Niveau du palier à retirer.")
            .setMinValue(1)
            .setRequired(true),
        ),
    )
    .addSubcommand((s) =>
      s.setName("rewards").setDescription("Liste les rôles récompenses configurés."),
    )
    .addSubcommand((s) =>
      s
        .setName("set")
        .setDescription("Définit le niveau d'un membre.")
        .addUserOption((o) =>
          o.setName("member").setDescription("Membre ciblé.").setRequired(true),
        )
        .addIntegerOption((o) =>
          o
            .setName("level")
            .setDescription("Niveau à attribuer.")
            .setMinValue(0)
            .setRequired(true),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("give")
        .setDescription("Ajoute (ou retire) de l'XP à un membre.")
        .addUserOption((o) =>
          o.setName("member").setDescription("Membre ciblé.").setRequired(true),
        )
        .addIntegerOption((o) =>
          o
            .setName("amount")
            .setDescription("XP à ajouter (négatif pour retirer).")
            .setRequired(true),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("reset")
        .setDescription("Réinitialise l'XP d'un membre (ou de tout le serveur).")
        .addUserOption((o) =>
          o
            .setName("member")
            .setDescription("Membre à réinitialiser (vide = tout le serveur)."),
        ),
    ),

  async execute(interaction) {
    if (!interaction.inGuild() || !interaction.guild) return;
    const sub = interaction.options.getSubcommand();

    if (sub === "add-reward") {
      const level = interaction.options.getInteger("level", true);
      const role = interaction.options.getRole("role", true);
      const rewards = await setReward(interaction.guildId, level, role.id);
      await interaction.reply({
        content: `✅ ${role.toString()} sera attribué au **niveau ${level}**. (${rewards.length} récompense(s) configurée(s))`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (sub === "remove-reward") {
      const level = interaction.options.getInteger("level", true);
      const removed = await removeReward(interaction.guildId, level);
      await interaction.reply({
        content: removed
          ? `🗑️ Récompense du **niveau ${level}** retirée.`
          : `Aucune récompense configurée pour le niveau ${level}.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (sub === "rewards") {
      const cfg = await getLevelingConfig(interaction.guildId);
      const rewards = [...(cfg.rewards ?? [])].sort((a, b) => a.level - b.level);
      const embed = new EmbedBuilder()
        .setColor(0xfee75c)
        .setTitle("🏅 Rôles récompenses")
        .setDescription(
          rewards.length
            ? rewards.map((r) => `Niveau **${r.level}** → <@&${r.roleId}>`).join("\n")
            : "*Aucune récompense configurée.*",
        )
        .setFooter({
          text: `Cumul des rôles : ${cfg.stackRewards === false ? "désactivé" : "activé"}`,
        });
      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      return;
    }

    if (sub === "set" || sub === "give") {
      const user = interaction.options.getUser("member", true);
      if (user.bot) {
        await interaction.reply({
          content: "Les bots ne gagnent pas d'XP.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const current = await getUserLevel(interaction.guildId, user.id);
      let newXp: number;
      if (sub === "set") {
        const level = interaction.options.getInteger("level", true);
        newXp = totalXpForLevel(level);
      } else {
        newXp = Math.max(0, current.xp + interaction.options.getInteger("amount", true));
      }

      await setUserLevel(interaction.guildId, user.id, {
        xp: newXp,
        ...(current.lastGain ? { lastGain: current.lastGain } : {}),
      });

      const newLevel = levelFromXp(newXp);
      const member = await interaction.guild.members.fetch(user.id).catch(() => null);
      if (member) {
        const cfg = await getLevelingConfig(interaction.guildId);
        await applyRewards(member, newLevel, cfg);
      }

      await interaction.reply({
        content: `✅ **${user.tag}** est désormais **niveau ${newLevel}** (${newXp} XP).`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (sub === "reset") {
      const user = interaction.options.getUser("member");
      await resetLevels(interaction.guildId, user?.id);
      await interaction.reply({
        content: user
          ? `🗑️ XP de **${user.tag}** réinitialisée.`
          : "🗑️ Classement du serveur entièrement réinitialisé.",
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};

export default command;
