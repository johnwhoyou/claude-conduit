export interface FormattedChunk {
  type: "text" | "file";
  content: string;
  filename?: string;
}

const MAX_LENGTH = 300;
const MAX_INLINE_CODE_LINES = 30;
const DIFF_PATTERN = /^---\s+\S+\n\+\+\+\s+\S+\n@@/m;

interface CodeBlock {
  lang: string;
  code: string;
  start: number;
  end: number;
}

function extractCodeBlocks(text: string): { blocks: CodeBlock[]; textWithoutBlocks: string } {
  const regex = /```(\w*)\n([\s\S]*?)```/g;
  const blocks: CodeBlock[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    blocks.push({
      lang: match[1] || "txt",
      code: match[2],
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  let textWithoutBlocks = text;
  for (let i = blocks.length - 1; i >= 0; i--) {
    const b = blocks[i];
    textWithoutBlocks =
      textWithoutBlocks.slice(0, b.start) +
      `\n[CODE_BLOCK_${i}]\n` +
      textWithoutBlocks.slice(b.end);
  }

  return { blocks, textWithoutBlocks };
}

function splitAtParagraphs(text: string): string[] {
  const chunks: string[] = [];
  let current = "";

  for (const para of text.split(/\n\n+/)) {
    if (current.length + para.length + 2 > MAX_LENGTH && current.length > 0) {
      chunks.push(current.trim());
      current = para;
    } else {
      current += (current ? "\n\n" : "") + para;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

function langToExtension(lang: string): string {
  const map: Record<string, string> = {
    ts: ".ts", typescript: ".ts",
    js: ".js", javascript: ".js",
    py: ".py", python: ".py",
    rs: ".rs", rust: ".rs",
    go: ".go",
    sh: ".sh", bash: ".sh",
    json: ".json", yaml: ".yaml", yml: ".yaml",
    md: ".md", sql: ".sql", html: ".html", css: ".css",
    diff: ".patch",
    txt: ".txt",
  };
  return map[lang] || `.${lang}`;
}

export function formatResponse(text: string): FormattedChunk[] {
  const { blocks, textWithoutBlocks } = extractCodeBlocks(text);
  const results: FormattedChunk[] = [];

  const blockResults = blocks.map((block, i) => {
    const lineCount = block.code.split("\n").length;
    const isDiff = DIFF_PATTERN.test(block.code) || block.lang === "diff";

    if (isDiff) {
      return {
        placeholder: `[CODE_BLOCK_${i}]`,
        inline: null,
        attachment: { type: "file" as const, content: block.code, filename: `changes${langToExtension("diff")}` },
        summary: "_Diff attached as `.patch` file_",
      };
    }

    if (lineCount > MAX_INLINE_CODE_LINES) {
      const ext = langToExtension(block.lang);
      return {
        placeholder: `[CODE_BLOCK_${i}]`,
        inline: null,
        attachment: { type: "file" as const, content: block.code, filename: `snippet${ext}` },
        summary: `_Code block (${lineCount} lines) attached as \`snippet${ext}\`_`,
      };
    }

    return {
      placeholder: `[CODE_BLOCK_${i}]`,
      inline: "```" + block.lang + "\n" + block.code + "```",
      attachment: null,
      summary: null,
    };
  });

  let processedText = textWithoutBlocks;
  for (const br of blockResults) {
    if (br.inline) {
      processedText = processedText.replace(br.placeholder, br.inline);
    } else if (br.summary) {
      processedText = processedText.replace(br.placeholder, br.summary);
    }
  }

  const textChunks = splitAtParagraphs(processedText);
  for (const chunk of textChunks) {
    if (chunk.length > MAX_LENGTH) {
      results.push({ type: "text", content: chunk.slice(0, MAX_LENGTH - 30) + "\n... _(truncated)_" });
      results.push({ type: "file", content: chunk, filename: "full-output.txt" });
    } else {
      results.push({ type: "text", content: chunk });
    }
  }

  for (const br of blockResults) {
    if (br.attachment) {
      results.push(br.attachment);
    }
  }

  return results;
}
