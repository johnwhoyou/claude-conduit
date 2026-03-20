import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatResponse } from "./index.js";

describe("formatResponse", () => {
  it("returns short text as a single inline message", () => {
    const result = formatResponse("Hello world");
    assert.equal(result.length, 1);
    assert.equal(result[0].type, "text");
    assert.equal(result[0].content, "Hello world");
  });

  it("splits long text at paragraph boundaries", () => {
    // Each paragraph ~200 chars, 30 of them = ~6000 chars total, forces splitting at 1800
    const longText = Array(30).fill("Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi.\n\n").join("");
    const result = formatResponse(longText);
    assert.ok(result.length > 1);
    assert.ok(result.every((r) => r.type === "file" || r.content.length <= 1800));
  });

  it("keeps small code blocks inline", () => {
    const text = "Here is code:\n```ts\nconst x = 1;\n```";
    const result = formatResponse(text);
    assert.equal(result.length, 1);
    assert.equal(result[0].type, "text");
  });

  it("extracts large code blocks as file attachments", () => {
    const lines = Array(35).fill("const x = 1;").join("\n");
    const text = "Here is code:\n```ts\n" + lines + "\n```";
    const result = formatResponse(text);
    const attachment = result.find((r) => r.type === "file");
    assert.ok(attachment);
    assert.ok(attachment!.filename!.endsWith(".ts"));
  });

  it("detects unified diffs and attaches as .patch", () => {
    const diff = "Changes made:\n```diff\n--- a/file.ts\n+++ b/file.ts\n@@ -1,3 +1,3 @@\n-old line\n+new line\n```";
    const result = formatResponse(diff);
    const attachment = result.find((r) => r.type === "file");
    assert.ok(attachment);
    assert.ok(attachment!.filename!.endsWith(".patch"));
  });
});
