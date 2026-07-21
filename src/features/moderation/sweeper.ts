import { EmbedBuilder, type Client } from "discord.js";
import { deactivateCase, getDueTempActions } from "../../core/store.js";
import { postModLog } from "./moderation.js";

/**
 * Reverses temp moderation actions whose expiry has passed. Currently handles
 * tempban → automatic unban (Discord timeouts expire on their own, so `mute`
 * cases need no reversal here). Runs on startup and on a periodic interval so
 * expiries survive restarts.
 */
export async function sweepExpiredTempActions(client: Client): Promise<void> {
  const due = await getDueTempActions(Date.now());

  for (const { guildId, modCase } of due) {
    // Only tempban needs an active reversal; deactivate anything else that slipped through.
    if (modCase.type !== "tempban") {
      await deactivateCase(guildId, modCase.id);
      continue;
    }

    const guild = client.guilds.cache.get(guildId);
    if (!guild) continue;

    try {
      const ban = await guild.bans.fetch(modCase.userId).catch(() => null);
      if (ban) {
        await guild.bans.remove(modCase.userId, "Fin du bannissement temporaire");
        await postModLog(
          guild,
          new EmbedBuilder()
            .setColor(0x57f287)
            .setTitle(`♻️ Débannissement automatique · Case #${modCase.id}`)
            .setDescription(`<@${modCase.userId}> — fin du bannissement temporaire.`)
            .setTimestamp(),
        );
      }
      await deactivateCase(guildId, modCase.id);
    } catch (error) {
      console.error(`[moderation] Failed to lift tempban ${modCase.id}:`, error);
    }
  }
}
