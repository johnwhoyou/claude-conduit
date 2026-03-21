import { query } from "@anthropic-ai/claude-agent-sdk";

export interface ClaudeResponse {
  text: string;
  sessionId: string;
  costUsd: number;
  isError: boolean;
  errorMessage?: string;
}

function extractTextFromContent(content: any[]): string {
  return content
    .filter((block: any) => block.type === "text" && block.text)
    .map((block: any) => block.text)
    .join("\n");
}

export async function sendMessage(opts: {
  prompt: string;
  cwd: string;
  sessionId?: string;
}): Promise<ClaudeResponse> {
  let capturedSessionId = opts.sessionId ?? "";
  let costUsd = 0;
  let isError = false;
  let errorMessage: string | undefined;

  // Collect all assistant text messages throughout the conversation
  const assistantTexts: string[] = [];
  let resultText = "";

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

      // Capture text from assistant messages (questions, progress, intermediate output)
      if (message.type === "assistant" && message.message?.content) {
        const text = extractTextFromContent(message.message.content);
        if (text) assistantTexts.push(text);
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

  // Prefer the result text (concise summary), but if it's empty or very short
  // compared to the full assistant output, use the full conversation instead.
  // This handles cases where Claude asks questions or provides detailed intermediate output
  // that doesn't make it into the result summary.
  let finalText = resultText;
  if (assistantTexts.length > 0) {
    const fullText = assistantTexts.join("\n\n");
    if (!resultText || (fullText.length > resultText.length * 2 && fullText.length > 200)) {
      finalText = fullText;
    }
  }

  return { text: finalText, sessionId: capturedSessionId, costUsd, isError, errorMessage };
}
