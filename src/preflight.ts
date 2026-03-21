import fs from "node:fs";
import { execFileSync } from "node:child_process";
import type { Config } from "./config.js";
import { validateConfig } from "./config.js";

export function runPreflight(config: Config): void {
  console.log();
  let hasErrors = false;

  // Validate config values
  const errors = validateConfig(config);
  for (const error of errors) {
    console.log(`[x] ${error}`);
    hasErrors = true;
  }

  // Check PROJECT_ROOT is accessible
  if (fs.existsSync(config.projectRoot)) {
    try {
      fs.accessSync(config.projectRoot, fs.constants.R_OK | fs.constants.W_OK);
      console.log(`[ok] Project root: ${config.projectRoot}`);
    } catch {
      console.log(`[x] Cannot access PROJECT_ROOT '${config.projectRoot}' (check permissions)`);
      hasErrors = true;
    }
  }

  // Check Claude Code CLI
  try {
    execFileSync("which", ["claude"], { stdio: "pipe" });
    console.log("[ok] Claude Code CLI found");
  } catch {
    console.log("[!!] Claude Code CLI not found in PATH (make sure it's installed)");
  }

  console.log();

  if (hasErrors) {
    console.error("Fix the errors above or run 'npm run setup' to reconfigure.");
    process.exit(1);
  }
}
