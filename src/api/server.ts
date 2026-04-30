import http from "node:http";
import express from "express";
import cors from "cors";
import { WebSocketServer } from "ws";
import { sessionsRouter } from "./routes/sessions.js";
import { ingestRouter } from "./routes/ingest.js";
import { generateRouter } from "./routes/generate.js";
import { reviewRouter } from "./routes/review.js";
import { runRouter } from "./routes/run.js";
import { reportsRouter } from "./routes/reports.js";
import { configRouter } from "./routes/config.js";
import { errorHandler, ApiError } from "./middleware/error-handler.js";
import { progressEmitter } from "./websocket/progress.js";

const PORT = parseInt(process.env.CTT_PORT ?? "3456", 10);
const HOST = process.env.CTT_HOST ?? "localhost";

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use("/api/sessions", sessionsRouter);
app.use("/api/ingest", ingestRouter);
app.use("/api/generate", generateRouter);
app.use("/api/review", reviewRouter);
app.use("/api/run", runRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/config", configRouter);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Error handler (must be last)
app.use(errorHandler);

const server = http.createServer(app);

// WebSocket server for real-time progress
const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (ws, req) => {
  // Expect runId as query param: ws://localhost:3456/ws?runId=xxx
  const url = new URL(req.url ?? "", `http://${HOST}`);
  const runId = url.searchParams.get("runId");

  if (!runId) {
    ws.send(JSON.stringify({ error: "runId query parameter required" }));
    ws.close();
    return;
  }

  const unsubscribe = progressEmitter.onRun(runId, (event) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(event));
    }

    if (event.status === "completed" || event.status === "error") {
      ws.close();
    }
  });

  ws.on("close", () => {
    unsubscribe();
  });

  ws.send(JSON.stringify({ runId, status: "connected" }));
});

export { app, server };

// Start server when run directly
if (process.argv[1]?.endsWith("server.js") || process.argv[1]?.endsWith("server.ts")) {
  server.listen(PORT, HOST, () => {
    console.log(`CTT API server running at http://${HOST}:${PORT}`);
    console.log(`WebSocket endpoint: ws://${HOST}:${PORT}/ws?runId=<runId>`);
  });
}
