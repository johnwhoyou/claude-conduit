import os from "node:os";

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

function resolvePath(p: string): string {
  return p.startsWith("~") ? p.replace("~", os.homedir()) : p;
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

  if (config.sessionWarnMs >= config.sessionTimeoutMs) {
    throw new Error("SESSION_WARN_MS must be less than SESSION_TIMEOUT_MS");
  }

  return config;
}
