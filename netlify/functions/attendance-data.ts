import { getStore } from "@netlify/blobs";
import type { Config } from "@netlify/functions";
import { guard } from "./_shared/auth";

const STORE_NAME = "attendly-attendance";
const COLLECTIONS = new Set([
  "students",
  "classrooms",
  "attendance_logs",
  "parent_alerts",
]);

const store = () => getStore({ name: STORE_NAME, consistency: "strong" });

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function collectionKey(collection: string, id: string): string {
  return `${collection}/${encodeURIComponent(id)}`;
}

async function listCollection<T>(collection: string): Promise<T[]> {
  const { blobs } = await store().list({ prefix: `${collection}/` });
  const values = await Promise.all(
    blobs.map(async ({ key }) => {
      const value = await store().get(key, { type: "json" });
      return value as T | null;
    }),
  );
  return values.filter((value) => value !== null) as T[];
}

export default async (request: Request): Promise<Response> => {
  const denied = guard(request);
  if (denied) return denied;
  try {
    if (request.method === "GET") {
      const [students, classrooms, attendance, alerts] = await Promise.all([
        listCollection("students"),
        listCollection("classrooms"),
        listCollection("attendance_logs"),
        listCollection("parent_alerts"),
      ]);

      return jsonResponse({ students, classrooms, attendance, alerts });
    }

    if (request.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    const raw = await request.text();
    if (raw.length > 900000)
      return jsonResponse({ error: "Document exceeds 900 KB." }, 413);
    const body = JSON.parse(raw) as Record<string, unknown>;
    if (body.action !== "upsert" && body.action !== "delete")
      return jsonResponse({ error: "Unknown action." }, 400);

    const collection =
      typeof body.collection === "string" ? body.collection : "";
    const action = body.action === "delete" ? "delete" : "upsert";
    if (!COLLECTIONS.has(collection)) {
      return jsonResponse({ error: "Unknown collection" }, 400);
    }

    const data =
      body.data && typeof body.data === "object"
        ? (body.data as Record<string, unknown>)
        : null;
    const id =
      typeof body.id === "string"
        ? body.id
        : typeof data?.id === "string"
          ? data.id
          : "";
    if (!id || id.length > 160 || !/^[a-zA-Z0-9_-]+$/.test(id)) {
      return jsonResponse({ error: "A document id is required" }, 400);
    }

    const key = collectionKey(collection, id);
    if (action === "delete") {
      await store().delete(key);
      return jsonResponse({ deleted: true });
    }

    if (!data) {
      return jsonResponse({ error: "Document data is required" }, 400);
    }

    if (data.id !== id)
      return jsonResponse({ error: "Document ID mismatch." }, 400);
    if (
      collection === "students" &&
      (typeof data.name !== "string" ||
        !data.name.trim() ||
        typeof data.rollNumber !== "string" ||
        !data.rollNumber.trim())
    )
      return jsonResponse({ error: "Name and roll number are required." }, 400);
    if (
      collection === "attendance_logs" &&
      (!["present", "absent", "late"].includes(String(data.status)) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(String(data.date)) ||
        id !== `att-${data.date}-${data.studentId}`)
    )
      return jsonResponse({ error: "Invalid attendance record." }, 400);
    if (
      collection === "classrooms" &&
      (![data.latitude, data.longitude, data.radiusMeters].every(
        Number.isFinite,
      ) ||
        Number(data.radiusMeters) <= 0 ||
        Math.abs(Number(data.latitude)) > 90 ||
        Math.abs(Number(data.longitude)) > 180)
    )
      return jsonResponse({ error: "Invalid classroom coordinates." }, 400);
    await store().setJSON(key, {
      ...data,
      updatedAt: new Date().toISOString(),
    });
    return jsonResponse({ saved: true });
  } catch (error) {
    console.error("Attendly data store error", error);
    return jsonResponse({ error: "Data store unavailable" }, 503);
  }
};

export const config: Config = {
  path: "/api/attendance-data",
  method: ["GET", "POST"],
};
