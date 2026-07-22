import {
  ActionRowBuilder,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ModalSubmitInteraction,
} from "discord.js";
import { TICKET_TYPES, isTicketType, type TicketType } from "./panel.js";

/**
 * Project-intake questionnaire shown when a client opens a "Passer commande"
 * ticket. The Discord modal keeps only the **quick, one-line info** (no
 * privileged intent); the two longer, open-ended questions (objective and
 * progress) are asked afterwards in the guided, one-question-at-a-time
 * conversation (see `conversation.ts`). The ticket channel first posts a clean
 * recap of the modal answers, then starts that conversation.
 */

export const INTAKE_PREFIX = "ticket:intake";

/** TextInput customIds — also used to read the answers back on submit. */
const FIELD = {
  nom: "projet_nom",
  budget: "projet_budget",
  equipe: "projet_equipe",
} as const;

/** Whether a modal submission is a ticket-intake form. */
export function isIntakeModal(customId: string): boolean {
  return customId.startsWith(INTAKE_PREFIX);
}

/** Recovers the ticket type encoded in an intake modal's customId. */
export function parseIntakeType(customId: string): TicketType {
  const type = customId.split(":")[2];
  return type && isTicketType(type) ? type : "commande";
}

/** Builds the intake modal for a ticket type. */
export function buildIntakeModal(type: TicketType): ModalBuilder {
  const row = (input: TextInputBuilder) =>
    new ActionRowBuilder<TextInputBuilder>().addComponents(input);

  return new ModalBuilder()
    .setCustomId(`${INTAKE_PREFIX}:${type}`)
    .setTitle("Parle-nous de ton projet")
    .addComponents(
      row(
        new TextInputBuilder()
          .setCustomId(FIELD.nom)
          .setLabel("Nom du projet")
          .setStyle(TextInputStyle.Short)
          .setMaxLength(100)
          .setRequired(true),
      ),
      row(
        new TextInputBuilder()
          .setCustomId(FIELD.budget)
          .setLabel("Budget (approximatif)")
          .setStyle(TextInputStyle.Short)
          .setMaxLength(100)
          .setPlaceholder("Ex : 50 €, à discuter, aucun…")
          .setRequired(false),
      ),
      row(
        new TextInputBuilder()
          .setCustomId(FIELD.equipe)
          .setLabel("Votre équipe + taille du Discord")
          .setStyle(TextInputStyle.Short)
          .setMaxLength(200)
          .setPlaceholder("Ex : 3 personnes, ~500 membres")
          .setRequired(false),
      ),
    );
}

/** Reads a modal field, trimmed, or a placeholder when left empty. */
function field(interaction: ModalSubmitInteraction, id: string): string {
  const value = interaction.fields.getTextInputValue(id).trim();
  return value || "*non précisé*";
}

/** The submitted project name (for naming the channel), or a fallback. */
export function intakeProjectName(interaction: ModalSubmitInteraction): string {
  return interaction.fields.getTextInputValue(FIELD.nom).trim() || "projet";
}

/** Builds the recap embed staff sees, from the submitted answers. */
export function buildIntakeRecap(
  interaction: ModalSubmitInteraction,
  type: TicketType,
): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(TICKET_TYPES[type].color)
    .setTitle("📋 Récapitulatif du projet")
    .addFields(
      { name: "📛 Nom du projet", value: field(interaction, FIELD.nom) },
      { name: "💰 Budget", value: field(interaction, FIELD.budget), inline: true },
      {
        name: "👥 Équipe & Discord",
        value: field(interaction, FIELD.equipe),
        inline: true,
      },
    )
    .setFooter({ text: "Formulaire rempli à l'ouverture du ticket" })
    .setTimestamp();
}
