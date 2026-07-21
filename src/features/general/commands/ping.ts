import { SlashCommandBuilder } from "discord.js";
import type { Command } from "../../../core/command.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Replies with Pong and the round-trip latency."),

  async execute(interaction) {
    const sent = await interaction.reply({
      content: "Pinging...",
      withResponse: true,
    });
    const roundtrip =
      (sent.resource?.message?.createdTimestamp ?? Date.now()) -
      interaction.createdTimestamp;
    await interaction.editReply(
      `Pong! Roundtrip: ${roundtrip}ms | WebSocket: ${interaction.client.ws.ping}ms`,
    );
  },
};

export default command;
