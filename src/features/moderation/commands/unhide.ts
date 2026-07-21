import { ChannelType, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import type { Command } from "../../../core/command.js";
import { runChannelState } from "../moderation.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("unhide")
    .setDescription("Rend un salon de nouveau visible à @everyone.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .setDMPermission(false)
    .addChannelOption((o) =>
      o
        .setName("channel")
        .setDescription("Salon à réafficher (par défaut : ce salon).")
        .addChannelTypes(ChannelType.GuildText),
    )
    .addStringOption((o) => o.setName("reason").setDescription("Raison.")),

  execute: (interaction) =>
    runChannelState(interaction, {
      perms: { ViewChannel: null },
      title: "👁️ Salon réaffiché",
      color: 0x57f287,
      success: "👁️ Salon de nouveau visible :",
    }),
};

export default command;
