import { resolvePort, startApiServer } from "./api.js";

try {
  const port = resolvePort();
  await startApiServer(port);
  console.log(`Nexora API listening on port ${port}`);
} catch {
  console.error("Nexora API failed to start");
  process.exitCode = 1;
}
