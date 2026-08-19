import express from "express";
import { createServer } from "node:http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { afterEach, describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { cancelTestRun, createTestRun } from "./dashboard";
import type { TrpcContext } from "./_core/context";

const user = { id: 77, openId: "http-test-user", email: "http-test@example.com", name: "HTTP Test", loginMethod: "test", role: "user" as const, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() };
const input = { proxyAddress: `0xhttp-proxy-${Date.now()}`, caller: "0xattacker", admin: "0xadmin", implementation: "0xblocked", allowlisted: false };
const servers: ReturnType<typeof createServer>[] = [];

async function startTransport(session: "valid-session" | "missing-session") {
  const app = express();
  app.use(express.json());
  app.use("/api/trpc", createExpressMiddleware({
    router: appRouter,
    createContext: async ({ req, res }) => ({
      user: session === "valid-session" ? user : undefined,
      req: req as TrpcContext["req"],
      res: res as TrpcContext["res"],
    }),
  }));
  const server = createServer(app);
  servers.push(server);
  await new Promise<void>(resolve => server.listen(0, resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test transport did not bind to a TCP port");
  return `http://127.0.0.1:${address.port}/api/trpc/dashboard.enforceProxyUpgrade`;
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => server.close(() => resolve()))));
});

describe("proxy governance tRPC HTTP transport", () => {
  it("returns UNAUTHORIZED over HTTP without a valid session context", async () => {
    const url = await startTransport("missing-session");
    const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ json: input }) });
    const body = await response.json() as { error?: { json?: { data?: { code?: string } } } };
    expect(response.status).toBe(401);
    expect(body.error?.json?.data?.code).toBe("UNAUTHORIZED");
  });

  it("evaluates and persists a blocked upgrade over the authenticated HTTP transport", async () => {
    const url = await startTransport("valid-session");
    const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json", "x-test-session": "valid-session" }, body: JSON.stringify({ json: input }) });
    const body = await response.json() as { result?: { data?: { json?: { allowed?: boolean; reason?: string; finding?: { severity?: string; category?: string } } } } };
    expect(response.status).toBe(200);
    expect(body.result?.data?.json).toMatchObject({ allowed: false, reason: "UNAUTHORIZED_CALLER", finding: { severity: "CRITICAL", category: "Upgrade authorization" } });
  }, 15000);
});


describe("run-control tRPC HTTP transport", () => {
  async function startProcedure(session: "valid-session" | "missing-session", procedure: string) {
    const app = express();
    app.use(express.json());
    app.use("/api/trpc", createExpressMiddleware({
      router: appRouter,
      createContext: async ({ req, res }) => ({ user: session === "valid-session" ? user : undefined, req: req as TrpcContext["req"], res: res as TrpcContext["res"] }),
    }));
    const server = createServer(app);
    servers.push(server);
    await new Promise<void>(resolve => server.listen(0, resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Test transport did not bind to a TCP port");
    return `http://127.0.0.1:${address.port}/api/trpc/dashboard.${procedure}`;
  }

  async function post(procedure: string, input: unknown) {
    const url = await startProcedure("valid-session", procedure);
    return fetch(url, { method: "POST", headers: { "content-type": "application/json", "x-test-session": "valid-session" }, body: JSON.stringify({ json: input }) });
  }
  async function get(procedure: string, input: unknown) {
    const url = await startProcedure("valid-session", procedure);
    return fetch(`${url}?input=${encodeURIComponent(JSON.stringify({ json: input }))}`, { headers: { "x-test-session": "valid-session" } });
  }

  it("serves history and detail through authenticated HTTP procedures", async () => {
    const created = createTestRun({ risk: "HIGH", parallel: false, profile: "critical-core" });
    const historyResponse = await get("runHistory", { limit: 2, offset: 0 });
    const detailResponse = await get("runDetail", { runId: created.id });
    const historyBody = await historyResponse.json() as { result?: { data?: { json?: { rows?: unknown[] } } } };
    const detailBody = await detailResponse.json() as { result?: { data?: { json?: { id?: string } } } };
    expect(historyResponse.status).toBe(200);
    expect(historyBody.result?.data?.json?.rows).toBeDefined();
    expect(detailResponse.status).toBe(200);
    expect(detailBody.result?.data?.json?.id).toBe(created.id);
  });

  it("routes cancellation, retry, and resume mutations over authenticated HTTP", async () => {
    const retryRun = createTestRun({ risk: "MEDIUM", parallel: true, profile: "adversarial" });
    await cancelTestRun(retryRun.id);
    const cancelResponse = await post("cancelRun", { runId: retryRun.id });
    const retryResponse = await post("retryRun", { runId: retryRun.id });
    const resumeRun = createTestRun({ risk: "LOW", parallel: false, profile: "critical-core" });
    await cancelTestRun(resumeRun.id);
    const resumeResponse = await post("resumeRun", { runId: resumeRun.id });
    expect(cancelResponse.status).toBe(200);
    expect(retryResponse.status).toBe(200);
    expect(resumeResponse.status).toBe(200);
  }, 15000);
});
