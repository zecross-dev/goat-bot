import { MessageFlags, SlashCommandBuilder } from "discord.js";
import type { Command } from "../../../core/command.js";
import { getLevelingConfig, getLeaderboard, getUserLevel } from "../../../core/store.js";
import { buildRankEmbed } from "../leveling.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("level")
    .setDescription("Affiche ton niveau et ta progression (ou ceux d'un membre).")
    .setDMPermission(false)
    .addUserOption((o) =>
      o.setName("member").setDescription("Membre dont afficher le niveau."),
    ),

  async execute(interaction) {
    if (!interaction.inGuild()) return;

    const cfg = await getLevelingConfig(interaction.guildId);
    if (!cfg.enabled) {
      await interaction.reply({
        content: "Le système de niveaux n'est pas activé sur ce serveur.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const user = interaction.options.getUser("member") ?? interaction.user;
    if (user.bot) {
      await interaction.reply({
        content: "Les bots ne gagnent pas d'XP.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const { xp } = await getUserLevel(interaction.guildId, user.id);
    const board = await getLeaderboard(interaction.guildId);
    const rankIndex = board.findIndex((e) => e.userId === user.id);
    const rank = rankIndex === -1 ? null : rankIndex + 1;

    await interaction.reply({ embeds: [buildRankEmbed(user, xp, rank)] });
  },
};

export default command;
