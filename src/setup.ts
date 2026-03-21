import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { isDiscordSnowflake, resolvePath } from "./config.js";

interface EnvValues {
  DISCORD_BOT_TOKEN: string;
  ALLOWED_SERVER_ID: string;
  ALLOWED_USER_ID: string;
  PROJECT_ROOT: string;
  SESSION_TIMEOUT_MS: string;
  SESSION_WARN_MS: string;
}

function maskToken(token: string): string {
  if (token.length <= 10) return "***";
  return token.slice(0, 5) + "..." + token.slice(-5);
}

function parseEnvFile(filePath: string): Partial<EnvValues> {
  const values: Record<string, string> = {};
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      const value = trimmed.slice(eqIndex + 1).trim();
      values[key] = value;
    }
  } catch {
    // File doesn't exist or can't be read
  }
  return values as Partial<EnvValues>;
}

function writeEnvFile(filePath: string, values: EnvValues): void {
  const lines = [
    `DISCORD_BOT_TOKEN=${values.DISCORD_BOT_TOKEN}`,
    `ALLOWED_SERVER_ID=${values.ALLOWED_SERVER_ID}`,
    `ALLOWED_USER_ID=${values.ALLOWED_USER_ID}`,
    `PROJECT_ROOT=${values.PROJECT_ROOT}`,
    `SESSION_TIMEOUT_MS=${values.SESSION_TIMEOUT_MS}`,
    `SESSION_WARN_MS=${values.SESSION_WARN_MS}`,
  ];
  fs.writeFileSync(filePath, lines.join("\n") + "\n");
}

async function askWithValidation(
  rl: readline.Interface,
  prompt: string,
  validate: (value: string) => string | null,
  defaultValue?: string,
): Promise<string> {
  const suffix = defaultValue ? ` (${defaultValue})` : "";
  while (true) {
    const answer = (await rl.question(`${prompt}${suffix}: `)).trim();
    const value = answer || defaultValue || "";
    if (!value) {
      console.log("  This field is required.\n");
      continue;
    }
    const error = validate(value);
    if (error) {
      console.log(`  ${error}\n`);
      continue;
    }
    return value;
  }
}

async function main() {
  const envPath = path.resolve(process.cwd(), ".env");

  console.log();
  console.log("=".repeat(50));
  console.log("  ClaudeConduit Setup");
  console.log("=".repeat(50));
  console.log();

  const rl = readline.createInterface({ input: stdin, output: stdout });

  try {
    // Check for existing .env
    const existing = parseEnvFile(envPath);
    const hasExisting = existing.DISCORD_BOT_TOKEN && existing.DISCORD_BOT_TOKEN.length > 0;

    if (hasExisting) {
      console.log("Existing configuration found:");
      console.log(`  Token:     ${maskToken(existing.DISCORD_BOT_TOKEN!)}`);
      console.log(`  Server ID: ${existing.ALLOWED_SERVER_ID || "(not set)"}`);
      console.log(`  User ID:   ${existing.ALLOWED_USER_ID || "(not set)"}`);
      console.log(`  Root:      ${existing.PROJECT_ROOT || "(not set)"}`);
      console.log();
      const answer = await rl.question("Reconfigure? [y/N]: ");
      if (answer.trim().toLowerCase() !== "y") {
        console.log("\nKeeping existing configuration.");
        return;
      }
      console.log();
    }

    // Discord bot setup guidance
    console.log("Before starting, make sure you have:");
    console.log("  1. Created a Discord application at https://discord.com/developers/applications");
    console.log("  2. Enabled Message Content Intent (Bot tab)");
    console.log("  3. Added the bot to your server with these OAuth2 scopes:");
    console.log("     bot, applications.commands");
    console.log("  4. Enabled Developer Mode in Discord (Settings > Advanced)");
    console.log();

    // Step 1: Bot Token
    console.log("Step 1/6: Discord Bot Token");
    console.log("  Find it at: Developer Portal > Your App > Bot > Token");
    const token = await askWithValidation(
      rl,
      "  Bot token",
      (v) => {
        if (v.includes(" ")) return "Token should not contain spaces.";
        if (v.length < 50) return "Token looks too short (expected ~70 characters). Make sure you copied the full token.";
        return null;
      },
    );
    console.log();

    // Step 2: Server ID
    console.log("Step 2/6: Discord Server ID");
    console.log("  Right-click your server name > Copy Server ID");
    const serverId = await askWithValidation(
      rl,
      "  Server ID",
      (v) => isDiscordSnowflake(v) ? null : "Must be a 17-20 digit number. Make sure Developer Mode is enabled.",
    );
    console.log();

    // Step 3: User ID
    console.log("Step 3/6: Discord User ID");
    console.log("  Right-click your username > Copy User ID");
    const userId = await askWithValidation(
      rl,
      "  User ID",
      (v) => isDiscordSnowflake(v) ? null : "Must be a 17-20 digit number. Make sure Developer Mode is enabled.",
    );
    console.log();

    // Step 4: Project Root
    console.log("Step 4/6: Projects Directory");
    console.log("  The root directory where your projects live.");
    console.log("  Channel names will auto-resolve to subdirectories here.");
    const defaultRoot = existing.PROJECT_ROOT || "~/projects";
    const projectRoot = await askWithValidation(
      rl,
      "  Projects directory",
      (v) => {
        const resolved = resolvePath(v);
        if (fs.existsSync(resolved)) {
          if (!fs.statSync(resolved).isDirectory()) return `'${resolved}' is not a directory.`;
          return null;
        }
        // Will offer to create below
        return null;
      },
      defaultRoot,
    );

    // Offer to create if it doesn't exist
    const resolvedRoot = resolvePath(projectRoot);
    if (!fs.existsSync(resolvedRoot)) {
      const create = await rl.question(`  '${resolvedRoot}' doesn't exist. Create it? [Y/n]: `);
      if (create.trim().toLowerCase() !== "n") {
        fs.mkdirSync(resolvedRoot, { recursive: true });
        console.log(`  Created ${resolvedRoot}`);
      }
    }
    console.log();

    // Step 5: Session Timeout
    console.log("Step 5/6: Session Timeout");
    console.log("  How long before an idle session hibernates.");
    const timeout = await askWithValidation(
      rl,
      "  Timeout in ms",
      (v) => {
        const n = parseInt(v, 10);
        if (Number.isNaN(n) || n <= 0) return "Must be a positive number.";
        return null;
      },
      "3600000",
    );
    console.log();

    // Step 6: Session Warning
    console.log("Step 6/6: Session Warning");
    console.log("  How long before the timeout to warn the user.");
    const warn = await askWithValidation(
      rl,
      "  Warning in ms",
      (v) => {
        const n = parseInt(v, 10);
        if (Number.isNaN(n) || n <= 0) return "Must be a positive number.";
        if (n >= parseInt(timeout, 10)) return "Must be less than the session timeout.";
        return null;
      },
      "3000000",
    );
    console.log();

    // Summary
    const values: EnvValues = {
      DISCORD_BOT_TOKEN: token,
      ALLOWED_SERVER_ID: serverId,
      ALLOWED_USER_ID: userId,
      PROJECT_ROOT: projectRoot,
      SESSION_TIMEOUT_MS: timeout,
      SESSION_WARN_MS: warn,
    };

    console.log("-".repeat(50));
    console.log("  Configuration Summary");
    console.log("-".repeat(50));
    console.log(`  Token:      ${maskToken(token)}`);
    console.log(`  Server ID:  ${serverId}`);
    console.log(`  User ID:    ${userId}`);
    console.log(`  Root:       ${projectRoot}`);
    console.log(`  Timeout:    ${timeout}ms`);
    console.log(`  Warning:    ${warn}ms`);
    console.log("-".repeat(50));
    console.log();

    writeEnvFile(envPath, values);
    console.log(`Configuration saved to ${envPath}`);
    console.log();
    console.log("Next steps:");
    console.log("  npm run dev       # Start in development mode");
    console.log("  npm run build     # Build for production");
    console.log("  npm start         # Run production build");
    console.log();
  } finally {
    rl.close();
  }
}

main().catch((err) => {
  console.error("Setup failed:", err.message);
  process.exit(1);
});
