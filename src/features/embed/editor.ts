import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type AnySelectMenuInteraction,
  type BaseMessageOptions,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type Client,
  type Embed,
  type MessageActionRowComponentBuilder,
  type ModalSubmitInteraction,
  type RepliableInteraction,
} from "discord.js";

/**
 * Interactive embed editor. `/embed` opens an ephemeral panel with a live
 * preview and buttons that edit each part of the embed via modals. The result
 * can be sent to a channel, DMed, or written over an existing bot message; an
 * existing embed can also be imported (by message link) to edit it.
 *
 * The in-progress draft is kept in memory keyed by user id (one editor per
 * user). All editor interactions use the `embed:` customId prefix.
 */

const PREFIX = "embed:";

interface EmbedDraft {
  title?: string;
  description?: string;
  url?: string;
  color?: number;
  authorName?: string;
  authorIcon?: string;
  footerText?: string;
  footerIcon?: string;
  image?: string;
  thumbnail?: string;
  timestamp?: boolean;
  fields: Array<{ name: string; value: string; inline: boolean }>;
}

const sessions = new Map<string, EmbedDraft>();

/** Whether an interaction customId belongs to the embed editor. */
export function isEmbedInteraction(customId: string): boolean {
  return customId.startsWith(PREFIX);
}

// ── Draft helpers ────────────────────────────────────────────────────────────

function isValidUrl(url: string | undefined): url is string {
  return !!url && /^https?:\/\//i.test(url.trim());
}

function isDraftEmpty(d: EmbedDraft): boolean {
  return (
    !d.title &&
    !d.description &&
    !d.authorName &&
    !d.footerText &&
    !isValidUrl(d.image) &&
    !isValidUrl(d.thumbnail) &&
    d.fields.length === 0
  );
}

/** Builds an EmbedBuilder from a draft (sanitizing URLs). */
function buildEmbed(d: EmbedDraft, { preview = false } = {}): EmbedBuilder {
  const e = new EmbedBuilder();
  if (d.title) e.setTitle(d.title.slice(0, 256));
  if (d.description) e.setDescription(d.description.slice(0, 4096));
  if (isValidUrl(d.url)) e.setURL(d.url);
  if (typeof d.color === "number") e.setColor(d.color);
  if (d.authorName) {
    e.setAuthor({
      name: d.authorName.slice(0, 256),
      ...(isValidUrl(d.authorIcon) ? { iconURL: d.authorIcon } : {}),
    });
  }
  if (d.footerText) {
    e.setFooter({
      text: d.footerText.slice(0, 2048),
      ...(isValidUrl(d.footerIcon) ? { iconURL: d.footerIcon } : {}),
    });
  }
  if (isValidUrl(d.image)) e.setImage(d.image);
  if (isValidUrl(d.thumbnail)) e.setThumbnail(d.thumbnail);
  if (d.timestamp) e.setTimestamp();
  if (d.fields.length) {
    e.addFields(
      d.fields.slice(0, 25).map((f) => ({
        name: f.name.slice(0, 256),
        value: f.value.slice(0, 1024),
        inline: f.inline,
      })),
    );
  }

  if (isDraftEmpty(d) && preview) {
    e.setColor(0x2b2d31).setDescription(
      "*(embed vide — utilise les boutons ci-dessous pour le construire)*",
    );
  }
  return e;
}

/** Converts a received message embed into an editable draft. */
function embedToDraft(e: Embed): EmbedDraft {
  return {
    title: e.title ?? undefined,
    description: e.description ?? undefined,
    url: e.url ?? undefined,
    color: e.color ?? undefined,
    authorName: e.author?.name,
    authorIcon: e.author?.iconURL ?? undefined,
    footerText: e.footer?.text,
    footerIcon: e.footer?.iconURL ?? undefined,
    image: e.image?.url,
    thumbnail: e.thumbnail?.url,
    timestamp: !!e.timestamp,
    fields: e.fields.map((f) => ({
      name: f.name,
      value: f.value,
      inline: f.inline ?? false,
    })),
  };
}

/** Parses `#RRGGBB` / `RRGGBB` into a color int, or null if invalid. */
export function parseColor(input: string): number | null {
  const hex = input.trim().replace(/^#/, "");
  if (!/^[0-9a-f]{6}$/i.test(hex)) return null;
  return parseInt(hex, 16);
}

/** Extracts channel + message ids from a message link or `chan-msg` pair. */
export function parseMessageRef(
  input: string,
): { channelId: string; messageId: string } | null {
  const ids = input.match(/\d{17,20}/g);
  if (!ids || ids.length < 2) return null;
  return { channelId: ids[ids.length - 2], messageId: ids[ids.length - 1] };
}

// ── Editor panel rendering ───────────────────────────────────────────────────

function editorMessage(draft: EmbedDraft): BaseMessageOptions {
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

function contentModal(d: EmbedDraft): ModalBuilder {
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

function colorModal(d: EmbedDraft): ModalBuilder {
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

function mediaModal(d: EmbedDraft): ModalBuilder {
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

function authorModal(d: EmbedDraft): ModalBuilder {
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

function fieldModal(): ModalBuilder {
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

function linkModal(id: string, title: string): ModalBuilder {
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

function yes(value: string): boolean {
  return /^(o|y|1|true|vrai)/i.test(value.trim());
}

// ── Entry point ──────────────────────────────────────────────────────────────

/** Opens a fresh editor for the user (optionally pre-filled with a draft). */
export async function openEditor(
  interaction: ChatInputCommandInteraction,
  initial?: EmbedDraft,
): Promise<void> {
  const draft: EmbedDraft = initial ?? { fields: [] };
  sessions.set(interaction.user.id, draft);
  await interaction.reply({
    ...editorMessage(draft),
    flags: MessageFlags.Ephemeral,
  });
}

/** Loads the first embed of a linked message into a draft (null on failure). */
export async function importEmbedFromLink(
  client: Client,
  link: string,
): Promise<EmbedDraft | null> {
  const ref = parseMessageRef(link);
  if (!ref) return null;
  try {
    const channel = await client.channels.fetch(ref.channelId);
    if (!channel?.isTextBased()) return null;
    const message = await channel.messages.fetch(ref.messageId);
    const embed = message.embeds[0];
    return embed ? embedToDraft(embed) : null;
  } catch {
    return null;
  }
}

// ── Interaction router ───────────────────────────────────────────────────────

/** Routes every embed-editor interaction (buttons, modals, select menus). */
export async function handleEmbedInteraction(
  interaction: ButtonInteraction | ModalSubmitInteraction | AnySelectMenuInteraction,
): Promise<void> {
  if (interaction.isButton()) return handleButton(interaction);
  if (interaction.isModalSubmit()) return handleModal(interaction);
  return handleSelect(interaction);
}

/** Fetches the caller's draft, replying with a hint if the editor expired. */
async function requireSession(
  interaction: RepliableInteraction,
): Promise<EmbedDraft | null> {
  const draft = sessions.get(interaction.user.id);
  if (!draft) {
    await interaction.reply({
      content: "⏱️ Éditeur expiré ou introuvable. Relance `/embed`.",
      flags: MessageFlags.Ephemeral,
    });
    return null;
  }
  return draft;
}

async function handleButton(interaction: ButtonInteraction): Promise<void> {
  const action = interaction.customId.slice(PREFIX.length);
  const draft = await requireSession(interaction);
  if (!draft) return;

  switch (action) {
    case "content":
      return interaction.showModal(contentModal(draft));
    case "color":
      return interaction.showModal(colorModal(draft));
    case "media":
      return interaction.showModal(mediaModal(draft));
    case "author":
      return interaction.showModal(authorModal(draft));
    case "field-add":
      return interaction.showModal(fieldModal());
    case "import":
      return interaction.showModal(linkModal("import", "Importer un embed"));
    case "editmsg":
      return interaction.showModal(linkModal("editmsg", "Éditer un message du bot"));
    case "field-clear":
      draft.fields = [];
      return void interaction.update(editorMessage(draft));
    case "dm":
      return sendEmbed(interaction, draft, "dm");
    case "close":
      sessions.delete(interaction.user.id);
      return void interaction.update({
        content: "Éditeur fermé.",
        embeds: [],
        components: [],
      });
  }
}

async function handleModal(interaction: ModalSubmitInteraction): Promise<void> {
  const action = interaction.customId.slice(`${PREFIX}modal:`.length);
  const draft = await requireSession(interaction);
  if (!draft) return;
  // All editor modals are opened from the panel's components, so the submit is
  // always attached to that message (giving us `.update()` to refresh it).
  if (!interaction.isFromMessage()) return;
  const get = (id: string) => interaction.fields.getTextInputValue(id).trim();

  if (action === "content") {
    draft.title = get("title") || undefined;
    draft.description = get("description") || undefined;
    draft.url = get("url") || undefined;
    return void interaction.update(editorMessage(draft));
  }

  if (action === "color") {
    const raw = get("color");
    if (!raw) {
      draft.color = undefined;
      return void interaction.update(editorMessage(draft));
    }
    const color = parseColor(raw);
    if (color === null) {
      return void interaction.reply({
        content: "Couleur invalide. Utilise un hex, ex `#5865F2`.",
        flags: MessageFlags.Ephemeral,
      });
    }
    draft.color = color;
    return void interaction.update(editorMessage(draft));
  }

  if (action === "media") {
    draft.image = get("image") || undefined;
    draft.thumbnail = get("thumbnail") || undefined;
    return void interaction.update(editorMessage(draft));
  }

  if (action === "author") {
    draft.authorName = get("author_name") || undefined;
    draft.authorIcon = get("author_icon") || undefined;
    draft.footerText = get("footer_text") || undefined;
    draft.footerIcon = get("footer_icon") || undefined;
    draft.timestamp = yes(get("timestamp"));
    return void interaction.update(editorMessage(draft));
  }

  if (action === "field") {
    if (draft.fields.length >= 25) {
      return void interaction.reply({
        content: "Un embed est limité à 25 champs.",
        flags: MessageFlags.Ephemeral,
      });
    }
    draft.fields.push({
      name: get("name"),
      value: get("value"),
      inline: yes(get("inline")),
    });
    return void interaction.update(editorMessage(draft));
  }

  if (action === "import") {
    await interaction.deferUpdate();
    const imported = await importEmbedFromLink(interaction.client, get("link"));
    if (!imported) {
      return void interaction.followUp({
        content: "Impossible d'importer : lien invalide ou message sans embed.",
        flags: MessageFlags.Ephemeral,
      });
    }
    sessions.set(interaction.user.id, imported);
    return void interaction.editReply(editorMessage(imported));
  }

  if (action === "editmsg") {
    await interaction.deferUpdate();
    await editExistingMessage(interaction, draft, get("link"));
  }
}

async function handleSelect(interaction: AnySelectMenuInteraction): Promise<void> {
  if (interaction.customId !== `${PREFIX}sendto`) return;
  const draft = await requireSession(interaction);
  if (!draft) return;
  await sendEmbed(interaction, draft, "channel", interaction.values[0]);
}

// ── Send / edit actions ──────────────────────────────────────────────────────

async function sendEmbed(
  interaction: ButtonInteraction | AnySelectMenuInteraction,
  draft: EmbedDraft,
  target: "channel" | "dm",
  channelId?: string,
): Promise<void> {
  if (isDraftEmpty(draft)) {
    await interaction.reply({
      content: "L'embed est vide — ajoute au moins un titre, une description ou un champ.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  const embed = buildEmbed(draft);

  try {
    if (target === "dm") {
      await interaction.user.send({ embeds: [embed] });
      await interaction.reply({
        content: "✅ Embed envoyé en message privé.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const channel = await interaction.client.channels.fetch(channelId!);
    if (!channel?.isTextBased() || !channel.isSendable()) {
      throw new Error("channel not sendable");
    }
    await channel.send({ embeds: [embed] });
    await interaction.reply({
      content: `✅ Embed envoyé dans <#${channelId}>.`,
      flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    console.error("[embed] send failed:", error);
    await interaction.reply({
      content:
        target === "dm"
          ? "❌ Impossible de t'envoyer un MP (messages privés fermés ?)."
          : "❌ Envoi impossible (permissions manquantes dans ce salon ?).",
      flags: MessageFlags.Ephemeral,
    });
  }
}

async function editExistingMessage(
  interaction: ModalSubmitInteraction,
  draft: EmbedDraft,
  link: string,
): Promise<void> {
  if (isDraftEmpty(draft)) {
    await interaction.followUp({
      content: "L'embed est vide — construis-le avant d'éditer un message.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  const ref = parseMessageRef(link);
  if (!ref) {
    await interaction.followUp({
      content: "Lien de message invalide.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  try {
    const channel = await interaction.client.channels.fetch(ref.channelId);
    if (!channel?.isTextBased()) throw new Error("not text");
    const message = await channel.messages.fetch(ref.messageId);
    if (message.author.id !== interaction.client.user.id) {
      await interaction.followUp({
        content: "Je ne peux éditer que **mes propres** messages.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    await message.edit({ embeds: [buildEmbed(draft)] });
    await interaction.followUp({
      content: `✅ Message mis à jour : ${message.url}`,
      flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    console.error("[embed] edit message failed:", error);
    await interaction.followUp({
      content: "❌ Édition impossible (message introuvable ou inaccessible).",
      flags: MessageFlags.Ephemeral,
    });
  }
}
