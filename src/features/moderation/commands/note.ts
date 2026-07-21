import { MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import type { Command } from "../../../core/command.js";
import { recordCase } from "../moderation.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("note")
    .setDescription("Ajoute une note interne sur un membre (non notifiée).")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false)
    .addUserOption((o) =>
      o.setName("member").setDescription("Membre concerné.").setRequired(true),
    )
    .addStringOption((o) =>
      o.setName("content").setDescription("Contenu de la note.").setRequired(true),
    ),

  async execute(interaction) {
    if (!interaction.inGuild() || !interaction.guild) return;

    const user = interaction.options.getUser("member", true);
    const content = interaction.options.getString("content", true);

    const modCase = await recordCase(interaction.guild, {
      type: "note",
      user,
      moderator: interaction.user,
      reason: content,
    });

    await interaction.reply({
      content: `📝 Note ajoutée sur **${user.tag}** (case #${modCase.id}).`,
      flags: MessageFlags.Ephemeral,
    });
  },
};

export default command;
