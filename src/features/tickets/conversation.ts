import type { GuildTextBasedChannel, Message } from "discord.js";
import {
  clearTicketSession,
  getGuildConfig,
  getTicketSession,
  setTicketSession,
} from "../../core/store.js";

/**
 * Ticket intake conversation: after the modal, the bot walks the ticket owner
 * through a few questions **one at a time** — each answer triggers the next
 * question, and once all are answered it thanks them and pings the staff role.
 *
 * The bot only reacts to the *fact* that the owner replied (not the content),
 * so this needs no privileged intent — the staff reads the actual answers.
 * Session progress is persisted in the store so it survives a restart.
 */

export const TICKET_QUESTIONS = [
  "Quelles **fonctionnalités précises** aimerais-tu pour ton projet / bot ?",
  "Pour **quand** espères-tu lancer, et as-tu une échéance ?",
  "As-tu des **exemples, bots ou serveurs** dont tu t'inspires ?",
];

/** Formats a question with its position, e.g. **Question 1/3**. */
function formatQuestion(index: number): string {
  return `**Question ${index + 1}/${TICKET_QUESTIONS.length}**\n${TICKET_QUESTIONS[index]}`;
}

/** Posts the first question and opens the session for a ticket channel. */
export async function startTicketConversation(
  channel: GuildTextBasedChannel,
  ownerId: string,
  guildId: string,
): Promise<void> {
  if (!channel.isSendable()) return;
  await channel.send(formatQuestion(0));
  await setTicketSession(guildId, channel.id, { ownerId, step: 0 });
}

/**
 * Advances the intake conversation when the ticket owner replies: posts the
 * next question, or (after the last answer) thanks them and pings staff.
 * No-ops for non-ticket channels and non-owner authors.
 */
export async function handleTicketConversation(message: Message): Promise<void> {
  if (message.author.bot || message.system) return;
  if (!message.inGuild()) return;

  const session = await getTicketSession(message.guildId, message.channelId);
  if (!session || message.author.id !== session.ownerId) return;

  const channel = message.channel;
  if (!channel.isSendable()) return;

  const answered = session.step + 1;

  // More questions to go → ask the next one.
  if (answered < TICKET_QUESTIONS.length) {
    await channel.send(formatQuestion(answered));
    await setTicketSession(message.guildId, message.channelId, {
      ownerId: session.ownerId,
      step: answered,
    });
    return;
  }

  // All answered → close the session, thank the owner, and hand off to staff.
  await clearTicketSession(message.guildId, message.channelId);
  const staffRoleId = (await getGuildConfig(message.guildId)).tickets?.staffRoleId;
  const staffPing = staffRoleId ? ` <@&${staffRoleId}>` : "";

  await channel.send({
    content:
      `Merci pour tes réponses <@${session.ownerId}> ! 🙌\n` +
      `Toutes les infos sont réunies — un membre du staff${staffPing} va prendre le relais.`,
    allowedMentions: {
      users: [session.ownerId],
      roles: staffRoleId ? [staffRoleId] : [],
    },
  });
}
