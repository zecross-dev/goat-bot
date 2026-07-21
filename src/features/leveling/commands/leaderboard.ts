import { MessageFlags, SlashCommandBuilder } from "discord.js";
import type { Command } from "../../../core/command.js";
import { getLeaderboard, getLevelingConfig } from "../../../core/store.js";
import { buildLeaderboardEmbed } from "../leveling.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("Affiche le classement des membres par XP.")
    .setDMPermission(false),

  async execute(interaction) {
    if (!interaction.inGuild() || !interaction.guild) return;

    const cfg = await getLevelingConfig(interaction.guildId);
    if (!cfg.enabled) {
      await interaction.reply({
        content: "Le système de niveaux n'est pas activé sur ce serveur.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const board = await getLeaderboard(interaction.guildId);
    const embed = await buildLeaderboardEmbed(interaction.guild, board);
    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
