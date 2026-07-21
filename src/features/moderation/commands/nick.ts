import {
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import type { Command } from "../../../core/command.js";
import { checkActable, postModLog } from "../moderation.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("nick")
    .setDescription("Change (ou réinitialise) le pseudo d'un membre.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames)
    .setDMPermission(false)
    .addUserOption((o) =>
      o.setName("member").setDescription("Membre concerné.").setRequired(true),
    )
    .addStringOption((o) =>
      o
        .setName("nickname")
        .setDescription("Nouveau pseudo (laisser vide pour réinitialiser).")
        .setMaxLength(32),
    ),

  async execute(interaction) {
    if (!interaction.inGuild() || !interaction.guild) return;

    const user = interaction.options.getUser("member", true);
    const nickname = interaction.options.getString("nickname");
    const moderator = await interaction.guild.members.fetch(interaction.user.id);
    const target = await interaction.guild.members.fetch(user.id).catch(() => null);

    if (!target) {
      await interaction.reply({
        content: "Ce membre n'est pas sur le serveur.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const error = checkActable(moderator, target);
    if (error) {
      await interaction.reply({ content: error, flags: MessageFlags.Ephemeral });
      return;
    }

    await target.setNickname(nickname, `Par ${interaction.user.tag}`);
    await postModLog(
      interaction.guild,
      new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle("🏷️ Pseudo modifié")
        .addFields(
          { name: "Membre", value: `<@${user.id}>`, inline: true },
          { name: "Nouveau pseudo", value: nickname ?? "*réinitialisé*", inline: true },
          { name: "Modérateur", value: `<@${interaction.user.id}>`, inline: true },
        )
        .setTimestamp(),
    );

    await interaction.reply({
      content: nickname
        ? `🏷️ Pseudo de **${user.tag}** changé en \`${nickname}\`.`
        : `🏷️ Pseudo de **${user.tag}** réinitialisé.`,
      flags: MessageFlags.Ephemeral,
    });
  },
};

export default command;
