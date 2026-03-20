export type SessionState = "active" | "hibernated" | "ended";

export interface Session {
  channelId: string;
  channelName: string;
  sessionId: string;
  workingDirectory: string;
  state: SessionState;
  lastActivity: number;
  processing: boolean;
  messageQueue: string[];
}

const MAX_QUEUE_DEPTH = 5;

export class SessionManager {
  private sessions = new Map<string, Session>();
  private timers = new Map<string, { warn: NodeJS.Timeout; timeout: NodeJS.Timeout }>();
  private timeoutMs: number;
  private warnMs: number;
  public onWarn?: (channelId: string) => void;
  public onHibernate?: (channelId: string) => void;

  constructor(opts: { timeoutMs: number; warnMs: number }) {
    this.timeoutMs = opts.timeoutMs;
    this.warnMs = opts.warnMs;
  }

  create(channelId: string, channelName: string, workingDirectory: string, sessionId: string): Session {
    const session: Session = {
      channelId,
      channelName,
      sessionId,
      workingDirectory,
      state: "active",
      lastActivity: Date.now(),
      processing: false,
      messageQueue: [],
    };
    this.sessions.set(channelId, session);
    this.resetTimers(channelId);
    return session;
  }

  get(channelId: string): Session | undefined {
    return this.sessions.get(channelId);
  }

  end(channelId: string): void {
    const session = this.sessions.get(channelId);
    if (!session) return;
    session.state = "ended";
    this.clearTimers(channelId);
  }

  hibernate(channelId: string): void {
    const session = this.sessions.get(channelId);
    if (!session) return;
    session.state = "hibernated";
    this.clearTimers(channelId);
  }

  reactivate(channelId: string): void {
    const session = this.sessions.get(channelId);
    if (!session) return;
    session.state = "active";
    session.lastActivity = Date.now();
    this.resetTimers(channelId);
  }

  touch(channelId: string): void {
    const session = this.sessions.get(channelId);
    if (!session) return;
    session.lastActivity = Date.now();
    this.resetTimers(channelId);
  }

  enqueue(channelId: string, message: string): boolean {
    const session = this.sessions.get(channelId);
    if (!session) return false;
    if (session.messageQueue.length >= MAX_QUEUE_DEPTH) return false;
    session.messageQueue.push(message);
    return true;
  }

  dequeue(channelId: string): string | undefined {
    return this.sessions.get(channelId)?.messageQueue.shift();
  }

  queueSize(channelId: string): number {
    return this.sessions.get(channelId)?.messageQueue.length ?? 0;
  }

  remove(channelId: string): void {
    this.clearTimers(channelId);
    this.sessions.delete(channelId);
  }

  private resetTimers(channelId: string): void {
    this.clearTimers(channelId);
    const warn = setTimeout(() => this.onWarn?.(channelId), this.warnMs);
    const timeout = setTimeout(() => {
      this.hibernate(channelId);
      this.onHibernate?.(channelId);
    }, this.timeoutMs);
    this.timers.set(channelId, { warn, timeout });
  }

  private clearTimers(channelId: string): void {
    const timers = this.timers.get(channelId);
    if (timers) {
      clearTimeout(timers.warn);
      clearTimeout(timers.timeout);
      this.timers.delete(channelId);
    }
  }
}
