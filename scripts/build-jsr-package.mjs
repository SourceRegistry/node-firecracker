import { existsSync, mkdirSync, readdirSync, rmSync, copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const rootDir = path.resolve(fileURLToPath(import.meta.url), "../..");
const distDir = path.join(rootDir, "dist");
const typesDir = path.join(rootDir, "generated", "jsr-types");
const outDir = path.join(rootDir, "generated", "jsr-publish");

function assertDirectory(dir, hint) {
  if (!existsSync(dir)) {
    throw new Error(`${dir} not found - ${hint}`);
  }
}

assertDirectory(distDir, 'run "tsc && vite build" first');
assertDirectory(typesDir, 'run "npm run build:jsr-types" first');

const pkg = JSON.parse(readFileSync(path.join(rootDir, "package.json"), "utf8"));

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

copyFileSync(path.join(distDir, "index.es.js"), path.join(outDir, "index.js"));

for (const entry of readdirSync(typesDir)) {
  copyFileSync(path.join(typesDir, entry), path.join(outDir, entry));
}

copyFileSync(path.join(rootDir, "README.md"), path.join(outDir, "README.md"));

const jsrConfig = {
  name: pkg.name,
  version: pkg.version,
  license: pkg.license,
  exports: "./index.js",
  publish: {
    include: ["index.js", "index.d.ts", "client.d.ts", "error.d.ts", "types.d.ts", "README.md"],
  },
};

writeFileSync(path.join(outDir, "jsr.json"), JSON.stringify(jsrConfig, null, 2) + "\n");
