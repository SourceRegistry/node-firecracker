import type { FirecrackerErrorBody } from "./types.js";

/** Thrown when the Firecracker API responds with a non-2xx status code. */
export class FirecrackerApiError extends Error {
  readonly statusCode: number;
  readonly faultMessage?: string;

  constructor(statusCode: number, body: FirecrackerErrorBody | undefined, raw: string) {
    super(body?.fault_message ?? (raw || `Firecracker API request failed with status ${statusCode}`));
    this.name = "FirecrackerApiError";
    this.statusCode = statusCode;
    this.faultMessage = body?.fault_message;
  }
}
