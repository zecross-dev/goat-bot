import {
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import type { Command } from "../../../core/command.js";
import { checkRoleManageable, postModLog } from "../moderation.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("addrole")
    .setDescription("Ajoute un rôle à un membre.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .setDMPermission(false)
    .addUserOption((o) =>
      o.setName("member").setDescription("Membre concerné.").setRequired(true),
    )
    .addRoleOption((o) =>
      o.setName("role").setDescription("Rôle à ajouter.").setRequired(true),
    ),

  async execute(interaction) {
    if (!interaction.inGuild() || !interaction.guild) return;

    const user = interaction.options.getUser("member", true);
    const role = interaction.options.getRole("role", true);
    const moderator = await interaction.guild.members.fetch(interaction.user.id);
    const target = await interaction.guild.members.fetch(user.id).catch(() => null);

    if (!target) {
      await interaction.reply({
        content: "Ce membre n'est pas sur le serveur.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const error = checkRoleManageable(moderator, interaction.guild.roles.cache.get(role.id)!);
    if (error) {
      await interaction.reply({ content: error, flags: MessageFlags.Ephemeral });
      return;
    }

    if (target.roles.cache.has(role.id)) {
      await interaction.reply({
        content: `**${user.tag}** a déjà le rôle ${role.toString()}.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await target.roles.add(role.id, `Par ${interaction.user.tag}`);
    await postModLog(
      interaction.guild,
      new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle("➕ Rôle ajouté")
        .addFields(
          { name: "Membre", value: `<@${user.id}>`, inline: true },
          { name: "Rôle", value: `<@&${role.id}>`, inline: true },
          { name: "Modérateur", value: `<@${interaction.user.id}>`, inline: true },
        )
        .setTimestamp(),
    );

    await interaction.reply({
      content: `➕ Rôle ${role.toString()} ajouté à **${user.tag}**.`,
      flags: MessageFlags.Ephemeral,
    });
  },
};

export default command;
