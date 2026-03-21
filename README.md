# ClaudeConduit

Control [Claude Code](https://docs.anthropic.com/en/docs/claude-code) from your phone via Discord. Each channel is a session.

```
Phone → Discord → ClaudeConduit → Claude Code → Your Server
```

No more SSH clients on mobile. Just open Discord and talk to Claude.

## Why

Using Claude Code remotely via SSH/Termius on a phone is painful. Discord's mobile app is purpose-built for chat — ClaudeConduit turns it into a Claude Code interface.

**What you get:**
- Create a Discord channel → get a Claude Code session
- Full session persistence — resume conversations after restarts
- Smart output formatting — long code blocks become file attachments, not walls of text
- Message queuing — fire off follow-ups without waiting
- Auto-hibernation — sessions sleep after 1hr idle, wake on next message

## Quick Start

### Prerequisites

- Node.js 18+
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) installed and authenticated
- A Discord bot ([create one here](https://discord.com/developers/applications))

### One-Line Install

```bash
curl -fsSL https://raw.githubusercontent.com/johnwhoyou/claude-conduit/main/install.sh | bash
```

This will check prerequisites, clone to `~/.claude-conduit`, walk you through configuration, build, and optionally set up pm2 for auto-start.

### Manual Install

<details>
<summary>Click to expand manual setup steps</summary>

```bash
git clone https://github.com/johnwhoyou/claude-conduit.git
cd claude-conduit
npm install
npm run setup     # Interactive configuration wizard
npm run dev       # Start in development mode
```

Or configure manually by copying `.env.example` to `.env` and editing it:

```env
DISCORD_BOT_TOKEN=your-bot-token
ALLOWED_SERVER_ID=your-server-id
ALLOWED_USER_ID=your-user-id
PROJECT_ROOT=/path/to/your/projects
SESSION_TIMEOUT_MS=3600000
SESSION_WARN_MS=3000000
```

</details>

### Discord Bot Setup

Before running the installer, set up your Discord bot:

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application → go to **Bot** tab
3. Enable **Message Content Intent**
4. Copy your bot token
5. Go to **OAuth2** → **URL Generator**
6. Check scopes: `bot`, `applications.commands`
7. Check permissions: View Channels, Send Messages, Read Message History, Attach Files, Embed Links, Add Reactions, Use Slash Commands
8. Open the generated URL → add the bot to your private server

### Getting your IDs

Enable **Developer Mode** in Discord (Settings → Advanced), then:
- **Server ID**: Right-click server name → Copy Server ID
- **User ID**: Right-click your username → Copy User ID

### Run

```bash
# Development
npm run dev

# Production
npm run build
npm start

# With pm2 (recommended for always-on)
npm run build
pm2 start dist/index.js --name claude-conduit
```

## Usage

### Commands

| Command | Description |
|---------|-------------|
| `/session [path]` | Start a Claude Code session. Auto-resolves from channel name if no path given. |
| `/end` | End the current session (resumable later) |
| `/forget` | End session and permanently delete history |

### How it works

1. **Create a channel** in your Discord server (e.g., `my-project`)
2. **Run `/session`** — if the channel name matches a folder in your `PROJECT_ROOT`, it auto-connects
3. **Send messages** — they go directly to Claude Code
4. **Get responses** — formatted for mobile (large code blocks become file attachments)

### Session Lifecycle

```
/session → Active → (1hr idle) → Hibernated → (new message) → Active
                  → /end → Ended → (new message) → Active
                  → /forget → Deleted (permanent)
```

Sessions persist across bot restarts. Your conversation history is preserved.

### Smart Formatting

ClaudeConduit formats Claude's responses for mobile readability:

- **Short text** → inline message
- **Code blocks (< 30 lines)** → inline with syntax highlighting
- **Code blocks (> 30 lines)** → attached as files (e.g., `snippet.ts`)
- **Diffs** → attached as `.patch` files
- **Errors** → red embeds

### Message Queue

If you send messages while Claude is still responding, they're queued (up to 5) and processed in order. You'll see a clock reaction on queued messages.

## Security

ClaudeConduit only responds to **one server** and **one user** (configured via `ALLOWED_SERVER_ID` and `ALLOWED_USER_ID`). All other messages are ignored.

Claude Code runs with permissions bypassed for mobile convenience. If you need guardrails, configure [Claude Code hooks](https://docs.anthropic.com/en/docs/claude-code/hooks) on your server.

**Important:** This bot has full access to your filesystem through Claude Code. Only run it on a server you trust, in a private Discord server that only you can access.

## Architecture

```
src/
├── index.ts              # Entry point
├── config.ts             # Environment validation
├── bot/
│   ├── client.ts         # Discord client setup
│   ├── commands.ts       # Slash command definitions
│   └── handlers.ts       # Message & command handlers
├── sessions/
│   ├── manager.ts        # In-memory session lifecycle
│   └── store.ts          # JSON persistence (~/.claude-discord/sessions.json)
├── claude/
│   └── sdk.ts            # Claude Agent SDK wrapper
└── formatter/
    └── index.ts          # Output formatting for Discord
```

No database. Sessions live in memory with JSON file backup for persistence across restarts.

## Development

```bash
# Run tests
npm test

# Type check
npx tsc --noEmit
```

## License

MIT
