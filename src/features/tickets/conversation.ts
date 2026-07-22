import { EmbedBuilder, type GuildTextBasedChannel, type Message } from "discord.js";
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

/** Each question: a heading (with its own emoji) and the prompt itself. */
export const TICKET_QUESTIONS = [
  {
    emoji: "🎯",
    heading: "Ton objectif",
    prompt:
      "Que veux-tu créer ? Décris en quelques lignes le but de ton projet.",
  },
  {
    emoji: "🛠️",
    heading: "Ce que tu as déjà essayé",
    prompt: "Outils testés, ce qui bloque, où tu en es dans l'avancement.",
  },
  {
    emoji: "✨",
    heading: "Les fonctionnalités",
    prompt: "Quelles **fonctionnalités précises** aimerais-tu pour ton projet / bot ?",
  },
  {
    emoji: "📅",
    heading: "L'échéance",
    prompt: "Pour **quand** espères-tu lancer, et as-tu une deadline ?",
  },
  {
    emoji: "💡",
    heading: "Tes inspirations",
    prompt: "As-tu des **exemples, bots ou serveurs** dont tu t'inspires ?",
  },
];

/** A subtle progress bar, e.g. ●●○○○ for question 3 of 5. */
function progressBar(index: number): string {
  const done = "●".repeat(index + 1);
  const left = "○".repeat(TICKET_QUESTIONS.length - index - 1);
  return `${done}${left}`;
}

/**
 * Formats a single question using **native Discord markdown** (no embed):
 * a `##` heading, a `>` block-quote for the prompt, and a `-#` subtext line
 * carrying the progress bar.
 */
function formatQuestion(index: number): string {
  const q = TICKET_QUESTIONS[index];
  return (
    `## ${q.emoji}  ${q.heading}\n` +
    `> ${q.prompt}\n` +
    `-# ${progressBar(index)}  ·  réponds juste en dessous 👇`
  );
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
  const staffPing = staffRoleId ? `<@&${staffRoleId}>` : "le staff";

  const done = new EmbedBuilder()
    .setColor(0x57f287)
    .setAuthor({ name: "✅  Merci, tout est noté !" })
    .setDescription(
      `Tes réponses sont bien enregistrées 🙌\n` +
        `Un membre du staff (${staffPing}) va prendre le relais très vite.`,
    )
    .setFooter({ text: "Tu peux fermer le ticket à tout moment." });

  // The ping lives in `content` — mentions inside an embed never notify.
  await channel.send({
    content: `<@${session.ownerId}>${staffRoleId ? ` <@&${staffRoleId}>` : ""}`,
    embeds: [done],
    allowedMentions: {
      users: [session.ownerId],
      roles: staffRoleId ? [staffRoleId] : [],
    },
  });
}
