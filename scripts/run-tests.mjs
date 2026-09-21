import { readdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

function findTestFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      return findTestFiles(entryPath);
    }

    return entry.name.endsWith(".test.ts") ? [entryPath] : [];
  });
}

const testFiles = findTestFiles("tests");

if (testFiles.length === 0) {
  throw new Error("No TypeScript test files were found in tests/.");
}

const result = spawnSync(
  process.execPath,
  ["--import", "tsx", "--test", ...testFiles],
  { stdio: "inherit" },
);

process.exitCode = result.status ?? 1;
