import { list, get, put, del } from "@vercel/blob";
import type { RecordStore } from "./attendance-handler.js";

// All blobs are private. Only authenticated server functions reach this adapter.
// OIDC is scoped to this Vercel project's production deployment.
export const vercelStore: RecordStore = {
  async list({ prefix }) {
    const blobs: { key: string }[] = [];
    let cursor: string | undefined;
    do {
      const page = await list({ prefix, cursor, limit: 1000 });
      blobs.push(...page.blobs.map((blob) => ({ key: blob.pathname })));
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    return { blobs };
  },
  async get(key) {
    const result = await get(key, { access: "private", useCache: false });
    if (!result) return null;
    if (result.statusCode !== 200) throw new Error("Unexpected storage response");
    return new Response(result.stream).json();
  },
  async setJSON(key, value) {
    return put(key, JSON.stringify(value), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
      cacheControlMaxAge: 60,
    });
  },
  async delete(key) {
    await del(key);
  },
};
