import { EmbedBuilder, type GuildMember } from "discord.js";
import { getGuildConfig } from "../../core/store.js";

/**
 * Welcome messages for new members. Reads the target channel + template from
 * the per-guild store; posts nothing if no welcome channel is configured.
 * Requires the privileged GuildMembers intent (see src/index.ts).
 */

const DEFAULT_MESSAGE =
  "Bienvenue {user} sur **{server}** ! 🎉\nTu es notre {count}ᵉ membre, installe-toi bien.";

/** Placeholders usable in a welcome template. */
export const WELCOME_PLACEHOLDERS = "{user}, {username}, {server}, {count}";

/** Fills a welcome template with the joining member's details. */
export function renderWelcome(template: string, member: GuildMember): string {
  return template
    .replaceAll("{user}", member.toString())
    .replaceAll("{username}", member.user.username)
    .replaceAll("{server}", member.guild.name)
    .replaceAll("{count}", String(member.guild.memberCount));
}

/** Posts the configured welcome message when a member joins. */
export async function handleMemberJoin(member: GuildMember): Promise<void> {
  const { welcome } = await getGuildConfig(member.guild.id);
  if (!welcome?.channelId) return;

  const channel = member.guild.channels.cache.get(welcome.channelId);
  if (!channel?.isTextBased()) return;

  const text = renderWelcome(welcome.message ?? DEFAULT_MESSAGE, member);
  const embed = new EmbedBuilder()
    .setColor(0x57f287)
    .setDescription(text)
    .setThumbnail(member.user.displayAvatarURL({ size: 128 }))
    .setTimestamp();

  await channel
    .send({ content: member.toString(), embeds: [embed] })
    .catch((error) => {
      console.error("[welcome] Failed to send welcome message:", error);
    });
}
