import {
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import type { Command } from "../../../core/command.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("banlist")
    .setDescription("Liste les utilisateurs bannis.")
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .setDMPermission(false),

  async execute(interaction) {
    if (!interaction.inGuild() || !interaction.guild) return;

    const bans = await interaction.guild.bans.fetch();
    if (bans.size === 0) {
      await interaction.reply({
        content: "Aucun utilisateur banni.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const lines = bans
      .first(25)
      .map((b) => `• **${b.user.tag}** (\`${b.user.id}\`) — ${b.reason ?? "*aucune raison*"}`);

    const embed = new EmbedBuilder()
      .setColor(0xed4245)
      .setTitle(`🔨 Bannissements — ${bans.size} au total`)
      .setDescription(lines.join("\n"))
      .setFooter(
        bans.size > 25 ? { text: `Affichage des 25 premiers sur ${bans.size}.` } : null,
      );

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};

export default command;
