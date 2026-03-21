import { existsSync } from "node:fs";

if (!existsSync(".env")) {
  console.error("No .env file found. Run 'npm run setup' to configure.");
  process.exit(1);
}

import "dotenv/config";
import { loadConfig } from "./config.js";
import { runPreflight } from "./preflight.js";
import { createBot } from "./bot/client.js";

async function main() {
  const config = loadConfig();
  console.log("ClaudeConduit starting...");
  runPreflight(config);

  const client = await createBot(config);
  await client.login(config.discordBotToken);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
