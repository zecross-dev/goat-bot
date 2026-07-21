import { REST, Routes } from "discord.js";
import { config } from "./config.js";
import { loadCommands } from "./core/command-loader.js";

/**
 * Registers all slash commands with Discord. Run this whenever you add,
 * remove, or change a command's `data` (name/description/options).
 *
 *   npm run deploy
 *
 * If GUILD_ID is set, commands register to that one server instantly.
 * Otherwise they register globally (may take up to an hour to appear).
 */
const commands = await loadCommands();
const body = [...commands.values()].map((c) => c.data.toJSON());

const rest = new REST().setToken(config.token);

const route = config.guildId
  ? Routes.applicationGuildCommands(config.clientId, config.guildId)
  : Routes.applicationCommands(config.clientId);

const data = (await rest.put(route, { body })) as unknown[];

console.log(
  `Registered ${data.length} command(s) ${
    config.guildId ? `to guild ${config.guildId}` : "globally"
  }.`,
);
