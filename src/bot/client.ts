import { Client, Events, GatewayIntentBits } from "discord.js";
import path from "node:path";
import os from "node:os";
import { Config } from "../config.js";
import { SessionManager } from "../sessions/manager.js";
import { SessionStore } from "../sessions/store.js";
import { Handlers } from "./handlers.js";
import { registerCommands } from "./commands.js";

export async function createBot(config: Config): Promise<Client> {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  const storePathResolved = path.join(os.homedir(), ".claude-discord", "sessions.json");
  const store = new SessionStore(storePathResolved);
  const manager = new SessionManager({
    timeoutMs: config.sessionTimeoutMs,
    warnMs: config.sessionWarnMs,
  });
  const handlers = new Handlers(config, manager, store);

  manager.onWarn = async (channelId) => {
    const channel = client.channels.cache.get(channelId);
    if (channel?.isTextBased() && "send" in channel) {
      await (channel as any).send("_Session will hibernate in 10 minutes due to inactivity. Send a message to keep it alive._");
    }
  };

  manager.onHibernate = async (channelId) => {
    const channel = client.channels.cache.get(channelId);
    if (channel?.isTextBased() && "send" in channel) {
      await (channel as any).send("_Session hibernated. Send any message to resume._");
    }
  };

  client.once(Events.ClientReady, async (readyClient) => {
    console.log("[ok] Bot online as " + readyClient.user.tag);

    // Verify bot is in the configured server
    const guild = readyClient.guilds.cache.get(config.allowedServerId);
    if (!guild) {
      console.error(`[x] Bot is not in the configured server (ALLOWED_SERVER_ID: ${config.allowedServerId})`);
      console.error("    Invite the bot using the OAuth2 URL from Discord Developer Portal.");
      process.exit(1);
    }
    console.log(`[ok] Connected to server: ${guild.name}`);

    // Check bot permissions
    const me = guild.members.me;
    if (me) {
      const required = [
        "ViewChannel",
        "SendMessages",
        "ReadMessageHistory",
        "AttachFiles",
        "EmbedLinks",
        "AddReactions",
        "UseApplicationCommands",
      ] as const;
      const missing = required.filter((p) => !me.permissions.has(p));
      if (missing.length > 0) {
        console.warn(`[!!] Bot is missing permissions: ${missing.join(", ")}`);
      } else {
        console.log("[ok] Bot has all required permissions");
      }
    }

    await registerCommands(config.discordBotToken, readyClient.user.id, config.allowedServerId);
    console.log("[ok] Slash commands registered");
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    switch (interaction.commandName) {
      case "session": await handlers.handleSessionCommand(interaction); break;
      case "end": await handlers.handleEndCommand(interaction); break;
      case "forget": await handlers.handleForgetCommand(interaction); break;
    }
  });

  client.on(Events.MessageCreate, (message) => handlers.handleMessage(message));

  client.on(Events.ChannelDelete, (channel) => {
    if ("id" in channel) manager.remove(channel.id);
  });

  return client;
}
