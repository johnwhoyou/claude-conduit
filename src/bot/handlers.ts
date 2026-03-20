import {
  ChatInputCommandInteraction,
  Message,
  EmbedBuilder,
  AttachmentBuilder,
  TextChannel,
} from "discord.js";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { Config } from "../config.js";
import { SessionManager } from "../sessions/manager.js";
import { SessionStore } from "../sessions/store.js";
import { sendMessage } from "../claude/sdk.js";
import { formatResponse } from "../formatter/index.js";

export class Handlers {
  private config: Config;
  private manager: SessionManager;
  private store: SessionStore;

  constructor(config: Config, manager: SessionManager, store: SessionStore) {
    this.config = config;
    this.manager = manager;
    this.store = store;
  }

  private isAuthorized(guildId: string | null, userId: string): boolean {
    return guildId === this.config.allowedServerId && userId === this.config.allowedUserId;
  }

  private resolveWorkingDirectory(channelName: string, explicitPath?: string): string | null {
    if (explicitPath) {
      const resolved = explicitPath.startsWith("~")
        ? explicitPath.replace("~", os.homedir())
        : explicitPath;
      return fs.existsSync(resolved) ? resolved : null;
    }

    const projectRoot = this.config.projectRoot;
    if (!fs.existsSync(projectRoot)) return null;

    const dirs = fs.readdirSync(projectRoot);
    const normalized = channelName.toLowerCase();
    const normalizedNoHyphens = normalized.replace(/-/g, "");
    const match = dirs.find(
      (d) => d.toLowerCase() === normalized ||
             d.toLowerCase().replace(/-/g, "") === normalizedNoHyphens
    );

    if (match) {
      const fullPath = path.join(projectRoot, match);
      return fs.statSync(fullPath).isDirectory() ? fullPath : null;
    }

    return null;
  }

  async handleSessionCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!this.isAuthorized(interaction.guildId, interaction.user.id)) {
      await interaction.reply({ content: "Unauthorized.", ephemeral: true });
      return;
    }

    const channel = interaction.channel as TextChannel;
    const explicitPath = interaction.options.getString("path") ?? undefined;
    const workDir = this.resolveWorkingDirectory(channel.name, explicitPath);

    if (!workDir) {
      await interaction.reply({
        content: explicitPath
          ? "Path not found: `" + explicitPath + "`. Check the path and try again."
          : "Could not auto-resolve directory from channel name `" + channel.name + "`. Use `/session <path>` to specify.",
        ephemeral: true,
      });
      return;
    }

    const existing = this.store.getByChannelName(channel.name);
    await interaction.deferReply();

    if (existing) {
      this.manager.create(channel.id, channel.name, workDir, existing.sessionId);
      await interaction.editReply("Previous session found for `" + workDir + "`. It will resume on your next message.");
    } else {
      const result = await sendMessage({ prompt: "Confirm session started. Reply with only: Ready.", cwd: workDir });
      this.manager.create(channel.id, channel.name, workDir, result.sessionId);
      this.store.save({
        channelId: channel.id,
        channelName: channel.name,
        sessionId: result.sessionId,
        workingDirectory: workDir,
        createdAt: new Date().toISOString(),
      });
      await interaction.editReply("Session started in `" + workDir + "`.");
    }
  }

  async handleEndCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!this.isAuthorized(interaction.guildId, interaction.user.id)) {
      await interaction.reply({ content: "Unauthorized.", ephemeral: true });
      return;
    }

    const session = this.manager.get(interaction.channelId);
    if (!session) {
      await interaction.reply({ content: "No active session in this channel.", ephemeral: true });
      return;
    }

    this.manager.end(interaction.channelId);
    await interaction.reply("Session ended. Send a message to resume later.");
  }

  async handleForgetCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!this.isAuthorized(interaction.guildId, interaction.user.id)) {
      await interaction.reply({ content: "Unauthorized.", ephemeral: true });
      return;
    }

    this.manager.remove(interaction.channelId);
    this.store.delete(interaction.channelId);
    await interaction.reply("Session and history permanently deleted.");
  }

  async handleMessage(message: Message): Promise<void> {
    if (message.author.bot) return;
    if (!this.isAuthorized(message.guildId, message.author.id)) return;

    if (message.attachments.size > 0) {
      await message.reply("File attachments are not supported yet.");
      return;
    }

    const channel = message.channel as TextChannel;
    let session = this.manager.get(channel.id);

    if (!session || session.state === "ended" || session.state === "hibernated") {
      const stored = this.store.getByChannelId(channel.id) ?? this.store.getByChannelName(channel.name);

      if (stored) {
        this.manager.create(channel.id, channel.name, stored.workingDirectory, stored.sessionId);
        session = this.manager.get(channel.id)!;
        await channel.send("_Resuming previous session in `" + stored.workingDirectory + "`..._");
      } else {
        await message.reply("No session in this channel. Use `/session <path>` to start one, or name the channel after a project folder.");
        return;
      }
    }

    if (session.processing) {
      const queued = this.manager.enqueue(channel.id, message.content);
      if (queued) {
        await message.react("\u{1F552}");
      } else {
        await message.reply("Queue full, please wait for the current response.");
      }
      return;
    }

    await this.processMessage(channel, session, message.content);

    let next: string | undefined;
    while ((next = this.manager.dequeue(channel.id))) {
      const currentSession = this.manager.get(channel.id);
      if (!currentSession || currentSession.state !== "active") break;
      await this.processMessage(channel, currentSession, next);
    }
  }

  private async processMessage(channel: TextChannel, session: NonNullable<ReturnType<SessionManager["get"]>>, content: string): Promise<void> {
    session.processing = true;
    this.manager.touch(channel.id);

    const typingInterval = setInterval(() => channel.sendTyping(), 5000);
    await channel.sendTyping();

    try {
      const result = await sendMessage({
        prompt: content,
        cwd: session.workingDirectory,
        sessionId: session.sessionId,
      });

      if (result.sessionId && result.sessionId !== session.sessionId) {
        session.sessionId = result.sessionId;
        this.store.save({
          channelId: channel.id,
          channelName: session.channelName,
          sessionId: result.sessionId,
          workingDirectory: session.workingDirectory,
          createdAt: new Date().toISOString(),
        });
      }

      if (result.isError) {
        // Check if this is a stale session — retry without sessionId
        if (session.sessionId && result.errorMessage) {
          const freshResult = await sendMessage({ prompt: content, cwd: session.workingDirectory });
          if (!freshResult.isError) {
            session.sessionId = freshResult.sessionId;
            this.store.save({
              channelId: channel.id,
              channelName: session.channelName,
              sessionId: freshResult.sessionId,
              workingDirectory: session.workingDirectory,
              createdAt: new Date().toISOString(),
            });
            await channel.send("_Previous session expired, started fresh._");
            await this.sendFormatted(channel, freshResult.text);
            return;
          }
        }
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle("Error")
          .setDescription(result.errorMessage ?? "Unknown error");
        await channel.send({ embeds: [embed] });
      } else {
        await this.sendFormatted(channel, result.text);
      }
    } catch (err) {
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle("Error")
        .setDescription(err instanceof Error ? err.message : String(err));
      await channel.send({ embeds: [embed] });
    } finally {
      clearInterval(typingInterval);
      session.processing = false;
    }
  }

  private async sendFormatted(channel: TextChannel, text: string): Promise<void> {
    const chunks = formatResponse(text);
    for (const chunk of chunks) {
      if (chunk.type === "text") {
        await channel.send(chunk.content);
      } else if (chunk.type === "file" && chunk.filename) {
        try {
          const buffer = Buffer.from(chunk.content, "utf-8");
          const attachment = new AttachmentBuilder(buffer, { name: chunk.filename });
          await channel.send({ files: [attachment] });
        } catch {
          const fallback = "```\n" + chunk.content.slice(0, 1700) + "\n```";
          await channel.send(fallback);
        }
      }
    }
  }
}
