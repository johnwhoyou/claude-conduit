import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SessionManager } from "./manager.js";

describe("SessionManager", () => {
  it("creates a session and tracks it by channelId", () => {
    const manager = new SessionManager({ timeoutMs: 60000, warnMs: 50000 });
    manager.create("ch-1", "test-project", "/tmp/test", "sess-abc");
    const session = manager.get("ch-1");
    assert.equal(session?.sessionId, "sess-abc");
    assert.equal(session?.state, "active");
  });

  it("returns undefined for unknown channel", () => {
    const manager = new SessionManager({ timeoutMs: 60000, warnMs: 50000 });
    assert.equal(manager.get("unknown"), undefined);
  });

  it("kills a session and sets state to ended", () => {
    const manager = new SessionManager({ timeoutMs: 60000, warnMs: 50000 });
    manager.create("ch-1", "test-project", "/tmp/test", "sess-abc");
    manager.end("ch-1");
    assert.equal(manager.get("ch-1")?.state, "ended");
  });

  it("tracks message queue", () => {
    const manager = new SessionManager({ timeoutMs: 60000, warnMs: 50000 });
    manager.create("ch-1", "test-project", "/tmp/test", "sess-abc");
    manager.enqueue("ch-1", "hello");
    manager.enqueue("ch-1", "world");
    assert.equal(manager.queueSize("ch-1"), 2);
    assert.equal(manager.dequeue("ch-1"), "hello");
    assert.equal(manager.queueSize("ch-1"), 1);
  });

  it("rejects queue beyond max depth of 5", () => {
    const manager = new SessionManager({ timeoutMs: 60000, warnMs: 50000 });
    manager.create("ch-1", "test-project", "/tmp/test", "sess-abc");
    for (let i = 0; i < 5; i++) manager.enqueue("ch-1", `msg-${i}`);
    assert.equal(manager.enqueue("ch-1", "overflow"), false);
  });

  it("resets idle timer on touch", () => {
    const manager = new SessionManager({ timeoutMs: 60000, warnMs: 50000 });
    manager.create("ch-1", "test-project", "/tmp/test", "sess-abc");
    const before = manager.get("ch-1")!.lastActivity;
    manager.touch("ch-1");
    const after = manager.get("ch-1")!.lastActivity;
    assert.ok(after >= before);
  });
});
