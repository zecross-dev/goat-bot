import {
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import type { Command } from "../../../core/command.js";
import {
  addGrant,
  assignGroup,
  createGroup,
  deleteGroup,
  getPermissions,
  removeGrant,
  setBypass,
  type PermTarget,
} from "../permissions.js";

/** Reads role/member options; returns null (after replying) if neither given. */
async function readTarget(
  interaction: import("discord.js").ChatInputCommandInteraction,
): Promise<PermTarget | null> {
  const role = interaction.options.getRole("role");
  const member = interaction.options.getUser("member");
  if (!role && !member) {
    await interaction.reply({
      content: "Indique au moins un rôle ou un membre.",
      flags: MessageFlags.Ephemeral,
    });
    return null;
  }
  return { roleId: role?.id, userId: member?.id };
}

function targetLabel(target: PermTarget): string {
  return [
    target.roleId ? `<@&${target.roleId}>` : null,
    target.userId ? `<@${target.userId}>` : null,
  ]
    .filter(Boolean)
    .join(" et ");
}

const roleOption = (o: import("discord.js").SlashCommandRoleOption) =>
  o.setName("role").setDescription("Rôle ciblé.");
const memberOption = (o: import("discord.js").SlashCommandUserOption) =>
  o.setName("member").setDescription("Membre ciblé.");

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("goat-perms")
    .setDescription("Gère les permissions internes du bot (commandes, bypass, groupes).")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addSubcommand((s) =>
      s
        .setName("allow")
        .setDescription("Autorise un rôle/membre à utiliser une commande.")
        .addStringOption((o) =>
          o.setName("command").setDescription("Nom exact de la commande.").setRequired(true),
        )
        .addRoleOption(roleOption)
        .addUserOption(memberOption),
    )
    .addSubcommand((s) =>
      s
        .setName("disallow")
        .setDescription("Retire l'autorisation d'un rôle/membre sur une commande.")
        .addStringOption((o) =>
          o.setName("command").setDescription("Nom exact de la commande.").setRequired(true),
        )
        .addRoleOption(roleOption)
        .addUserOption(memberOption),
    )
    .addSubcommand((s) =>
      s
        .setName("bypass")
        .setDescription("Ajoute/retire un rôle/membre du bypass total.")
        .addBooleanOption((o) =>
          o.setName("remove").setDescription("Cocher pour retirer au lieu d'ajouter."),
        )
        .addRoleOption(roleOption)
        .addUserOption(memberOption),
    )
    .addSubcommandGroup((g) =>
      g
        .setName("group")
        .setDescription("Gère les groupes de permissions.")
        .addSubcommand((s) =>
          s
            .setName("create")
            .setDescription("Crée/remplace un groupe avec une liste de commandes.")
            .addStringOption((o) =>
              o.setName("name").setDescription("Nom du groupe.").setRequired(true),
            )
            .addStringOption((o) =>
              o
                .setName("commands")
                .setDescription("Commandes séparées par des virgules (ex: warn, mute, ban).")
                .setRequired(true),
            ),
        )
        .addSubcommand((s) =>
          s
            .setName("delete")
            .setDescription("Supprime un groupe.")
            .addStringOption((o) =>
              o.setName("name").setDescription("Nom du groupe.").setRequired(true),
            ),
        )
        .addSubcommand((s) =>
          s
            .setName("assign")
            .setDescription("Assigne un groupe à un rôle/membre.")
            .addStringOption((o) =>
              o.setName("name").setDescription("Nom du groupe.").setRequired(true),
            )
            .addRoleOption(roleOption)
            .addUserOption(memberOption),
        )
        .addSubcommand((s) =>
          s
            .setName("unassign")
            .setDescription("Retire un groupe d'un rôle/membre.")
            .addStringOption((o) =>
              o.setName("name").setDescription("Nom du groupe.").setRequired(true),
            )
            .addRoleOption(roleOption)
            .addUserOption(memberOption),
        ),
    )
    .addSubcommand((s) =>
      s.setName("display").setDescription("Affiche les permissions configurées."),
    ),

  async execute(interaction) {
    if (!interaction.inGuild()) return;
    const group = interaction.options.getSubcommandGroup(false);
    const sub = interaction.options.getSubcommand();

    if (group === "group") {
      await handleGroup(interaction, sub);
      return;
    }

    if (sub === "allow" || sub === "disallow") {
      const commandName = interaction.options.getString("command", true).toLowerCase().trim();
      const target = await readTarget(interaction);
      if (!target) return;

      if (sub === "allow") await addGrant(interaction.guildId, commandName, target);
      else await removeGrant(interaction.guildId, commandName, target);

      await interaction.reply({
        content:
          sub === "allow"
            ? `✅ ${targetLabel(target)} peut désormais utiliser \`${commandName}\`.`
            : `✅ Autorisation retirée pour ${targetLabel(target)} sur \`${commandName}\`.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (sub === "bypass") {
      const remove = interaction.options.getBoolean("remove") ?? false;
      const target = await readTarget(interaction);
      if (!target) return;
      await setBypass(interaction.guildId, target, !remove);
      await interaction.reply({
        content: `✅ ${targetLabel(target)} ${remove ? "retiré du" : "ajouté au"} bypass total.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (sub === "display") {
      await showPermissions(interaction);
    }
  },
};

async function handleGroup(
  interaction: import("discord.js").ChatInputCommandInteraction,
  sub: string,
): Promise<void> {
  if (!interaction.inGuild()) return;
  const name = interaction.options.getString("name", true).toLowerCase().trim();

  if (sub === "create") {
    const commands = interaction.options
      .getString("commands", true)
      .split(/[,\s]+/)
      .map((c) => c.toLowerCase().trim())
      .filter(Boolean);
    await createGroup(interaction.guildId, name, commands);
    await interaction.reply({
      content: `✅ Groupe \`${name}\` défini avec : ${commands.map((c) => `\`${c}\``).join(", ")}.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (sub === "delete") {
    const ok = await deleteGroup(interaction.guildId, name);
    await interaction.reply({
      content: ok ? `🗑️ Groupe \`${name}\` supprimé.` : `Groupe \`${name}\` introuvable.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // assign / unassign
  const target = await readTarget(interaction);
  if (!target) return;
  const ok = await assignGroup(interaction.guildId, name, target, sub === "assign");
  if (!ok) {
    await interaction.reply({
      content: `Groupe \`${name}\` introuvable.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  await interaction.reply({
    content:
      sub === "assign"
        ? `✅ Groupe \`${name}\` assigné à ${targetLabel(target)}.`
        : `✅ Groupe \`${name}\` retiré de ${targetLabel(target)}.`,
    flags: MessageFlags.Ephemeral,
  });
}

async function showPermissions(
  interaction: import("discord.js").ChatInputCommandInteraction,
): Promise<void> {
  if (!interaction.inGuild()) return;
  const p = await getPermissions(interaction.guildId);

  const bypass =
    [
      ...p.bypassRoleIds.map((r) => `<@&${r}>`),
      ...p.bypassUserIds.map((u) => `<@${u}>`),
    ].join(", ") || "*aucun*";

  const grants =
    Object.entries(p.grants)
      .map(([cmd, g]) => {
        const who = [
          ...g.roleIds.map((r) => `<@&${r}>`),
          ...g.userIds.map((u) => `<@${u}>`),
        ].join(", ");
        return `\`${cmd}\` → ${who || "*personne*"}`;
      })
      .join("\n") || "*aucune*";

  const groups =
    Object.entries(p.groups)
      .map(([name, g]) => {
        const who = [
          ...g.roleIds.map((r) => `<@&${r}>`),
          ...g.userIds.map((u) => `<@${u}>`),
        ].join(", ");
        return `**${name}** — cmd: ${g.commands.map((c) => `\`${c}\``).join(", ") || "*aucune*"}\n└ ${who || "*non assigné*"}`;
      })
      .join("\n") || "*aucun*";

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("🔐 Permissions internes")
    .addFields(
      { name: "🟢 Bypass total", value: bypass },
      { name: "🎯 Autorisations par commande", value: grants.slice(0, 1024) },
      { name: "👥 Groupes", value: groups.slice(0, 1024) },
    )
    .setFooter({
      text: "Owner et Administrateurs contournent toujours ces règles.",
    });

  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

export default command;
