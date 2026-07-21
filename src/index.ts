import { Client, Events, GatewayIntentBits, MessageFlags } from "discord.js";
import { config } from "./config.js";
import { loadCommands } from "./core/command-loader.js";
import { isTicketButton, refreshPanels } from "./features/tickets/panel.js";
import { handleTicketButton, handleTicketModal } from "./features/tickets/tickets.js";
import { isIntakeModal } from "./features/tickets/intake.js";
import { handleTicketConversation } from "./features/tickets/conversation.js";
import {
  handleEmbedInteraction,
  isEmbedInteraction,
} from "./features/embed/editor.js";
import { handleMemberJoin } from "./features/welcome/welcome.js";
import { handleConfigButton, isConfigButton } from "./features/config/config-ui.js";
import { sweepExpiredTempActions } from "./features/moderation/sweeper.js";
import { hasCommandAccess } from "./features/permissions/permissions.js";
import { handleMessage as handleLevelingMessage } from "./features/leveling/leveling.js";
import { handleJoin as handleRaidJoin } from "./features/raid/raid.js";
import { handleMessage as handleAntiLink } from "./features/antilink/antilink.js";

const client = new Client({
  // Guilds is enough for slash commands + tickets. GuildMembers is privileged
  // (welcome messages) and must ALSO be enabled in the Discord Developer
  // Portal → Bot → Privileged Gateway Intents → Server Members Intent.
  // GuildMessages (non-privileged) lets the leveling system count messages.
  // MessageContent (PRIVILEGED) lets the anti-link filter read message text —
  // it must ALSO be enabled in the Developer Portal → Bot → Privileged Gateway
  // Intents → Message Content Intent. Without it, message.content is empty.
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const commands = await loadCommands();

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`Logged in as ${readyClient.user.tag}`);
  console.log(`Loaded ${commands.size} command(s): ${[...commands.keys()].join(", ")}`);
  // Re-activate every stored panel in place (re-enables buttons, reapplies
  // the latest panel content) — no need to delete and re-post integrations.
  await refreshPanels(readyClient, false);

  // Lift expired tempbans now, then check again every minute.
  await sweepExpiredTempActions(readyClient);
  setInterval(() => void sweepExpiredTempActions(readyClient), 60_000);
});

client.on(Events.GuildMemberAdd, async (member) => {
  try {
    // Anti-raid runs first: if it removes the member, skip the welcome.
    const blocked = await handleRaidJoin(member);
    if (blocked) return;
    await handleMemberJoin(member);
  } catch (error) {
    console.error("Error handling member join:", error);
  }
});

client.on(Events.MessageCreate, async (message) => {
  try {
    // Anti-link first: a deleted message shouldn't also earn XP.
    const deleted = await handleAntiLink(message);
    if (deleted) return;
    // Advance any in-progress ticket intake conversation.
    await handleTicketConversation(message);
    await handleLevelingMessage(message);
  } catch (error) {
    console.error("Error handling message:", error);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  // Embed editor: buttons, modals and select menus all share the embed: prefix.
  if (
    (interaction.isButton() ||
      interaction.isModalSubmit() ||
      interaction.isAnySelectMenu()) &&
    isEmbedInteraction(interaction.customId)
  ) {
    try {
      await handleEmbedInteraction(interaction);
    } catch (error) {
      console.error("Error handling embed editor:", error);
    }
    return;
  }

  // Button presses: ticket system, then config-UI (panel deletion).
  if (interaction.isButton()) {
    if (!isTicketButton(interaction.customId) && !isConfigButton(interaction.customId)) {
      return;
    }
    try {
      if (isTicketButton(interaction.customId)) {
        await handleTicketButton(interaction);
      } else {
        await handleConfigButton(interaction);
      }
    } catch (error) {
      console.error("Error handling button:", error);
      const content = "Une erreur est survenue.";
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content, flags: MessageFlags.Ephemeral });
      } else {
        await interaction.reply({ content, flags: MessageFlags.Ephemeral });
      }
    }
    return;
  }

  // Modal submissions: the ticket project-intake form.
  if (interaction.isModalSubmit()) {
    if (!isIntakeModal(interaction.customId)) return;
    try {
      await handleTicketModal(interaction);
    } catch (error) {
      console.error("Error handling modal:", error);
      const content = "Une erreur est survenue.";
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content, flags: MessageFlags.Ephemeral });
      } else {
        await interaction.reply({ content, flags: MessageFlags.Ephemeral });
      }
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  const command = commands.get(interaction.commandName);
  if (!command) {
    console.warn(`No handler for command "${interaction.commandName}".`);
    return;
  }

  // Internal granular permission gate (on top of Discord's own permissions).
  if (interaction.inGuild() && interaction.guild) {
    const member = await interaction.guild.members.fetch(interaction.user.id);
    if (!(await hasCommandAccess(member, interaction.commandName))) {
      await interaction.reply({
        content: "⛔ Tu n'as pas la permission d'utiliser cette commande.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`Error running "${interaction.commandName}":`, error);
    const content = "Something went wrong running that command.";
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content, flags: MessageFlags.Ephemeral });
    } else {
      await interaction.reply({ content, flags: MessageFlags.Ephemeral });
    }
  }
});

// Graceful shutdown: flip every panel to "maintenance" (banner + disabled
// buttons) before disconnecting, so integrations reflect the bot being down.
let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n${signal} reçu — passage des intégrations en maintenance…`);
  try {
    await refreshPanels(client, true);
  } catch (error) {
    console.error("Error during shutdown refresh:", error);
  }
  await client.destroy();
  process.exit(0);
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => void shutdown(signal));
}

await client.login(config.token);
