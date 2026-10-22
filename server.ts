import express from "express";
import path from "node:path";
import { mkdir, readFile, readdir, writeFile, rename, rm } from "node:fs/promises";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import session from "./netlify/functions/session.js";
import insights from "./netlify/functions/ai-attendance-insights.js";
import parentAlert from "./netlify/functions/send-parent-alert.js";
import { createAttendanceHandler, type RecordStore } from "./server/attendance-handler.js";

dotenv.config();
const app = express();
app.use(express.text({ type: "application/json", limit: "900kb" }));
// Local development has its own durable store; it never connects to production data.
const root = path.resolve(".attendly-local");
const store: RecordStore = {
  async list({ prefix }) {
    const folder = path.join(root, prefix);
    const files = await readdir(folder).catch((error) => { if (error.code === "ENOENT") return []; throw error; });
    return { blobs: files.filter(name => !name.endsWith(".tmp")).map(name => ({ key: prefix + name })) };
  },
  async get(key) {
    try { return JSON.parse(await readFile(path.join(root, key), "utf8")); }
    catch (error: any) { if (error.code === "ENOENT") return null; throw error; }
  },
  async setJSON(key, value) {
    const target = path.join(root, key);
    await mkdir(path.dirname(target), { recursive: true });
    const temporary = target + "." + crypto.randomUUID() + ".tmp";
    await writeFile(temporary, JSON.stringify(value), { mode: 0o600 });
    await rename(temporary, target);
  },
  async delete(key) { await rm(path.join(root, key), { force: true }); },
};
const handlers: Record<string, (req: Request) => Promise<Response>> = {
  "/api/session": session,
  "/api/attendance-data": createAttendanceHandler(() => store),
  "/api/ai-attendance-insights": insights,
  "/api/send-parent-alert": parentAlert,
};
app.use("/api", async (req, res) => {
  const handler = handlers[req.path.startsWith("/api/") ? req.path : "/api" + req.path];
  if (!handler) { res.status(404).json({ error: "Unknown API endpoint" }); return; }
  try {
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) if (value) headers.set(key, Array.isArray(value) ? value.join(",") : value);
    // Trust the local socket, rather than a client-supplied rate-limit header.
    headers.delete("x-vercel-forwarded-for");
    headers.set("x-nf-client-connection-ip", req.socket.remoteAddress || "local");
    const request = new Request(`${req.protocol}://${req.get("host")}${req.originalUrl}`, {
      method: req.method, headers,
      ...(req.method === "GET" || req.method === "HEAD" ? {} : { body: typeof req.body === "string" ? req.body : "" }),
    });
    const response = await handler(request);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    res.status(response.status).send(await response.text());
  } catch {
    res.status(500).json({ error: "Request could not be processed." });
  }
});
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve("dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => res.sendFile(path.join(distPath, "index.html")));
  }
  app.listen(Number(process.env.PORT) || 3000, "127.0.0.1", () => console.log("Attendly server ready"));
}
void startServer();
