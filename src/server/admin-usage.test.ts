import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/** The service-role client bypasses RLS; every importer must be reviewed and listed here. */
const ALLOWED = [
  "src/server/ai/keys.ts",
  "src/server/account/delete.ts",
  "src/server/account/export.ts",
  "src/server/ingest/tokens.ts",
  "src/server/ingest/ingest.ts",
  "src/server/nutrition/lookup-cache.ts",
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

describe("service-role client usage", () => {
  it("is imported only from allow-listed server modules", () => {
    const importers = sourceFiles("src")
      .filter((file) => readFileSync(file, "utf8").includes("@/server/supabase-admin"))
      .map((file) => relative(process.cwd(), file));
    expect(importers.sort()).toEqual([...ALLOWED].sort());
  });
});
