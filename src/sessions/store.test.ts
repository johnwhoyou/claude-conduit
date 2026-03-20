import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { SessionStore } from "./store.js";

describe("SessionStore", () => {
  let storePath: string;

  beforeEach(() => {
    storePath = path.join(os.tmpdir(), `claude-discord-test-${Date.now()}.json`);
  });

  afterEach(() => {
    if (fs.existsSync(storePath)) fs.unlinkSync(storePath);
  });

  it("saves and retrieves a session entry", () => {
    const store = new SessionStore(storePath);
    store.save({
      channelId: "ch-1",
      channelName: "test-project",
      sessionId: "sess-abc",
      workingDirectory: "/tmp/test",
      createdAt: new Date().toISOString(),
    });
    const entry = store.getByChannelId("ch-1");
    assert.equal(entry?.sessionId, "sess-abc");
  });

  it("returns undefined for unknown channel", () => {
    const store = new SessionStore(storePath);
    assert.equal(store.getByChannelId("unknown"), undefined);
  });

  it("persists across instances", () => {
    const store1 = new SessionStore(storePath);
    store1.save({
      channelId: "ch-1",
      channelName: "test",
      sessionId: "sess-abc",
      workingDirectory: "/tmp",
      createdAt: new Date().toISOString(),
    });

    const store2 = new SessionStore(storePath);
    assert.equal(store2.getByChannelId("ch-1")?.sessionId, "sess-abc");
  });

  it("deletes a session entry", () => {
    const store = new SessionStore(storePath);
    store.save({
      channelId: "ch-1",
      channelName: "test",
      sessionId: "sess-abc",
      workingDirectory: "/tmp",
      createdAt: new Date().toISOString(),
    });
    store.delete("ch-1");
    assert.equal(store.getByChannelId("ch-1"), undefined);
  });

  it("finds session by channel name", () => {
    const store = new SessionStore(storePath);
    store.save({
      channelId: "ch-1",
      channelName: "my-project",
      sessionId: "sess-abc",
      workingDirectory: "/tmp",
      createdAt: new Date().toISOString(),
    });
    assert.equal(store.getByChannelName("my-project")?.sessionId, "sess-abc");
  });
});
