import type { ChatInputCommandInteraction } from "discord.js";
import { updateGuildConfig, type RaidAction } from "../../../core/store.js";
import { ensureOption, replyChanges } from "./shared.js";

/** Handles `/goat-config raid`: saves the anti-raid settings. */
export async function configureRaid(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!interaction.inGuild()) return;

  const enabled = interaction.options.getBoolean("enabled");
  const threshold = interaction.options.getInteger("join_threshold");
  const window = interaction.options.getInteger("join_window");
  const action = interaction.options.getString("action") as RaidAction | null;
  const minAge = interaction.options.getInteger("min_account_age");
  const lockdown = interaction.options.getInteger("lockdown_minutes");
  const alertChannel = interaction.options.getChannel("alert_channel");
  const alertRole = interaction.options.getRole("alert_role");

  const hasAny =
    enabled !== null ||
    threshold !== null ||
    window !== null ||
    action !== null ||
    minAge !== null ||
    lockdown !== null ||
    !!alertChannel ||
    !!alertRole;
  if (!(await ensureOption(interaction, hasAny))) return;

  await updateGuildConfig(interaction.guildId, {
    raid: {
      ...(enabled !== null ? { enabled } : {}),
      ...(threshold !== null ? { joinThreshold: threshold } : {}),
      ...(window !== null ? { joinWindowSeconds: window } : {}),
      ...(action !== null ? { action } : {}),
      ...(minAge !== null ? { minAccountAgeHours: minAge } : {}),
      ...(lockdown !== null ? { lockdownMinutes: lockdown } : {}),
      ...(alertChannel ? { alertChannelId: alertChannel.id } : {}),
      ...(alertRole ? { alertRoleId: alertRole.id } : {}),
    },
  });

  const changes: string[] = [];
  if (enabled !== null) changes.push(`Protection ${enabled ? "activée ✅" : "désactivée ⛔"}`);
  if (threshold !== null) changes.push(`Seuil → ${threshold} arrivées`);
  if (window !== null) changes.push(`Fenêtre → ${window}s`);
  if (action !== null) changes.push(`Action → ${action}`);
  if (minAge !== null)
    changes.push(`Âge min. du compte → ${minAge === 0 ? "désactivé" : `${minAge}h`}`);
  if (lockdown !== null) changes.push(`Durée de verrouillage → ${lockdown} min`);
  if (alertChannel) changes.push(`Salon d'alerte → ${alertChannel.toString()}`);
  if (alertRole) changes.push(`Rôle alerté → ${alertRole.toString()}`);

  await replyChanges(interaction, "Anti-raid mis à jour", changes);
}
