import {
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  time,
} from "discord.js";
import type { Command } from "../../../core/command.js";
import { getRaidConfig } from "../../../core/store.js";
import {
  RAID_DEFAULTS,
  getStatus,
  setManualLockdown,
} from "../raid.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("goat-raid")
    .setDescription("Pilote la protection anti-raid (verrouillage manuel, statut).")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addSubcommand((s) =>
      s
        .setName("lockdown")
        .setDescription("Active le verrouillage manuel (filtre tous les arrivants)."),
    )
    .addSubcommand((s) =>
      s.setName("unlock").setDescription("Lève le verrouillage manuel."),
    )
    .addSubcommand((s) =>
      s.setName("status").setDescription("Affiche l'état de la protection anti-raid."),
    ),

  async execute(interaction) {
    if (!interaction.inGuild() || !interaction.guild) return;
    const sub = interaction.options.getSubcommand();

    if (sub === "lockdown" || sub === "unlock") {
      const on = sub === "lockdown";
      await setManualLockdown(interaction.guild, on);
      await interaction.reply({
        content: on
          ? "🔒 Verrouillage manuel **activé** — les nouveaux arrivants seront filtrés selon l'action configurée."
          : "🔓 Verrouillage manuel **levé**.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // status
    const cfg = await getRaidConfig(interaction.guildId);
    const status = getStatus(interaction.guildId);

    const state = status.manual
      ? "🔒 Verrouillage manuel actif"
      : status.autoUntil
        ? `🚨 Raid en cours (jusqu'à ${time(Math.floor(status.autoUntil / 1000), "R")})`
        : "🟢 Aucun raid en cours";

    const embed = new EmbedBuilder()
      .setColor(status.active ? 0xed4245 : 0x57f287)
      .setTitle("🛡️ Protection anti-raid")
      .addFields(
        { name: "État", value: state },
        {
          name: "Configuration",
          value: [
            `Protection : ${cfg.enabled ? "activée ✅" : "désactivée ⛔"}`,
            `Seuil : ${cfg.joinThreshold ?? RAID_DEFAULTS.joinThreshold} arrivées / ${
              cfg.joinWindowSeconds ?? RAID_DEFAULTS.joinWindowSeconds
            }s`,
            `Action : ${cfg.action ?? RAID_DEFAULTS.action}`,
            `Âge min. du compte : ${
              cfg.minAccountAgeHours ? `${cfg.minAccountAgeHours}h` : "désactivé"
            }`,
            `Verrouillage : ${cfg.lockdownMinutes ?? RAID_DEFAULTS.lockdownMinutes} min`,
            `Salon d'alerte : ${cfg.alertChannelId ? `<#${cfg.alertChannelId}>` : "*non défini*"}`,
            `Rôle alerté : ${cfg.alertRoleId ? `<@&${cfg.alertRoleId}>` : "*non défini*"}`,
          ].join("\n"),
        },
      );

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};

export default command;
