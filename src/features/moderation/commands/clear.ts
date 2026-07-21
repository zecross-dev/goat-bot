import {
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import type { Command } from "../../../core/command.js";
import { postModLog } from "../moderation.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("clear")
    .setDescription("Supprime en masse des messages du salon.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setDMPermission(false)
    .addIntegerOption((o) =>
      o
        .setName("amount")
        .setDescription("Nombre de messages (1-100).")
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(true),
    )
    .addUserOption((o) =>
      o.setName("member").setDescription("Ne supprimer que les messages de ce membre."),
    ),

  async execute(interaction) {
    if (!interaction.inGuild() || !interaction.guild) return;

    const channel = interaction.channel;
    if (!channel || channel.isDMBased() || !channel.isTextBased()) {
      await interaction.reply({
        content: "Cette commande s'utilise dans un salon textuel.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const amount = interaction.options.getInteger("amount", true);
    const member = interaction.options.getUser("member");

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    let deletedCount: number;
    if (member) {
      const messages = await channel.messages.fetch({ limit: 100 });
      const toDelete = messages.filter((m) => m.author.id === member.id).first(amount);
      const deleted = await channel.bulkDelete(toDelete, true);
      deletedCount = deleted.size;
    } else {
      const deleted = await channel.bulkDelete(amount, true);
      deletedCount = deleted.size;
    }

    await postModLog(
      interaction.guild,
      new EmbedBuilder()
        .setColor(0x99aab5)
        .setTitle("🧹 Nettoyage de messages")
        .addFields(
          { name: "Salon", value: `<#${channel.id}>`, inline: true },
          { name: "Supprimés", value: `${deletedCount}`, inline: true },
          { name: "Modérateur", value: `<@${interaction.user.id}>`, inline: true },
          ...(member ? [{ name: "Filtre", value: `<@${member.id}>`, inline: true }] : []),
        )
        .setTimestamp(),
    );

    await interaction.editReply(
      `🧹 ${deletedCount} message(s) supprimé(s)` +
        (deletedCount === 0
          ? " (les messages de plus de 14 jours ne peuvent pas être supprimés en masse)."
          : "."),
    );
  },
};

export default command;
