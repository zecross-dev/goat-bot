import {
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  time,
} from "discord.js";
import type { Command } from "../../../core/command.js";
import { getModCases } from "../../../core/store.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("warnings")
    .setDescription("Affiche l'historique de modération d'un membre.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false)
    .addUserOption((o) =>
      o.setName("member").setDescription("Membre à consulter.").setRequired(true),
    ),

  async execute(interaction) {
    if (!interaction.inGuild() || !interaction.guild) return;

    const user = interaction.options.getUser("member", true);
    const cases = (await getModCases(interaction.guild.id, user.id)).sort(
      (a, b) => b.timestamp - a.timestamp,
    );

    if (cases.length === 0) {
      await interaction.reply({
        content: `**${user.tag}** n'a aucun antécédent.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const lines = cases
      .slice(0, 15)
      .map(
        (c) =>
          `**#${c.id}** · \`${c.type}\` · ${time(Math.floor(c.timestamp / 1000), "R")}` +
          `\n└ par <@${c.moderatorId}> — ${c.reason ?? "*aucune raison*"}`,
      );

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setAuthor({ name: `Historique — ${user.tag}`, iconURL: user.displayAvatarURL() })
      .setDescription(lines.join("\n\n"))
      .setFooter({ text: `${cases.length} sanction(s) au total` });

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};

export default command;
