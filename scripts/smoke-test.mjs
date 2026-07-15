const baseUrl = process.env.CAIOS_BASE_URL;
if (!baseUrl) {
  console.error("CAIOS_BASE_URL is required.");
  process.exit(1);
}

const url = new URL("/api/health", baseUrl);
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 10000);

try {
  const response = await fetch(url, { signal: controller.signal, redirect: "error" });
  if (!response.ok) throw new Error(`Health endpoint returned ${response.status}`);
  const body = await response.json();
  if (body.status !== "ready") throw new Error(`Unexpected health status: ${body.status}`);
  if (body.publishing !== "human-approval-required") throw new Error("Human approval safeguard is not reported.");
  console.log("CAIOS smoke test passed.");
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
} finally {
  clearTimeout(timeout);
}
