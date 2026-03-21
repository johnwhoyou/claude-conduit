import os from "node:os";
import fs from "node:fs";

export interface Config {
  discordBotToken: string;
  allowedServerId: string;
  allowedUserId: string;
  projectRoot: string;
  sessionTimeoutMs: number;
  sessionWarnMs: number;
}

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

export function resolvePath(p: string): string {
  return p.startsWith("~") ? p.replace("~", os.homedir()) : p;
}

export function isDiscordSnowflake(value: string): boolean {
  return /^\d{17,20}$/.test(value);
}

export function validateConfig(config: Config): string[] {
  const errors: string[] = [];

  if (!config.discordBotToken || config.discordBotToken.includes(" ") || config.discordBotToken.length < 50) {
    errors.push(
      "DISCORD_BOT_TOKEN looks malformed (expected ~70 characters, no spaces). Get yours at https://discord.com/developers/applications"
    );
  }

  if (!isDiscordSnowflake(config.allowedServerId)) {
    errors.push(
      `ALLOWED_SERVER_ID doesn't look like a Discord ID (expected 17-20 digit number, got '${config.allowedServerId}'). Right-click your server with Developer Mode enabled to copy it.`
    );
  }

  if (!isDiscordSnowflake(config.allowedUserId)) {
    errors.push(
      `ALLOWED_USER_ID doesn't look like a Discord ID (expected 17-20 digit number, got '${config.allowedUserId}'). Right-click your username with Developer Mode enabled to copy it.`
    );
  }

  if (config.projectRoot) {
    if (!fs.existsSync(config.projectRoot)) {
      errors.push(
        `PROJECT_ROOT '${config.projectRoot}' does not exist. Create the directory or run 'npm run setup' to reconfigure.`
      );
    } else if (!fs.statSync(config.projectRoot).isDirectory()) {
      errors.push(`PROJECT_ROOT '${config.projectRoot}' is not a directory.`);
    }
  }

  return errors;
}

export function loadConfig(): Config {
  const config: Config = {
    discordBotToken: requireEnv("DISCORD_BOT_TOKEN"),
    allowedServerId: requireEnv("ALLOWED_SERVER_ID"),
    allowedUserId: requireEnv("ALLOWED_USER_ID"),
    projectRoot: resolvePath(requireEnv("PROJECT_ROOT")),
    sessionTimeoutMs: parseInt(requireEnv("SESSION_TIMEOUT_MS"), 10),
    sessionWarnMs: parseInt(requireEnv("SESSION_WARN_MS"), 10),
  };

  if (Number.isNaN(config.sessionTimeoutMs) || Number.isNaN(config.sessionWarnMs)) {
    throw new Error("SESSION_TIMEOUT_MS and SESSION_WARN_MS must be valid numbers");
  }

  if (config.sessionWarnMs >= config.sessionTimeoutMs) {
    throw new Error("SESSION_WARN_MS must be less than SESSION_TIMEOUT_MS");
  }

  const errors = validateConfig(config);
  if (errors.length > 0) {
    throw new Error("Configuration errors:\n  - " + errors.join("\n  - "));
  }

  return config;
}
