import { REST, Routes, SlashCommandBuilder } from "discord.js";

export function buildCommands() {
  return [
    new SlashCommandBuilder()
      .setName("session")
      .setDescription("Start a Claude Code session in this channel")
      .addStringOption((opt) =>
        opt.setName("path").setDescription("Working directory path").setRequired(false)
      )
      .toJSON(),
    new SlashCommandBuilder()
      .setName("end")
      .setDescription("End the current Claude Code session (resumable later)")
      .toJSON(),
    new SlashCommandBuilder()
      .setName("forget")
      .setDescription("End session and delete all history (cannot resume)")
      .toJSON(),
  ];
}

export async function registerCommands(token: string, clientId: string, guildId: string) {
  const rest = new REST().setToken(token);
  await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
    body: buildCommands(),
  });
}
