import { server } from "../../api/server.js";

export async function serveCommand(options: {
  port: string;
  host: string;
}): Promise<void> {
  const port = parseInt(options.port, 10);
  const host = options.host;

  process.env.CTT_PORT = String(port);
  process.env.CTT_HOST = host;

  function shutdown(): void {
    console.log("\nShutting down server...");
    server.close(() => {
      console.log("Server stopped.");
    });
  }

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  server.listen(port, host, () => {
    console.log(`CTT API server running at http://${host}:${port}`);
    console.log(`WebSocket endpoint: ws://${host}:${port}/ws?runId=<runId>`);
  });
}
