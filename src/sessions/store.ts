import fs from "node:fs";
import path from "node:path";

export interface SessionEntry {
  channelId: string;
  channelName: string;
  sessionId: string;
  workingDirectory: string;
  createdAt: string;
}

export class SessionStore {
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  private readAll(): SessionEntry[] {
    if (!fs.existsSync(this.filePath)) return [];
    try {
      const raw = fs.readFileSync(this.filePath, "utf-8");
      return JSON.parse(raw);
    } catch {
      console.error("Warning: corrupted sessions.json, starting fresh");
      return [];
    }
  }

  private writeAll(entries: SessionEntry[]): void {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const tmpPath = this.filePath + ".tmp";
    fs.writeFileSync(tmpPath, JSON.stringify(entries, null, 2));
    fs.renameSync(tmpPath, this.filePath);
  }

  save(entry: SessionEntry): void {
    const entries = this.readAll().filter((e) => e.channelId !== entry.channelId);
    entries.push(entry);
    this.writeAll(entries);
  }

  getByChannelId(channelId: string): SessionEntry | undefined {
    return this.readAll().find((e) => e.channelId === channelId);
  }

  getByChannelName(channelName: string): SessionEntry | undefined {
    return this.readAll().find((e) => e.channelName === channelName);
  }

  delete(channelId: string): void {
    const entries = this.readAll().filter((e) => e.channelId !== channelId);
    this.writeAll(entries);
  }
}
