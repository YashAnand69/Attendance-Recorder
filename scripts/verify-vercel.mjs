import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";

const deployment = process.argv[2];
const handoff = process.argv[3];
if (!deployment?.startsWith("https://attendly-attendance-") || !handoff) throw new Error("Explicit Attendly URL and private login file required.");
const password = readFileSync(handoff, "utf8").match(/password: `([^`]+)`/)[1];
let cookie = "";
function request(path, method = "GET", body, origin) {
  const args = ["--yes", "vercel", "curl", path, "--deployment", deployment, "--", "-sS", "-i", "-X", method];
  if (cookie) args.push("-H", "Cookie: " + cookie);
  if (origin) args.push("-H", "Origin: " + origin);
  if (body !== undefined) args.push("-H", "Content-Type: application/json", "--data-binary", "@-");
  const result = spawnSync("npx", args, {encoding: "utf8", input: body === undefined ? undefined : JSON.stringify(body), timeout: 60000, maxBuffer: 5000000});
  if (result.status) throw new Error("Deployment request failed: " + path);
  const headersEnd = result.stdout.indexOf("\r\n\r\n");
  const headers = result.stdout.slice(0, headersEnd);
  const payload = result.stdout.slice(headersEnd + 4);
  const status = Number(headers.match(/HTTP\/\S+ (\d+)/)?.[1]);
  let data;
  try { data = JSON.parse(payload); } catch { throw new Error("Non-JSON response: " + path + " HTTP " + status); }
  return {status, headers, data};
}

assert.equal(request("/api/attendance-data").status, 401);
assert.equal(request("/api/session", "POST", {password: "incorrect-test-password"}).status, 401);
const login = request("/api/session", "POST", {password});
assert.equal(login.status, 200, JSON.stringify(login.data));
cookie = login.headers.match(/set-cookie:\s*([^;]+)/i)?.[1];
assert.ok(cookie);
assert.equal(request("/api/session").data.authenticated, true);
const before = request("/api/attendance-data");
assert.equal(before.status, 200, JSON.stringify(before.data));
console.log("Authenticated storage read:", Object.fromEntries(Object.entries(before.data).map(([k,v])=>[k,v.length])));

const id = "stu-deployment-test-" + Date.now();
const date = new Date().toISOString().slice(0,10);
const attendanceId = "att-" + date + "-" + id;
const upsert = (collection, value) => request("/api/attendance-data", "POST", {collection, action: "upsert", id: value.id, data: value});
const remove = (collection, key) => request("/api/attendance-data", "POST", {collection, action: "delete", id: key});
try {
  const student = {id, name: "Deployment Test (temporary)", rollNumber: id, className: "Verification", faceImageDataUrl: "", parentEmail: "", parentPhone: "", status: "active"};
  assert.equal(upsert("students", student).status, 200);
  const record = {id: attendanceId, studentId: id, studentName: student.name, date, time: "00:00", status: "present", method: "manual", snapshotUrl: "must-not-be-saved"};
  assert.equal(upsert("attendance_logs", record).status, 200);
  const saved = request("/api/attendance-data");
  assert.equal(saved.status, 200);
  assert.ok(saved.data.students.some(s=>s.id===id));
  assert.equal(saved.data.attendance.find(r=>r.id===attendanceId).snapshotUrl, undefined);
  assert.equal(upsert("attendance_logs", {...record,status:"late"}).status, 200);
  const updated = request("/api/attendance-data").data.attendance.filter(r=>r.id===attendanceId);
  assert.equal(updated.length,1);
  assert.equal(updated[0].status,"late");
  assert.equal(request("/api/attendance-data", "POST", {collection:"students",action:"delete",id}, "https://untrusted.example").status,403);
  console.log("PASS: login, protected reads, student and attendance writes, update/deduplication, snapshot stripping, cross-origin rejection.");
} finally {
  assert.equal(remove("attendance_logs",attendanceId).status,200);
  assert.equal(remove("students",id).status,200);
}
const after = request("/api/attendance-data");
assert.equal(after.data.students.length,before.data.students.length);
assert.equal(after.data.attendance.length,before.data.attendance.length);
assert.equal(request("/api/session","DELETE").status,200);
cookie="";
assert.equal(request("/api/attendance-data").status,401);
console.log("PASS: temporary records removed; workspace returned to its original counts; anonymous access rejected.");
