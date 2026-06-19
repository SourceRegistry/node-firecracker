import { existsSync, mkdirSync, readdirSync, rmSync, copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const rootDir = path.resolve(fileURLToPath(import.meta.url), "../..");
const distDir = path.join(rootDir, "dist");
const outDir = path.join(rootDir, "generated", "jsr-types");

if (!existsSync(distDir)) {
  throw new Error(`dist/ not found at ${distDir} - run "tsc && vite build" first`);
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

for (const entry of readdirSync(distDir)) {
  if (entry.endsWith(".d.ts")) {
    copyFileSync(path.join(distDir, entry), path.join(outDir, entry));
  }
}
