import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import path from "node:path";
import fs from "node:fs";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { storageGetSignedUrl } from "../storage";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { WebSocketServer } from "ws";
import { getExecutionEvents, subscribeExecution } from "../dashboard";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  const executionWss = new WebSocketServer({ noServer: true });
  const broadcastExecution = (event: unknown) => {
    const payload = JSON.stringify(event);
    executionWss.clients.forEach(client => { if (client.readyState === 1) client.send(payload); });
  };
  const unsubscribeExecution = subscribeExecution(broadcastExecution);
  executionWss.on("connection", socket => {
    getExecutionEvents().forEach(event => socket.send(JSON.stringify(event)));
    socket.send(JSON.stringify({ time: new Date().toISOString(), level: "INFO", message: "EXECUTION STREAM CONNECTED", status: "CONNECTED" }));
  });
  server.on("upgrade", (request, socket, head) => {
    if (request.url !== "/ws/execution") return;
    executionWss.handleUpgrade(request, socket, head, client => executionWss.emit("connection", client, request));
  });
  setInterval(() => broadcastExecution({ time: new Date().toISOString(), level: "INFO", message: "CONTROL PLANE HEARTBEAT · awaiting execution events", status: "IDLE" }), 5000);
  server.on("close", unsubscribeExecution);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.get("/api/reports/signed", async (req, res) => {
    const key = String(req.query.key ?? "");
    if (!key.startsWith("bsafe-reports/") || key.includes("..")) return res.status(400).json({ error: "Invalid artifact key" });
    try {
      const signedUrl = await storageGetSignedUrl(key);
      return res.redirect(302, signedUrl);
    } catch (error) {
      console.warn("[Reports] Could not sign artifact URL", error);
      return res.status(404).json({ error: "Artifact unavailable" });
    }
  });
  app.get("/api/reports/:artifact", (req, res) => {
    const artifact = path.basename(String(req.params.artifact));
    if (!artifact || artifact !== req.params.artifact || !/^[a-zA-Z0-9._-]+$/.test(artifact)) return res.status(400).json({ error: "Invalid artifact name" });
    const filePath = path.resolve(process.cwd(), "reports", artifact);
    if (!filePath.startsWith(path.resolve(process.cwd(), "reports") + path.sep) || !fs.existsSync(filePath)) return res.status(404).json({ error: "Artifact not found" });
    return res.download(filePath, artifact);
  });
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
