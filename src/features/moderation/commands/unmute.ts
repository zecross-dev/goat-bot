import { MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import type { Command } from "../../../core/command.js";
import { notifyUser, recordCase } from "../moderation.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("unmute")
    .setDescription("Retire le timeout d'un membre.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false)
    .addUserOption((o) =>
      o.setName("member").setDescription("Membre à démuter.").setRequired(true),
    )
    .addStringOption((o) => o.setName("reason").setDescription("Raison.")),

  async execute(interaction) {
    if (!interaction.inGuild() || !interaction.guild) return;

    const user = interaction.options.getUser("member", true);
    const reason = interaction.options.getString("reason") ?? undefined;
    const target = await interaction.guild.members.fetch(user.id).catch(() => null);

    if (!target) {
      await interaction.reply({
        content: "Ce membre n'est pas sur le serveur.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (!target.isCommunicationDisabled()) {
      await interaction.reply({
        content: "Ce membre n'est pas muet.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await target.timeout(null, reason);
    await notifyUser(user, interaction.guild, "unmute", reason);
    const modCase = await recordCase(interaction.guild, {
      type: "unmute",
      user,
      moderator: interaction.user,
      reason,
    });

    await interaction.reply({
      content: `🔊 **${user.tag}** n'est plus muet (case #${modCase.id}).`,
      flags: MessageFlags.Ephemeral,
    });
  },
};

export default command;
