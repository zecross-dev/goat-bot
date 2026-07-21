import { ChannelType, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import type { Command } from "../../../core/command.js";
import { runChannelState } from "../moderation.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("hide")
    .setDescription("Cache un salon à @everyone.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .setDMPermission(false)
    .addChannelOption((o) =>
      o
        .setName("channel")
        .setDescription("Salon à cacher (par défaut : ce salon).")
        .addChannelTypes(ChannelType.GuildText),
    )
    .addStringOption((o) => o.setName("reason").setDescription("Raison.")),

  execute: (interaction) =>
    runChannelState(interaction, {
      perms: { ViewChannel: false },
      title: "🙈 Salon caché",
      color: 0xed4245,
      success: "🙈 Salon caché :",
    }),
};

export default command;
