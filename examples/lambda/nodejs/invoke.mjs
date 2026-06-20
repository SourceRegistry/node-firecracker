import { readFile } from "node:fs/promises";
import { handler } from "./handler.mjs";

const eventPath = process.argv[2] ?? new URL("./event.json", import.meta.url);
const event = JSON.parse(await readFile(eventPath, "utf8"));

const result = await handler(event, {
  awsRequestId: `local-${Date.now()}`,
  functionName: "node-firecracker-nodejs-demo",
});

console.log(JSON.stringify(result, null, 2));
