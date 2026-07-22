import {
  MessageFlags,
  type AnySelectMenuInteraction,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type ModalSubmitInteraction,
} from "discord.js";
import { parseColor, type EmbedDraft } from "./editor/draft.js";
import {
  PREFIX,
  clearSession,
  isEmbedInteraction,
  requireSession,
  setSession,
} from "./editor/session.js";
import {
  authorModal,
  colorModal,
  contentModal,
  editorMessage,
  fieldModal,
  linkModal,
  mediaModal,
  yes,
} from "./editor/ui.js";
import {
  editExistingMessage,
  importEmbedFromLink,
  sendEmbed,
} from "./editor/actions.js";

/**
 * Interactive embed editor entry point + interaction router. `/embed` opens an
 * ephemeral panel (see `editor/ui.ts`) whose buttons edit each part of the
 * draft (`editor/draft.ts`) via modals; the result is sent, DMed, or written
 * over an existing bot message (`editor/actions.ts`). Session state lives in
 * `editor/session.ts`. All editor interactions use the `embed:` customId prefix.
 */

// Re-exports so the rest of the app keeps importing from `./editor.js`.
export { isEmbedInteraction, importEmbedFromLink, parseColor };
export { parseMessageRef } from "./editor/draft.js";

/** Opens a fresh editor for the user (optionally pre-filled with a draft). */
export async function openEditor(
  interaction: ChatInputCommandInteraction,
  initial?: EmbedDraft,
): Promise<void> {
  const draft: EmbedDraft = initial ?? { fields: [] };
  setSession(interaction.user.id, draft);
  await interaction.reply({
    ...editorMessage(draft),
    flags: MessageFlags.Ephemeral,
  });
}

/** Routes every embed-editor interaction (buttons, modals, select menus). */
export async function handleEmbedInteraction(
  interaction: ButtonInteraction | ModalSubmitInteraction | AnySelectMenuInteraction,
): Promise<void> {
  if (interaction.isButton()) return handleButton(interaction);
  if (interaction.isModalSubmit()) return handleModal(interaction);
  return handleSelect(interaction);
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
      clearSession(interaction.user.id);
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
    setSession(interaction.user.id, imported);
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
