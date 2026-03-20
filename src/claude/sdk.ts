import { query } from "@anthropic-ai/claude-agent-sdk";

export interface ClaudeResponse {
  text: string;
  sessionId: string;
  costUsd: number;
  isError: boolean;
  errorMessage?: string;
}

export async function sendMessage(opts: {
  prompt: string;
  cwd: string;
  sessionId?: string;
}): Promise<ClaudeResponse> {
  let capturedSessionId = opts.sessionId ?? "";
  let resultText = "";
  let costUsd = 0;
  let isError = false;
  let errorMessage: string | undefined;

  try {
    for await (const message of query({
      prompt: opts.prompt,
      options: {
        cwd: opts.cwd,
        ...(opts.sessionId ? { resume: opts.sessionId } : {}),
        allowDangerouslySkipPermissions: true,
        permissionMode: "bypassPermissions",
      },
    })) {
      if (message.type === "system" && message.subtype === "init") {
        capturedSessionId = message.session_id;
      }

      if (message.type === "result") {
        if (message.subtype === "success") {
          resultText = message.result;
          costUsd = message.total_cost_usd;
        } else {
          isError = true;
          const errMsg = message as any;
          errorMessage = errMsg.errors?.join("\n") ?? "Unknown error";
          costUsd = errMsg.total_cost_usd ?? 0;
        }
      }
    }
  } catch (err) {
    isError = true;
    errorMessage = err instanceof Error ? err.message : String(err);
  }

  return { text: resultText, sessionId: capturedSessionId, costUsd, isError, errorMessage };
}
