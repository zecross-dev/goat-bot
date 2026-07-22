import { EmbedBuilder, type Embed } from "discord.js";

/**
 * The embed editor's data model and pure helpers: the in-progress `EmbedDraft`,
 * conversions to/from a Discord embed, and the small parsers (`parseColor`,
 * `parseMessageRef`). No Discord interaction state lives here.
 */

export interface EmbedDraft {
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

export function isValidUrl(url: string | undefined): url is string {
  return !!url && /^https?:\/\//i.test(url.trim());
}

export function isDraftEmpty(d: EmbedDraft): boolean {
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
export function buildEmbed(d: EmbedDraft, { preview = false } = {}): EmbedBuilder {
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
export function embedToDraft(e: Embed): EmbedDraft {
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
