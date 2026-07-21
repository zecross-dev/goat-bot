import {
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import type { Command } from "../../../core/command.js";
import { importEmbedFromLink, openEditor } from "../editor.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("embed")
    .setDescription("Ouvre l'éditeur d'embed interactif (aperçu + envoi/édition).")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addStringOption((o) =>
      o
        .setName("message")
        .setDescription("Lien d'un message à importer pour l'éditer."),
    ),

  async execute(interaction) {
    if (!interaction.inGuild()) return;

    const link = interaction.options.getString("message");
    if (link) {
      const draft = await importEmbedFromLink(interaction.client, link);
      if (!draft) {
        await interaction.reply({
          content: "Impossible d'importer : lien invalide ou message sans embed.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await openEditor(interaction, draft);
      return;
    }

    await openEditor(interaction);
  },
};

export default command;
