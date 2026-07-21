import { MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import type { Command } from "../../../core/command.js";
import { checkActable, notifyUser, recordCase } from "../moderation.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Bannit un membre (ou un utilisateur par ID).")
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .setDMPermission(false)
    .addUserOption((o) =>
      o.setName("user").setDescription("Utilisateur à bannir.").setRequired(true),
    )
    .addStringOption((o) => o.setName("reason").setDescription("Raison du bannissement."))
    .addIntegerOption((o) =>
      o
        .setName("delete_days")
        .setDescription("Jours de messages à supprimer (0-7).")
        .setMinValue(0)
        .setMaxValue(7),
    ),

  async execute(interaction) {
    if (!interaction.inGuild() || !interaction.guild) return;

    const user = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("reason") ?? undefined;
    const deleteDays = interaction.options.getInteger("delete_days") ?? 0;
    const moderator = await interaction.guild.members.fetch(interaction.user.id);
    const target = await interaction.guild.members.fetch(user.id).catch(() => null);

    if (target) {
      const error = checkActable(moderator, target);
      if (error) {
        await interaction.reply({ content: error, flags: MessageFlags.Ephemeral });
        return;
      }
    }

    if (target) await notifyUser(user, interaction.guild, "ban", reason);
    await interaction.guild.members.ban(user.id, {
      reason,
      deleteMessageSeconds: deleteDays * 86_400,
    });
    const modCase = await recordCase(interaction.guild, {
      type: "ban",
      user,
      moderator: interaction.user,
      reason,
    });

    await interaction.reply({
      content: `🔨 **${user.tag}** a été banni (case #${modCase.id}).`,
      flags: MessageFlags.Ephemeral,
    });
  },
};

export default command;
