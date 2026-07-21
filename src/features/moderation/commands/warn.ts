import { MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import type { Command } from "../../../core/command.js";
import { checkActable, notifyUser, recordCase } from "../moderation.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Avertit un membre.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false)
    .addUserOption((o) =>
      o.setName("member").setDescription("Membre à avertir.").setRequired(true),
    )
    .addStringOption((o) => o.setName("reason").setDescription("Raison de l'avertissement.")),

  async execute(interaction) {
    if (!interaction.inGuild() || !interaction.guild) return;

    const user = interaction.options.getUser("member", true);
    const reason = interaction.options.getString("reason") ?? undefined;
    const moderator = await interaction.guild.members.fetch(interaction.user.id);
    const target = await interaction.guild.members.fetch(user.id).catch(() => null);

    if (target) {
      const error = checkActable(moderator, target);
      if (error) {
        await interaction.reply({ content: error, flags: MessageFlags.Ephemeral });
        return;
      }
    }

    await notifyUser(user, interaction.guild, "warn", reason);
    const modCase = await recordCase(interaction.guild, {
      type: "warn",
      user,
      moderator: interaction.user,
      reason,
    });

    await interaction.reply({
      content: `⚠️ **${user.tag}** a été averti (case #${modCase.id}).`,
      flags: MessageFlags.Ephemeral,
    });
  },
};

export default command;
