import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { isDiscordSnowflake, validateConfig } from "./config.js";
import type { Config } from "./config.js";

describe("loadConfig", () => {
  const originalEnv = { ...process.env };

  after(() => {
    Object.keys(process.env).forEach(key => delete process.env[key]);
    Object.assign(process.env, originalEnv);
  });

  it("throws if DISCORD_BOT_TOKEN is missing", async () => {
    delete process.env.DISCORD_BOT_TOKEN;
    const { loadConfig } = await import("./config.js");
    assert.throws(() => loadConfig(), /DISCORD_BOT_TOKEN/);
  });

  it("resolves tilde in PROJECT_ROOT to home directory", async () => {
    process.env.DISCORD_BOT_TOKEN = "a]".repeat(40);
    process.env.ALLOWED_SERVER_ID = "12345678901234567";
    process.env.ALLOWED_USER_ID = "12345678901234568";
    process.env.PROJECT_ROOT = "~/";
    process.env.SESSION_TIMEOUT_MS = "3600000";
    process.env.SESSION_WARN_MS = "3000000";
    const { loadConfig } = await import("./config.js");
    const result = loadConfig();
    assert.ok(!result.projectRoot.startsWith("~"));
  });

  it("throws if SESSION_WARN_MS >= SESSION_TIMEOUT_MS", async () => {
    process.env.DISCORD_BOT_TOKEN = "a]".repeat(40);
    process.env.ALLOWED_SERVER_ID = "12345678901234567";
    process.env.ALLOWED_USER_ID = "12345678901234568";
    process.env.PROJECT_ROOT = "/tmp";
    process.env.SESSION_TIMEOUT_MS = "1000";
    process.env.SESSION_WARN_MS = "2000";
    const { loadConfig } = await import("./config.js");
    assert.throws(() => loadConfig(), /SESSION_WARN_MS/);
  });
});

describe("isDiscordSnowflake", () => {
  it("accepts valid 17-digit snowflake", () => {
    assert.ok(isDiscordSnowflake("12345678901234567"));
  });

  it("accepts valid 20-digit snowflake", () => {
    assert.ok(isDiscordSnowflake("12345678901234567890"));
  });

  it("rejects short strings", () => {
    assert.ok(!isDiscordSnowflake("123"));
  });

  it("rejects non-numeric strings", () => {
    assert.ok(!isDiscordSnowflake("abcdefghijklmnopq"));
  });

  it("rejects empty string", () => {
    assert.ok(!isDiscordSnowflake(""));
  });

  it("rejects strings longer than 20 digits", () => {
    assert.ok(!isDiscordSnowflake("123456789012345678901"));
  });
});

describe("validateConfig", () => {
  const validConfig: Config = {
    discordBotToken: "a]".repeat(40),
    allowedServerId: "12345678901234567",
    allowedUserId: "12345678901234568",
    projectRoot: "/tmp",
    sessionTimeoutMs: 3600000,
    sessionWarnMs: 3000000,
  };

  it("returns no errors for valid config", () => {
    const errors = validateConfig(validConfig);
    assert.equal(errors.length, 0);
  });

  it("reports malformed token", () => {
    const errors = validateConfig({ ...validConfig, discordBotToken: "short" });
    assert.ok(errors.some(e => e.includes("DISCORD_BOT_TOKEN")));
  });

  it("reports token with spaces", () => {
    const errors = validateConfig({ ...validConfig, discordBotToken: "a ".repeat(40) });
    assert.ok(errors.some(e => e.includes("DISCORD_BOT_TOKEN")));
  });

  it("reports invalid server ID", () => {
    const errors = validateConfig({ ...validConfig, allowedServerId: "not-a-snowflake" });
    assert.ok(errors.some(e => e.includes("ALLOWED_SERVER_ID")));
  });

  it("reports invalid user ID", () => {
    const errors = validateConfig({ ...validConfig, allowedUserId: "abc" });
    assert.ok(errors.some(e => e.includes("ALLOWED_USER_ID")));
  });

  it("reports nonexistent PROJECT_ROOT", () => {
    const errors = validateConfig({ ...validConfig, projectRoot: "/nonexistent/path/xyz" });
    assert.ok(errors.some(e => e.includes("PROJECT_ROOT")));
  });

  it("collects multiple errors at once", () => {
    const errors = validateConfig({
      ...validConfig,
      discordBotToken: "bad",
      allowedServerId: "bad",
      allowedUserId: "bad",
      projectRoot: "/nonexistent/path/xyz",
    });
    assert.ok(errors.length >= 4);
  });
});
