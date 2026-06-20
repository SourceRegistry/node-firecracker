# Repository Guidelines

## Project Structure & Module Organization

This is a TypeScript ESM library for the Firecracker REST API. Source lives in `src/`: `client.ts` contains the main client and resource classes, `types.ts` defines API shapes, `error.ts` defines API errors, and `index.ts` is the public export surface. Unit tests sit beside source as `src/*.test.ts`; the real VM test is `src/integration.real.test.ts`. Example usage is in `examples/simple.ts`. Build and publishing helpers are in `scripts/`, and CI lives in `.github/workflows/`.

## Build, Test, and Development Commands

- `npm install`: install dependencies; CI uses this rather than `npm ci`.
- `npm test`: run the Vitest unit suite once.
- `npm run test:ui`: open the Vitest UI for local test iteration.
- `npm run test:coverage`: run tests with V8 coverage output.
- `npm run build`: compile TypeScript, bundle with Vite, and prepare the JSR package.
- `npm run docs:build`: generate TypeDoc output in `generated/docs`.
- `npm run examples/simple`: run the simple example with `tsx`.

## Coding Style & Naming Conventions

Use strict TypeScript and ESM imports with explicit `.js` extensions for local modules, as in `import { FirecrackerApiError } from "./error.js"`. Match the existing two-space indentation and double quotes in `src/`. Public classes and types use `PascalCase`; methods, variables, and resource factory functions use `camelCase`. Keep resource classes thin: map methods directly to Firecracker endpoints and preserve typed boundaries.

## Testing Guidelines

Use Vitest with Node environment and globals enabled. Name unit tests `*.test.ts` next to the code they exercise, and assert HTTP method, route, body, and error behavior for client changes. Run `npm test` before opening a PR; run `npm run test:coverage` when touching broad request handling. The real integration test requires Linux/KVM plus Firecracker fixtures; in the devcontainer, run `npx vitest run src/integration.real.test.ts`.

## Commit & Pull Request Guidelines

History follows Conventional Commits such as `fix: ...` and `feat: ...`; releases are produced by semantic-release with `node-firecracker(release): x.y.z` commits. Use concise, imperative commit subjects and include scope only when it adds clarity. PRs should describe behavior changes, list tests run, link issues, and note any Firecracker fixture or devcontainer requirements. Include examples or docs updates when public usage changes.

## Security & Configuration Tips

Do not commit downloaded Firecracker binaries, kernels, rootfs images, generated docs, coverage output, or local socket paths. Use environment variables such as `FIRECRACKER_BIN`, `FIRECRACKER_KERNEL`, `FIRECRACKER_ROOTFS`, and `FIRECRACKER_SOCKET` for real VM runs.
