#!/usr/bin/env node
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
let debounceTimer = null;
let isPushing = false;

const ignoreList = [
  ".git",
  ".next",
  "node_modules",
  ".env",
  ".env.local",
  "package-lock.json",
  "db.sqlite",
  ".system_generated",
  ".vercel",
];

function shouldIgnore(filename) {
  if (!filename) return true;
  return ignoreList.some((pattern) => filename.includes(pattern));
}

function runGitPush() {
  if (isPushing) return;
  isPushing = true;

  try {
    const status = execSync("git status --porcelain", { cwd: rootDir, encoding: "utf8" }).trim();
    if (!status) {
      isPushing = false;
      return;
    }

    const changedLines = status.split("\n").map((l) => l.trim());
    console.log(`\n🔄 [Auto-Push] File save detected in VS Code (${changedLines.length} files modified).`);
    console.log(`⏳ [Auto-Push] Staging & committing changes...`);

    execSync("git add .", { cwd: rootDir, stdio: "inherit" });

    const timestamp = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
    const commitMsg = `update from VS Code [${timestamp}]`;
    execSync(`git commit -m "${commitMsg}"`, { cwd: rootDir, stdio: "inherit" });

    console.log(`🚀 [Auto-Push] Pushing to GitHub (origin/main)...`);
    execSync("git push origin main", { cwd: rootDir, stdio: "inherit" });
    console.log(`✅ [Auto-Push] Pushed to GitHub at ${timestamp}! Auto-deploy triggered on Vercel.\n`);
  } catch (err) {
    console.error(`❌ [Auto-Push] Error during git sync:`, err.message);
  } finally {
    isPushing = false;
  }
}

console.log(`=======================================================`);
console.log(`👀 [Auto-Push] Watching for file changes in:`);
console.log(`   ${rootDir}`);
console.log(`💾 Whenever you save a file in VS Code, it will be`);
console.log(`   automatically committed and pushed to GitHub!`);
console.log(`=======================================================\n`);

try {
  fs.watch(rootDir, { recursive: true }, (eventType, filename) => {
    if (shouldIgnore(filename)) return;

    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      runGitPush();
    }, 3500); // 3.5s debounce to allow multiple saves or formatters to settle
  });
} catch (err) {
  console.error("Watch error:", err);
}
