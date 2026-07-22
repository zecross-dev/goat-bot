import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type Client,
} from "discord.js";
import { getAllPanels } from "../../core/store.js";

/**
 * Ticket panel: the message with one create-button per ticket type, plus the
 * shared ticket-type catalog and customId helpers used across the feature.
 * Setup (category, staff role, log channel) lives in the per-guild store and is
 * edited via `/goat-config`; the create button only carries the ticket type, so
 * re-configuring takes effect on existing panels.
 */

export const CREATE_PREFIX = "ticket:create";
export const CLOSE_ID = "ticket:close";

/** The kinds of ticket the panel offers. Add an entry to add a button. */
interface TypeConfig {
  label: string;
  emoji: string;
  style: ButtonStyle;
  title: string;
  color: number;
  intro: string;
  /** When true, clicking the button opens the project-intake modal first. */
  intake: boolean;
}

export const TICKET_TYPES = {
  support: {
    label: "Support",
    emoji: "🎫",
    style: ButtonStyle.Primary,
    title: "🎫 Ticket support",
    color: 0x5865f2,
    intro:
      "Explique ta question ou ton problème en détail, un membre du staff te répondra dès que possible.",
    intake: false,
  },
  commande: {
    label: "Passer commande",
    emoji: "🛒",
    style: ButtonStyle.Success,
    title: "🛒 Nouvelle commande",
    color: 0x57f287,
    intro:
      "Décris ta commande (produit, quantité, détails). Le staff s'en occupe dès que possible.",
    intake: true,
  },
} satisfies Record<string, TypeConfig>;

export type TicketType = keyof typeof TICKET_TYPES;

export function isTicketType(value: string): value is TicketType {
  return value in TICKET_TYPES;
}

/** Whether opening this ticket type should present the intake questionnaire. */
export function requiresIntake(type: TicketType): boolean {
  return TICKET_TYPES[type].intake;
}

/** Markers written into a ticket channel's topic to describe it. */
export const ownerTag = (userId: string) => `creator:${userId}`;
export const typeTag = (type: TicketType) => `type:${type}`;

/** Whether a channel topic identifies it as a ticket channel. */
export function isTicketChannel(topic: string | null | undefined): boolean {
  return !!topic && topic.includes("creator:") && topic.includes("type:");
}

/**
 * Extracts the ticket owner's user id from a channel topic (the counterpart of
 * `ownerTag`). Kept here so the topic format lives in a single place.
 */
export function parseOwnerId(topic: string | null | undefined): string | undefined {
  return topic?.match(/creator:(\d+)/)?.[1];
}

/** Encodes a ticket type into a create-button customId. */
function buildCreateId(type: TicketType): string {
  return `${CREATE_PREFIX}:${type}`;
}

/** Parses the ticket type back out of a create-button customId. */
export function parseCreateType(customId: string): TicketType {
  const type = customId.split(":")[2];
  return type && isTicketType(type) ? type : "support";
}

/** Whether a button press belongs to the ticket system. */
export function isTicketButton(customId: string): boolean {
  return customId.startsWith(CREATE_PREFIX) || customId === CLOSE_ID;
}

const DEFAULT_DESCRIPTION =
  "Choisis le type de ticket ci-dessous pour ouvrir un salon privé avec le staff.\n\n" +
  "🎫 **Support** — questions, problèmes, aide.\n" +
  "🛒 **Passer commande** — pour commander.\n\n" +
  "⚠️ Un seul ticket ouvert par type à la fois.";

const OFFLINE_DESCRIPTION =
  "🔧 **Maintenance en cours** — l'ouverture de tickets est momentanément " +
  "désactivée, le bot est hors ligne. Reviens dans un instant !";

/**
 * Builds the pre-made panel message (one button per ticket type). When
 * `disabled` is true it renders the "offline / maintenance" variant with a
 * greyed banner and inert buttons.
 */
export function buildPanel(
  options: { title?: string; description?: string } = {},
  { disabled = false }: { disabled?: boolean } = {},
) {
  const embed = new EmbedBuilder()
    .setColor(disabled ? 0x747f8d : 0x5865f2)
    .setTitle(options.title ?? "🎫 Support — Ouvrir un ticket")
    .setDescription(
      disabled ? OFFLINE_DESCRIPTION : options.description ?? DEFAULT_DESCRIPTION,
    );

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    (Object.keys(TICKET_TYPES) as TicketType[]).map((type) => {
      const t = TICKET_TYPES[type];
      return new ButtonBuilder()
        .setCustomId(buildCreateId(type))
        .setLabel(t.label)
        .setEmoji(t.emoji)
        .setStyle(t.style)
        .setDisabled(disabled);
    }),
  );

  return { embeds: [embed], components: [row] };
}

/**
 * Re-edits every stored panel in place to the online (active) or offline
 * (maintenance) state. Called on startup (`disabled: false`) and shutdown
 * (`disabled: true`) so integrations update without being re-posted.
 */
export async function refreshPanels(
  client: Client,
  disabled: boolean,
): Promise<void> {
  const panels = await getAllPanels();
  let updated = 0;

  for (const ref of panels) {
    try {
      const channel = await client.channels.fetch(ref.channelId);
      if (!channel?.isTextBased()) continue;
      const message = await channel.messages.fetch(ref.messageId);
      await message.edit(
        buildPanel(
          { title: ref.title, description: ref.description },
          { disabled },
        ),
      );
      updated++;
    } catch (error) {
      console.error(`[tickets] Could not refresh panel ${ref.messageId}:`, error);
    }
  }

  console.log(
    `[tickets] ${updated}/${panels.length} panneau(x) passé(s) en ${
      disabled ? "maintenance" : "actif"
    }.`,
  );
}
