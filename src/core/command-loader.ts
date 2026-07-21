import { readdir } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, sep } from "node:path";
import type { Command } from "./command.js";

const featuresDir = join(dirname(fileURLToPath(import.meta.url)), "..", "features");

/**
 * Recursively collects every command module: any `.ts`/`.js` file that lives
 * inside a `commands/` directory somewhere under `src/features/`. This is what
 * lets each feature own its own commands (e.g. `features/moderation/commands/`)
 * while the loader still discovers them all automatically.
 */
async function collectCommandFiles(dir: string): Promise<string[]> {
  const found: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...(await collectCommandFiles(full)));
    } else if (
      /\.(ts|js)$/.test(entry.name) &&
      dir.split(sep).includes("commands")
    ) {
      found.push(full);
    }
  }

  return found;
}

/**
 * Loads every feature command into a `Map<name, Command>`. Each command file
 * default-exports a `Command` (see `core/command.ts`). Drop a new file into any
 * feature's `commands/` folder and it is picked up automatically — there is no
 * central registry to update.
 */
export async function loadCommands(): Promise<Map<string, Command>> {
  const commands = new Map<string, Command>();

  for (const file of await collectCommandFiles(featuresDir)) {
    const mod = await import(pathToFileURL(file).href);
    const command: Command | undefined = mod.default;

    if (!command?.data || !command?.execute) {
      console.warn(`[commands] Skipping ${file}: missing "data" or "execute".`);
      continue;
    }
    commands.set(command.data.name, command);
  }

  return commands;
}
