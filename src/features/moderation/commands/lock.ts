import { ChannelType, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import type { Command } from "../../../core/command.js";
import { runChannelState } from "../moderation.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("lock")
    .setDescription("Verrouille un salon (empêche @everyone d'écrire).")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .setDMPermission(false)
    .addChannelOption((o) =>
      o
        .setName("channel")
        .setDescription("Salon à verrouiller (par défaut : ce salon).")
        .addChannelTypes(ChannelType.GuildText),
    )
    .addStringOption((o) => o.setName("reason").setDescription("Raison.")),

  execute: (interaction) =>
    runChannelState(interaction, {
      perms: { SendMessages: false },
      title: "🔒 Salon verrouillé",
      color: 0xed4245,
      success: "🔒 Salon verrouillé :",
    }),
};

export default command;
