import { AttachmentBuilder, type GuildTextBasedChannel } from "discord.js";

/**
 * Ticket transcript rendering: fetches a channel's full message history and
 * turns it into a self-contained, Discord-styled HTML file attached to the
 * close log. Kept separate from ticket actions so the (sizable) HTML/escaping
 * logic stays out of the way.
 */

/** Escapes text so it is safe to embed inside HTML. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Fetches the full message history of a ticket channel and renders it as a
 * self-contained, Discord-styled HTML transcript. Returns null if empty.
 */
export async function buildTranscript(
  channel: GuildTextBasedChannel,
): Promise<AttachmentBuilder | null> {
  const messages = [];
  let before: string | undefined;

  // Discord returns messages newest-first, 100 at a time; paginate backwards.
  while (messages.length < 5000) {
    const batch = await channel.messages.fetch({ limit: 100, before });
    if (batch.size === 0) break;
    messages.push(...batch.values());
    before = batch.last()?.id;
    if (batch.size < 100) break;
  }

  if (messages.length === 0) return null;
  messages.reverse(); // oldest first

  const rows = messages
    .map((msg) => {
      const avatar = msg.author.displayAvatarURL({ extension: "png", size: 64 });
      const color = msg.member?.displayHexColor ?? "#ffffff";
      const time = escapeHtml(msg.createdAt.toLocaleString("fr-FR"));
      const name = escapeHtml(msg.member?.displayName ?? msg.author.username);
      const botTag = msg.author.bot ? '<span class="bot">BOT</span>' : "";

      const content = msg.content
        ? `<div class="content">${escapeHtml(msg.content).replace(/\n/g, "<br>")}</div>`
        : "";

      const embeds = msg.embeds
        .map((embed) => {
          const bar = embed.hexColor ?? "#5865f2";
          const title = embed.title ? `<div class="embed-title">${escapeHtml(embed.title)}</div>` : "";
          const desc = embed.description
            ? `<div class="embed-desc">${escapeHtml(embed.description).replace(/\n/g, "<br>")}</div>`
            : "";
          return `<div class="embed" style="border-color:${bar}">${title}${desc}</div>`;
        })
        .join("");

      const attachments = [...msg.attachments.values()]
        .map((att) => {
          const isImage = att.contentType?.startsWith("image/");
          if (isImage) {
            return `<div class="attachment"><img src="${att.url}" alt="${escapeHtml(att.name)}"></div>`;
          }
          return `<div class="attachment"><a href="${att.url}" target="_blank">📎 ${escapeHtml(att.name)}</a></div>`;
        })
        .join("");

      return `
      <div class="msg">
        <img class="avatar" src="${avatar}" alt="">
        <div class="body">
          <div class="head"><span class="name" style="color:${color}">${name}</span>${botTag}<span class="time">${time}</span></div>
          ${content}${embeds}${attachments}
        </div>
      </div>`;
    })
    .join("\n");

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Transcript — ${escapeHtml(channel.name)}</title>
<style>
  body { margin:0; background:#313338; color:#dbdee1; font-family:"gg sans","Segoe UI",Helvetica,Arial,sans-serif; font-size:15px; }
  .header { background:#2b2d31; padding:20px 30px; border-bottom:1px solid #1f2023; }
  .header h1 { margin:0 0 6px; font-size:20px; color:#fff; }
  .header .meta { color:#949ba4; font-size:13px; }
  .log { padding:16px 30px 40px; }
  .msg { display:flex; gap:16px; padding:8px 0; }
  .avatar { width:40px; height:40px; border-radius:50%; flex-shrink:0; }
  .body { min-width:0; }
  .head { display:flex; align-items:baseline; gap:8px; }
  .name { font-weight:600; }
  .bot { background:#5865f2; color:#fff; font-size:10px; font-weight:600; padding:1px 5px; border-radius:4px; text-transform:uppercase; }
  .time { color:#949ba4; font-size:12px; }
  .content { margin-top:2px; white-space:pre-wrap; word-wrap:break-word; line-height:1.4; }
  .embed { margin-top:6px; padding:8px 12px; background:#2b2d31; border-left:4px solid #5865f2; border-radius:4px; max-width:520px; }
  .embed-title { font-weight:600; color:#fff; margin-bottom:4px; }
  .embed-desc { color:#dbdee1; }
  .attachment { margin-top:6px; }
  .attachment img { max-width:400px; max-height:300px; border-radius:8px; }
  .attachment a { color:#00a8fc; text-decoration:none; }
</style>
</head>
<body>
  <div class="header">
    <h1>#${escapeHtml(channel.name)}</h1>
    <div class="meta">Généré le ${escapeHtml(new Date().toLocaleString("fr-FR"))} · ${messages.length} message(s)</div>
  </div>
  <div class="log">
${rows}
  </div>
</body>
</html>`;

  const buffer = Buffer.from(html, "utf-8");
  return new AttachmentBuilder(buffer, {
    name: `transcript-${channel.name}.html`,
  });
}
