import { execFileSync } from "node:child_process";

const configuredBase = process.env.PROGRESS_BASE_SHA || process.argv[2] || "origin/main";
const head = process.env.PROGRESS_HEAD_SHA || process.argv[3] || "HEAD";
const base = /^0+$/.test(configuredBase) ? "origin/main" : configuredBase;

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" })
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
}

function collectChangedFiles() {
  const files = new Set();

  for (const args of [
    ["diff", "--name-only", `${base}...${head}`],
    ["diff", "--name-only"],
    ["diff", "--name-only", "--cached"],
    ["ls-files", "--others", "--exclude-standard"],
  ]) {
    for (const file of git(args)) files.add(file.replaceAll("\\", "/"));
  }

  return [...files];
}

const changedFiles = collectChangedFiles();
const implementationPrefixes = ["src/", "server/", "shared/", "tests/", "content/"];
const implementationFiles = new Set(["package.json", "package-lock.json"]);
const implementationChanged = changedFiles.some(
  (file) =>
    implementationFiles.has(file) ||
    implementationPrefixes.some((prefix) => file.startsWith(prefix)),
);
const progressUpdated = changedFiles.includes("docs/progress-status.md");

if (implementationChanged && !progressUpdated) {
  console.error(
    "Application or dependency files changed without an update to docs/progress-status.md.",
  );
  process.exit(1);
}

console.log(
  implementationChanged
    ? "Progress status accompanies the implementation changes."
    : "No implementation change requires a progress-status update.",
);
