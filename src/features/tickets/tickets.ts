import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  type ButtonInteraction,
  type Guild,
  type GuildBasedChannel,
  type GuildTextBasedChannel,
  type ModalSubmitInteraction,
  type TextChannel,
  type User,
} from "discord.js";
import {
  clearTicketSession,
  getGuildConfig,
  type TicketConfig,
} from "../../core/store.js";
import {
  CLOSE_ID,
  CREATE_PREFIX,
  TICKET_TYPES,
  ownerTag,
  parseCreateType,
  parseOwnerId,
  requiresIntake,
  typeTag,
  type TicketType,
} from "./panel.js";
import { buildIntakeModal, buildIntakeRecap, parseIntakeType } from "./intake.js";
import { startTicketConversation, TICKET_QUESTIONS } from "./conversation.js";
import { buildTranscript } from "./transcript.js";

/**
 * Ticket actions: creating a private ticket channel and closing it (with an
 * HTML transcript posted to the log). "Passer commande" tickets first present
 * the project-intake modal (see `intake.ts`); "Support" tickets open directly.
 * Panel building/refresh lives in `panel.ts`. Per-type "one ticket per user" is
 * enforced by scanning channels for markers stored in the topic.
 */

/** Routes a ticket button press to the right handler. */
export async function handleTicketButton(
  interaction: ButtonInteraction,
): Promise<void> {
  if (interaction.customId === CLOSE_ID) {
    await closeTicket(interaction);
    return;
  }
  if (!interaction.customId.startsWith(CREATE_PREFIX)) return;

  const { guild, user } = interaction;
  if (!guild) return;

  const type = parseCreateType(interaction.customId);

  // Reject a duplicate before bothering the user with a form / new channel.
  const existing = findExistingTicket(guild, user.id, type);
  if (existing) {
    await interaction.reply({
      content:
        `Tu as déjà un ticket **${TICKET_TYPES[type].label}** ouvert : ${existing.toString()}. ` +
        "Ferme-le avant d'en ouvrir un nouveau.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Project tickets collect info via a modal first; others open directly.
  if (requiresIntake(type)) {
    await interaction.showModal(buildIntakeModal(type));
    return;
  }
  await createTicket(interaction, type);
}

/** Handles the intake modal submission: opens the ticket with a recap. */
export async function handleTicketModal(
  interaction: ModalSubmitInteraction,
): Promise<void> {
  const { guild, user } = interaction;
  if (!guild) return;

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const type = parseIntakeType(interaction.customId);
  const typeConfig = TICKET_TYPES[type];
  const cfg: TicketConfig = (await getGuildConfig(guild.id)).tickets ?? {};

  // Re-check in case a ticket was opened between the click and the submit.
  const existing = findExistingTicket(guild, user.id, type);
  if (existing) {
    await interaction.editReply(
      `Tu as déjà un ticket **${typeConfig.label}** ouvert : ${existing.toString()}.`,
    );
    return;
  }

  const channel = await openTicketChannel(guild, user, type, cfg);
  const recap = buildIntakeRecap(interaction, type);

  // Procedure message: pings ONLY the member (staff is pinged at the very end,
  // once every question has been answered).
  const welcome = new EmbedBuilder()
    .setColor(typeConfig.color)
    .setTitle(typeConfig.title)
    .setDescription(
      `Bonjour ${user.toString()}, merci pour ces premières infos ! 🙌\n\n` +
        `Pour bien cerner ton projet, je vais te poser **${TICKET_QUESTIONS.length} petites questions** — ` +
        "réponds simplement ici, **une par une** : je passe à la suivante après " +
        "chaque réponse.\n\n" +
        "Le staff prendra le relais une fois tes réponses complètes. Tu peux " +
        "fermer le ticket à tout moment avec le bouton ci-dessous.",
    );

  await channel.send({
    content: user.toString(),
    embeds: [welcome, recap],
    components: [closeRow()],
    allowedMentions: { users: [user.id] },
  });

  // Kick off the guided, one-question-at-a-time conversation.
  await startTicketConversation(channel, user.id, guild.id);

  await postLog(guild, cfg.logChannelId, [openLog(user, type, channel), recap]);

  await interaction.editReply(`Ton ticket a été créé : ${channel.toString()}`);
}

/** Finds an open ticket of the given type owned by the user, if any. */
function findExistingTicket(
  guild: Guild,
  userId: string,
  type: TicketType,
): GuildBasedChannel | undefined {
  return guild.channels.cache.find(
    (c) =>
      c.type === ChannelType.GuildText &&
      c.topic?.includes(ownerTag(userId)) &&
      c.topic?.includes(typeTag(type)),
  );
}

/** The "Fermer le ticket" button row. */
function closeRow(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(CLOSE_ID)
      .setLabel("Fermer le ticket")
      .setEmoji("🔒")
      .setStyle(ButtonStyle.Danger),
  );
}

/** The "🟢 Ticket ouvert" log embed. */
function openLog(user: User, type: TicketType, channel: TextChannel): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle("🟢 Ticket ouvert")
    .addFields(
      { name: "Type", value: TICKET_TYPES[type].label, inline: true },
      { name: "Membre", value: `${user.toString()} (${user.tag})`, inline: true },
      { name: "Salon", value: channel.toString(), inline: true },
    )
    .setTimestamp();
}

/** Creates the private ticket channel (perms for owner, staff, bot). */
async function openTicketChannel(
  guild: Guild,
  user: User,
  type: TicketType,
  cfg: TicketConfig,
): Promise<TextChannel> {
  const me = guild.members.me;
  const slug =
    user.username.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20) || user.id;

  const topic = [
    `Ticket ${TICKET_TYPES[type].label} de ${user.tag}`,
    ownerTag(user.id),
    typeTag(type),
  ].join(" — ");

  return guild.channels.create({
    name: `${type}-${slug}`,
    type: ChannelType.GuildText,
    parent: cfg.categoryId,
    topic,
    permissionOverwrites: [
      { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      {
        id: user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.EmbedLinks,
        ],
      },
      ...(cfg.staffRoleId
        ? [
            {
              id: cfg.staffRoleId,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.AttachFiles,
                PermissionFlagsBits.EmbedLinks,
              ],
            },
          ]
        : []),
      ...(me
        ? [
            {
              id: me.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ManageChannels,
                PermissionFlagsBits.ReadMessageHistory,
              ],
            },
          ]
        : []),
    ],
  });
}

/** Posts embeds (and optional files) to the configured log channel, if any. */
async function postLog(
  guild: Guild,
  logChannelId: string | undefined,
  embeds: EmbedBuilder[],
  files: AttachmentBuilder[] = [],
): Promise<void> {
  if (!logChannelId) return;
  const channel = guild.channels.cache.get(logChannelId);
  if (channel?.isTextBased()) {
    await channel.send({ embeds, files }).catch((error) => {
      console.error("[tickets] Failed to post log:", error);
    });
  }
}

/** Creates a ticket channel directly (no intake), for the clicking user. */
async function createTicket(
  interaction: ButtonInteraction,
  type: TicketType,
): Promise<void> {
  const { guild, user } = interaction;
  if (!guild) return;

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const typeConfig = TICKET_TYPES[type];
  const cfg: TicketConfig = (await getGuildConfig(guild.id)).tickets ?? {};
  const channel = await openTicketChannel(guild, user, type, cfg);

  const welcome = new EmbedBuilder()
    .setColor(typeConfig.color)
    .setTitle(typeConfig.title)
    .setDescription(
      `Bonjour ${user.toString()}, ${typeConfig.intro}\n\n` +
        "Clique sur **Fermer le ticket** quand c'est résolu.",
    );

  const mention = cfg.staffRoleId
    ? `${user.toString()} <@&${cfg.staffRoleId}>`
    : user.toString();
  await channel.send({
    content: mention,
    embeds: [welcome],
    components: [closeRow()],
  });

  await postLog(guild, cfg.logChannelId, [openLog(user, type, channel)]);

  await interaction.editReply(`Ton ticket a été créé : ${channel.toString()}`);
}

/** Closes (deletes) the ticket channel the close button lives in. */
async function closeTicket(interaction: ButtonInteraction): Promise<void> {
  const channel = interaction.channel as GuildTextBasedChannel | null;
  const guild = interaction.guild;
  if (!guild || !channel || channel.type !== ChannelType.GuildText) return;

  const ownerId = parseOwnerId(channel.topic);
  const logChannelId = (await getGuildConfig(guild.id)).tickets?.logChannelId;

  // Drop any in-progress intake conversation for this channel.
  await clearTicketSession(guild.id, channel.id);

  await interaction.reply({
    content: `🔒 Ticket fermé par ${interaction.user.toString()}. Génération du transcript et suppression dans 5 secondes…`,
  });

  const transcript = await buildTranscript(channel).catch((error) => {
    console.error("[tickets] Failed to build transcript:", error);
    return null;
  });

  await postLog(
    guild,
    logChannelId,
    [
      new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle("🔴 Ticket fermé")
        .setDescription(
          transcript
            ? "📄 Transcript HTML joint ci-dessous — télécharge-le et ouvre-le dans ton navigateur."
            : "Aucun message à archiver.",
        )
        .addFields(
          { name: "Salon", value: `#${channel.name}`, inline: true },
          {
            name: "Ouvert par",
            value: ownerId ? `<@${ownerId}>` : "inconnu",
            inline: true,
          },
          { name: "Fermé par", value: interaction.user.toString(), inline: true },
        )
        .setTimestamp(),
    ],
    transcript ? [transcript] : [],
  );

  setTimeout(() => {
    channel.delete().catch((error) => {
      console.error("[tickets] Failed to delete ticket channel:", error);
    });
  }, 5000);
}
