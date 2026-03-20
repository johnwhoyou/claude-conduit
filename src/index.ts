import "dotenv/config";
import { loadConfig } from "./config.js";
import { createBot } from "./bot/client.js";

async function main() {
  const config = loadConfig();
  console.log("ClaudeConduit starting...");
  console.log("Project root: " + config.projectRoot);

  const client = await createBot(config);
  await client.login(config.discordBotToken);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
