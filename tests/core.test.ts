import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { csvCell } from "../src/lib/csv";
import { getLocalDateKey } from "../src/lib/dateUtils";
import { calculateMonthlySummaries } from "../src/lib/exportUtils";
import { authenticated, sign, guard } from "../netlify/functions/_shared/auth";
import session from "../netlify/functions/session";
import { buildLocalAttendanceInsights } from "../src/lib/localInsights";
import { createAttendanceHandler, type RecordStore } from "../server/attendance-handler";

test("shared data API requires login and validates persistent record writes", async () => {
  const docs = new Map<string, unknown>();
  const adapter: RecordStore = {
    async list({prefix}) { return {blobs: [...docs.keys()].filter(k => k.startsWith(prefix)).map(key=>({key}))}; },
    async get(key) { return docs.get(key) ?? null; },
    async setJSON(key, value) { docs.set(key, value); },
    async delete(key) { docs.delete(key); },
  };
  const handle = createAttendanceHandler(() => adapter);
  assert.equal((await handle(new Request("https://example.com/api/attendance-data"))).status, 401);
  const expiry = String(Date.now() + 100000);
  const cookie = "attendly_session=" + expiry + "." + sign(expiry);
  const call = (method: string, body?: unknown) => handle(new Request("https://example.com/api/attendance-data", {
    method, headers: {cookie, "content-type": "application/json"}, ...(body === undefined ? {} : {body: JSON.stringify(body)}),
  }));
  const record = {id: "stu-test", name: "Test", rollNumber: "TEST-1"};
  assert.equal((await call("POST", {collection: "students", action: "upsert", id: record.id, data: record})).status, 200);
  assert.equal((await (await call("GET")).json()).students[0].name, "Test");
  assert.equal((await call("POST", null)).status, 400);
  assert.equal((await call("POST", {collection: "students", action: "upsert", id: "../bad", data: record})).status, 400);
  assert.equal((await call("POST", {collection: "students", action: "delete", id: record.id})).status, 200);
  assert.equal((await (await call("GET")).json()).students.length, 0);
});
const password = "test-only-strong-password";
Object.assign(globalThis, {
  Netlify: {
    env: {
      get: (name: string) =>
        name === "ATTENDLY_SESSION_SECRET"
          ? "test-session-secret"
          : name === "ATTENDLY_PASSWORD_HASH"
            ? createHash("sha256").update(password).digest("hex")
            : undefined,
    },
  },
});
test("session requires a valid unexpired signature; guards writes across origins", () => {
  const expiry = String(Date.now() + 100000);
  const cookie = "attendly_session=" + expiry + "." + sign(expiry);
  const req = (extra = {}) =>
    new Request("https://example.com/api/attendance-data", {
      method: "POST",
      headers: { cookie, ...extra },
    });
  assert.equal(authenticated(req()), true);
  assert.equal(guard(req()), null);
  assert.equal(guard(req({ origin: "https://attacker.example" }))?.status, 403);
  assert.equal(
    authenticated(
      new Request("https://example.com", {
        headers: { cookie: "attendly_session=" + expiry + ".wrong" },
      }),
    ),
    false,
  );
  const expired = String(Date.now() - 1);
  assert.equal(
    authenticated(
      new Request("https://example.com", {
        headers: {
          cookie: "attendly_session=" + expired + "." + sign(expired),
        },
      }),
    ),
    false,
  );
  assert.equal(guard(new Request("https://example.com"))?.status, 401);
});
test("login checks password and returns an HttpOnly Secure cookie", async () => {
  const request = (value: string) =>
    new Request("https://example.com/api/session", {
      method: "POST",
      body: JSON.stringify({ password: value }),
    });
  assert.equal((await session(request("incorrect"))).status, 401);
  const response = await session(request(password));
  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("set-cookie")!,
    /HttpOnly; Secure; SameSite=Strict/,
  );
});
test("CSV escapes quotes, separators and spreadsheet formulas", () => {
  assert.equal(csvCell('A, "B"'), '"A, ""B"""');
  assert.equal(csvCell("=1+1"), '"\'=1+1"');
});
test("local dates and monthly summaries count one attendance per day and include late arrivals", () => {
  assert.equal(getLocalDateKey(new Date(2026, 8, 27, 0, 10)), "2026-09-27");
  const student = { id: "one" } as any;
  const records = [
    { studentId: "one", date: "2026-09-01", status: "present" },
    { studentId: "one", date: "2026-09-01", status: "late" },
  ] as any;
  const [summary] = calculateMonthlySummaries([student], records, 1);
  assert.equal(summary.percentage, 100);
  assert.equal(summary.lateDays, 1);
  assert.equal(summary.presentDays, 0);
});
test("insight percentages use unique roster days and not the raw attendance count", () => {
  const students = [{id: "one", name: "Test"}] as any;
  const records = [
    {studentId: "one", date: "2026-09-01", status: "present"},
    {studentId: "one", date: "2026-09-01", status: "late"},
    {studentId: "removed", date: "2026-09-01", status: "present"},
  ] as any;
  const insights = buildLocalAttendanceInsights(students, records, 2);
  assert.equal(insights.overallAttendancePercentage, 50);
  assert.equal(insights.lowAttendanceStudents[0].percentage, 50);
  assert.equal(insights.lowAttendanceStudents[0].presentCount, 1);
});
test("workspace demo changes never call cloud, and cloud writes retry without losing local edits", async () => {
  const values = new Map<string, string>();
  Object.assign(globalThis, {
    localStorage: {
      getItem: (k: string) => values.get(k) || null,
      setItem: (k: string, v: string) => values.set(k, v),
      removeItem: (k: string) => values.delete(k),
    },
  });
  Object.defineProperty(globalThis, "navigator", {
    value: { onLine: true },
    configurable: true,
  });
  let signedIn = false;
  let failing = false;
  let writes = 0;
  const cloud = { students: [], attendance: [], classrooms: [], alerts: [] };
  globalThis.fetch = async (input: any, options: any = {}) => {
    if (String(input).endsWith("/session"))
      return Response.json({ authenticated: signedIn });
    if (options.method === "POST") {
      writes++;
      return Response.json(
        failing ? { error: "temporarily offline" } : { saved: true },
        { status: failing ? 503 : 200 },
      );
    }
    return Response.json(cloud);
  };
  const store = await import("../src/lib/attendanceStore");
  await store.initializeWorkspace();
  const student = {
    name: "Test",
    rollNumber: "T1",
    className: "A",
    parentEmail: "",
    parentPhone: "",
    faceImageDataUrl: "",
  };
  await store.addStudent(student);
  assert.equal(writes, 0);
  signedIn = true;
  await store.initializeWorkspace();
  assert.equal(store.getWorkspace().students.length, 0);
  failing = true;
  await store.addStudent(student);
  await store.syncOfflineQueueToCloud();
  assert.equal(store.getPendingSyncCount(), 1);
  assert.equal(store.getWorkspace().students.length, 1);
  failing = false;
  await store.syncOfflineQueueToCloud();
  assert.equal(store.getPendingSyncCount(), 0);
  assert.equal(store.getSyncStatus().state, "saved");
});
