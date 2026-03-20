import { describe, it, after } from "node:test";
import assert from "node:assert/strict";

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
    process.env.DISCORD_BOT_TOKEN = "test-token";
    process.env.ALLOWED_SERVER_ID = "123";
    process.env.ALLOWED_USER_ID = "456";
    process.env.PROJECT_ROOT = "~/Desktop/Personal";
    process.env.SESSION_TIMEOUT_MS = "3600000";
    process.env.SESSION_WARN_MS = "3000000";
    const { loadConfig } = await import("./config.js");
    const result = loadConfig();
    assert.ok(!result.projectRoot.startsWith("~"));
  });

  it("throws if SESSION_WARN_MS >= SESSION_TIMEOUT_MS", async () => {
    process.env.DISCORD_BOT_TOKEN = "test-token";
    process.env.ALLOWED_SERVER_ID = "123";
    process.env.ALLOWED_USER_ID = "456";
    process.env.PROJECT_ROOT = "/tmp";
    process.env.SESSION_TIMEOUT_MS = "1000";
    process.env.SESSION_WARN_MS = "2000";
    const { loadConfig } = await import("./config.js");
    assert.throws(() => loadConfig(), /SESSION_WARN_MS/);
  });
});
