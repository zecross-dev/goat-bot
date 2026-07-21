import {
  EmbedBuilder,
  PermissionFlagsBits,
  type GuildTextBasedChannel,
  type Message,
} from "discord.js";
import { getAntiLinkConfig } from "../../core/store.js";
import { isTicketChannel } from "../tickets/panel.js";
import { postModLog } from "../moderation/moderation.js";

/**
 * Anti-link filter. Deletes links posted by members without permission, and
 * lets everyone share links inside open ticket channels (so clients can send
 * their project Discord, repo, etc.). Exemptions: ticket channels, members with
 * **Manage Messages**, configured allowed roles/channels, and whitelisted
 * domains.
 *
 * Requires the privileged **MessageContent** intent (in `src/index.ts` **and**
 * enabled in the Developer Portal) — without it, `message.content` is empty and
 * nothing can be detected.
 */

/**
 * Conservative URL detection tuned for a developer community: only real links
 * are matched — `http(s)://…`, `www.…`, and `domain.tld/path`. Bare tokens like
 * `discord.js` or `index.ts` (no path) are intentionally NOT flagged.
 */
const LINK_REGEX = /(?:https?:\/\/|www\.)\S+|[a-z0-9-]+\.[a-z]{2,}\/\S*/i;

/** Whether the text contains a real URL (exported for tests). */
export function containsLink(content: string): boolean {
  return LINK_REGEX.test(content);
}

/** Reads a channel's topic (following threads to their parent). */
function channelTopic(channel: GuildTextBasedChannel): string | null {
  if (channel.isThread()) {
    const parent = channel.parent;
    return parent && "topic" in parent ? parent.topic : null;
  }
  return "topic" in channel ? channel.topic : null;
}

/**
 * Enforces the anti-link policy on a message. Returns `true` if the message was
 * deleted (so the caller can skip further processing, e.g. XP). No-ops when the
 * filter is disabled, the author/channel/role is exempt, or there is no link.
 */
export async function handleMessage(message: Message): Promise<boolean> {
  if (message.author.bot || message.system) return false;
  if (!message.inGuild()) return false;

  const cfg = await getAntiLinkConfig(message.guildId);
  if (!cfg.enabled) return false;

  const channel = message.channel;

  // Exempt: ticket channels (links are the whole point there).
  if (isTicketChannel(channelTopic(channel))) return false;

  // Exempt: explicitly allowed channels (or a thread's parent).
  const parentId = channel.isThread() ? channel.parentId : null;
  if (
    cfg.allowedChannelIds?.some((id) => id === channel.id || id === parentId)
  ) {
    return false;
  }

  // Exempt: staff (Manage Messages) and configured allowed roles.
  const member = message.member;
  if (member) {
    if (member.permissions.has(PermissionFlagsBits.ManageMessages)) return false;
    if (cfg.allowedRoleIds?.some((r) => member.roles.cache.has(r))) return false;
  }

  if (!containsLink(message.content)) return false;

  // Whitelist: leave the message alone if it only contains allowed domains.
  const lower = message.content.toLowerCase();
  if (cfg.whitelist?.some((d) => lower.includes(d.toLowerCase()))) return false;

  // Violation → delete, warn (auto-removed), and log.
  await message.delete().catch((error) => {
    console.error("[antilink] Failed to delete message:", error);
  });

  if (channel.isSendable()) {
    const warning = await channel
      .send({
        content: `${message.author.toString()}, les liens ne sont pas autorisés ici. 🔗 Tu peux en partager dans un **ticket** ouvert.`,
      })
      .catch(() => null);
    if (warning) {
      setTimeout(() => void warning.delete().catch(() => {}), 6000);
    }
  }

  await postModLog(
    message.guild,
    new EmbedBuilder()
      .setColor(0xed4245)
      .setTitle("🔗 Lien supprimé (anti-link)")
      .addFields(
        { name: "Membre", value: `${message.author.toString()} (${message.author.tag})`, inline: true },
        { name: "Salon", value: `<#${channel.id}>`, inline: true },
        { name: "Message", value: message.content.slice(0, 1000) || "*vide*" },
      )
      .setTimestamp(),
  );

  return true;
}
