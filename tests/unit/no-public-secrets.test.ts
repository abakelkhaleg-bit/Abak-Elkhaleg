import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

/** docs/SECURITY.md §8: لا متغير سري يبدأ بـ NEXT_PUBLIC_، ولا أسرار مكتوبة في الكود. */

const root = path.resolve(import.meta.dirname, "../..");
const SCANNED_DIRS = ["src", "scripts"];
const SCANNED_ROOT_FILES = [".env.example", "next.config.ts"];

async function listFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const full = path.join(dir, entry.name);
      return entry.isDirectory() ? listFiles(full) : Promise.resolve([full]);
    }),
  );
  return files.flat().filter((file) => /\.(ts|tsx|mjs|js|json)$/.test(file));
}

async function scannedFiles(): Promise<string[]> {
  const nested = await Promise.all(SCANNED_DIRS.map((dir) => listFiles(path.join(root, dir))));
  return [...nested.flat(), ...SCANNED_ROOT_FILES.map((file) => path.join(root, file))];
}

describe("حماية الأسرار", () => {
  it("لا يوجد متغير NEXT_PUBLIC_ لأسماء حساسة", async () => {
    const offenders: string[] = [];
    for (const file of await scannedFiles()) {
      const content = await readFile(file, "utf8");
      const matches = content.match(/NEXT_PUBLIC_[A-Z0-9_]*(SECRET|KEY|URI|SALT|PASSWORD|TOKEN)/g);
      if (matches) offenders.push(`${path.relative(root, file)}: ${matches.join(", ")}`);
    }
    expect(offenders).toEqual([]);
  });

  it("لا توجد روابط MongoDB ببيانات اعتماد مكتوبة في الكود", async () => {
    const offenders: string[] = [];
    for (const file of await scannedFiles()) {
      const content = await readFile(file, "utf8");
      if (/mongodb(\+srv)?:\/\/[^\s"'`@/]+:[^\s"'`@/]+@/.test(content)) {
        offenders.push(path.relative(root, file));
      }
    }
    expect(offenders).toEqual([]);
  });
});
