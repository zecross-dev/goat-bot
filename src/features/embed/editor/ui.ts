import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type BaseMessageOptions,
  type MessageActionRowComponentBuilder,
} from "discord.js";
import { buildEmbed, type EmbedDraft } from "./draft.js";
import { PREFIX } from "./session.js";

/**
 * Editor UI: the ephemeral panel (live preview + button rows) and every modal
 * used to edit a part of the draft. Pure builders — no interaction handling.
 */

export function editorMessage(draft: EmbedDraft): BaseMessageOptions {
  const rows: ActionRowBuilder<MessageActionRowComponentBuilder>[] = [
    new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
      button("content", "Contenu", "✏️"),
      button("color", "Couleur", "🎨"),
      button("media", "Médias", "🖼️"),
      button("author", "Auteur / Footer", "👤"),
    ),
    new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
      button("field-add", "Ajouter un champ", "➕"),
      button("field-clear", "Vider les champs", "🧹", ButtonStyle.Secondary),
      button("import", "Importer", "📥", ButtonStyle.Secondary),
      button("editmsg", "Éditer un message", "✏️", ButtonStyle.Secondary),
    ),
    new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId(`${PREFIX}sendto`)
        .setPlaceholder("📤 Envoyer dans un salon…")
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement),
    ),
    new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
      button("dm", "M'envoyer en MP", "💬", ButtonStyle.Success),
      button("close", "Fermer", "❌", ButtonStyle.Danger),
    ),
  ];

  return { embeds: [buildEmbed(draft, { preview: true })], components: rows };
}

function button(
  id: string,
  label: string,
  emoji: string,
  style: ButtonStyle = ButtonStyle.Primary,
): ButtonBuilder {
  return new ButtonBuilder()
    .setCustomId(`${PREFIX}${id}`)
    .setLabel(label)
    .setEmoji(emoji)
    .setStyle(style);
}

// ── Modals ───────────────────────────────────────────────────────────────────

function input(
  id: string,
  label: string,
  style: TextInputStyle,
  opts: { value?: string; required?: boolean; max?: number; placeholder?: string } = {},
): ActionRowBuilder<TextInputBuilder> {
  const t = new TextInputBuilder()
    .setCustomId(id)
    .setLabel(label)
    .setStyle(style)
    .setRequired(opts.required ?? false);
  if (opts.value) t.setValue(opts.value);
  if (opts.max) t.setMaxLength(opts.max);
  if (opts.placeholder) t.setPlaceholder(opts.placeholder);
  return new ActionRowBuilder<TextInputBuilder>().addComponents(t);
}

export function contentModal(d: EmbedDraft): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(`${PREFIX}modal:content`)
    .setTitle("Contenu de l'embed")
    .addComponents(
      input("title", "Titre", TextInputStyle.Short, { value: d.title, max: 256 }),
      input("description", "Description", TextInputStyle.Paragraph, {
        value: d.description,
        max: 4000,
      }),
      input("url", "Lien du titre (URL)", TextInputStyle.Short, {
        value: d.url,
        placeholder: "https://…",
      }),
    );
}

export function colorModal(d: EmbedDraft): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(`${PREFIX}modal:color`)
    .setTitle("Couleur de l'embed")
    .addComponents(
      input("color", "Couleur (hex)", TextInputStyle.Short, {
        value: typeof d.color === "number" ? `#${d.color.toString(16).padStart(6, "0")}` : undefined,
        placeholder: "#5865F2",
        max: 7,
      }),
    );
}

export function mediaModal(d: EmbedDraft): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(`${PREFIX}modal:media`)
    .setTitle("Images")
    .addComponents(
      input("image", "Grande image (URL)", TextInputStyle.Short, {
        value: d.image,
        placeholder: "https://…",
      }),
      input("thumbnail", "Miniature (URL)", TextInputStyle.Short, {
        value: d.thumbnail,
        placeholder: "https://…",
      }),
    );
}

export function authorModal(d: EmbedDraft): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(`${PREFIX}modal:author`)
    .setTitle("Auteur & Footer")
    .addComponents(
      input("author_name", "Nom de l'auteur", TextInputStyle.Short, {
        value: d.authorName,
        max: 256,
      }),
      input("author_icon", "Icône de l'auteur (URL)", TextInputStyle.Short, {
        value: d.authorIcon,
        placeholder: "https://…",
      }),
      input("footer_text", "Texte du footer", TextInputStyle.Short, {
        value: d.footerText,
        max: 2048,
      }),
      input("footer_icon", "Icône du footer (URL)", TextInputStyle.Short, {
        value: d.footerIcon,
        placeholder: "https://…",
      }),
      input("timestamp", "Horodatage ? (oui/non)", TextInputStyle.Short, {
        value: d.timestamp ? "oui" : "non",
        max: 5,
      }),
    );
}

export function fieldModal(): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(`${PREFIX}modal:field`)
    .setTitle("Ajouter un champ")
    .addComponents(
      input("name", "Nom du champ", TextInputStyle.Short, { required: true, max: 256 }),
      input("value", "Valeur du champ", TextInputStyle.Paragraph, {
        required: true,
        max: 1024,
      }),
      input("inline", "Sur la même ligne ? (oui/non)", TextInputStyle.Short, {
        value: "non",
        max: 5,
      }),
    );
}

export function linkModal(id: string, title: string): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(`${PREFIX}modal:${id}`)
    .setTitle(title)
    .addComponents(
      input("link", "Lien du message", TextInputStyle.Short, {
        required: true,
        placeholder: "https://discord.com/channels/…",
      }),
    );
}

/** Loose "yes" parser for the oui/non text inputs. */
export function yes(value: string): boolean {
  return /^(o|y|1|true|vrai)/i.test(value.trim());
}
