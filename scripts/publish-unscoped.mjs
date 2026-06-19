import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const rootDir = path.resolve(fileURLToPath(import.meta.url), "../..");
const outDir = path.join(rootDir, "generated", "unscoped-publish");

const pkg = JSON.parse(readFileSync(path.join(rootDir, "package.json"), "utf8"));

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

cpSync(path.join(rootDir, "dist"), path.join(outDir, "dist"), { recursive: true });
cpSync(path.join(rootDir, "README.md"), path.join(outDir, "README.md"));
if (existsSync(path.join(rootDir, "LICENSE"))) {
  cpSync(path.join(rootDir, "LICENSE"), path.join(outDir, "LICENSE"));
}

const unscopedPkg = {
  name: "node-firecracker",
  version: pkg.version,
  description: pkg.description,
  type: pkg.type,
  main: pkg.main,
  module: pkg.module,
  types: pkg.types,
  exports: pkg.exports,
  files: pkg.files,
  engines: pkg.engines,
  repository: pkg.repository,
  keywords: pkg.keywords,
  author: pkg.author,
  license: pkg.license,
  bugs: pkg.bugs,
  homepage: pkg.homepage,
  publishConfig: { access: "public" },
};

writeFileSync(path.join(outDir, "package.json"), JSON.stringify(unscopedPkg, null, 2) + "\n");

execFileSync("npm", ["publish", "--access", "public"], { cwd: outDir, stdio: "inherit" });
