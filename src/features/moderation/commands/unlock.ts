import { ChannelType, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import type { Command } from "../../../core/command.js";
import { runChannelState } from "../moderation.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("unlock")
    .setDescription("Déverrouille un salon (rend l'écriture à @everyone).")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .setDMPermission(false)
    .addChannelOption((o) =>
      o
        .setName("channel")
        .setDescription("Salon à déverrouiller (par défaut : ce salon).")
        .addChannelTypes(ChannelType.GuildText),
    )
    .addStringOption((o) => o.setName("reason").setDescription("Raison.")),

  execute: (interaction) =>
    runChannelState(interaction, {
      perms: { SendMessages: null },
      title: "🔓 Salon déverrouillé",
      color: 0x57f287,
      success: "🔓 Salon déverrouillé :",
    }),
};

export default command;
