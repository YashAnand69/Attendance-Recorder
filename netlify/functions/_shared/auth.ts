import { createHmac, timingSafeEqual } from "node:crypto";

export const cookieName = "attendly_session";
export const maxAge = 43200;
export function sign(value: string) {
  const secret = Netlify.env.get("ATTENDLY_SESSION_SECRET");
  if (!secret) throw new Error("Login is not configured.");
  return createHmac("sha256", secret).update(value).digest("hex");
}
export function equal(a: string, b: string) {
  return (
    a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b))
  );
}
export function authenticated(req: Request): boolean {
  try {
    const token = req.headers
      .get("cookie")
      ?.split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith(cookieName + "="))
      ?.slice(cookieName.length + 1);
    const [expires, signature] = (token || "").split(".");
    return (
      Number(expires) > Date.now() &&
      Boolean(signature) &&
      equal(sign(expires), signature)
    );
  } catch {
    return false;
  }
}
export function guard(req: Request): Response | null {
  if (!authenticated(req))
    return Response.json(
      { error: "Sign in to access your workspace." },
      { status: 401 },
    );
  const origin = req.headers.get("origin");
  if (req.method !== "GET" && origin && origin !== new URL(req.url).origin) {
    return Response.json(
      { error: "Request origin rejected." },
      { status: 403 },
    );
  }
  return null;
}
