export async function handler(event, context = {}) {
  const numbers = Array.isArray(event.numbers) ? event.numbers : [];
  const sum = numbers.reduce((total, value) => total + Number(value || 0), 0);

  return {
    requestId: context.awsRequestId ?? event.requestId ?? "local",
    message: `Hello ${event.name ?? "microVM"}`,
    sum,
    runtime: "nodejs",
    timestamp: new Date().toISOString(),
  };
}
