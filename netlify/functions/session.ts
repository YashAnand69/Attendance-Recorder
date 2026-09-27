import { env } from "./_shared/env.js";
import { createHash } from "node:crypto";
import { authenticated, cookieName, equal, maxAge, sign } from "./_shared/auth.js";
import type { Config } from "@netlify/functions";

const attempts = new Map<string, { count: number; reset: number }>();
export default async (req: Request) => {
  const headers: Record<string, string> = { "Cache-Control": "no-store" };
  if (req.method === "GET")
    return Response.json(
      {
        authenticated: authenticated(req),
        configured: Boolean(env("ATTENDLY_PASSWORD_HASH")),
      },
      { headers },
    );
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(req.url).origin)
    return new Response(null, { status: 403 });
  if (req.method === "DELETE") {
    headers["Set-Cookie"] =
      `${cookieName}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
    return Response.json({ authenticated: false }, { headers });
  }
  if (req.method !== "POST") return new Response(null, { status: 405 });
  const hash = env("ATTENDLY_PASSWORD_HASH");
  if (!hash)
    return Response.json(
      { error: "Administrator login has not been configured." },
      { status: 503, headers },
    );
  const ip = req.headers.get("x-nf-client-connection-ip") || "unknown";
  const entry = attempts.get(ip) || { count: 0, reset: Date.now() + 60000 };
  if (entry.reset < Date.now()) {
    entry.count = 0;
    entry.reset = Date.now() + 60000;
  }
  if (++entry.count > 8)
    return Response.json(
      { error: "Too many attempts. Please wait one minute." },
      { status: 429, headers },
    );
  attempts.set(ip, entry);
  if (attempts.size > 10000) attempts.clear();
  try {
    const { password } = await req.json();
    if (
      typeof password !== "string" ||
      password.length > 200 ||
      !equal(createHash("sha256").update(password).digest("hex"), hash)
    ) {
      return Response.json(
        { error: "Incorrect password." },
        { status: 401, headers },
      );
    }
    const expires = String(Date.now() + maxAge * 1000);
    headers["Set-Cookie"] =
      `${cookieName}=${expires}.${sign(expires)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
    return Response.json({ authenticated: true }, { headers });
  } catch {
    return Response.json(
      { error: "Could not sign in." },
      { status: 400, headers },
    );
  }
};
export const config: Config = { path: "/api/session" };
