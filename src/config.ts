import "dotenv/config";

/** Reads a required env var, throwing a clear error if it is missing. */
function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. Copy .env.example to .env and fill it in.`,
    );
  }
  return value;
}

export const config = {
  token: required("DISCORD_TOKEN"),
  clientId: required("CLIENT_ID"),
  /** Optional test-guild ID for instant command registration. */
  guildId: process.env.GUILD_ID || undefined,
};
