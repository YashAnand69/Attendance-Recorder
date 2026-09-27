import type {
  Student,
  Classroom,
  AttendanceRecord,
  ParentAlert,
} from "../types";
import { INITIAL_STUDENTS, DEFAULT_CLASSROOM } from "./mockData";
import { recognizeFaceFromDataUrl } from "./faceRecognition";
import { getLocalDateKey } from "./dateUtils";
export type Workspace = {
  students: Student[];
  classrooms: Classroom[];
  attendance: AttendanceRecord[];
  alerts: ParentAlert[];
};
type Mutation = {
  collection: string;
  action: "upsert" | "delete";
  id: string;
  data?: any;
  version: string;
};
export type SyncStatus = {
  mode: "demo" | "cloud";
  pending: number;
  state: "idle" | "syncing" | "saved" | "error";
  message: string;
  lastSync: string | null;
};
let authenticated = false;
let state: Workspace = demoState();
let status: SyncStatus = {
  mode: "demo",
  pending: 0,
  state: "idle",
  message: "Demo workspace · saved on this device",
  lastSync: null,
};
const listeners = new Set<() => void>();
let syncing: Promise<number> | null = null;
let revision = 0;
const cacheKey = () =>
  authenticated ? "attendly_cloud_v4" : "attendly_demo_v4";
const queueKey = "attendly_pending_v4";
const notify = () => listeners.forEach((fn) => fn());
function read<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
  } catch {
    return fallback;
  }
}
function persist() {
  localStorage.setItem(cacheKey(), JSON.stringify(state));
  status = { ...status, pending: authenticated ? queue().length : 0 };
  notify();
}
function queue(): Mutation[] {
  return read(queueKey, []);
}
function saveQueue(items: Mutation[]) {
  localStorage.setItem(queueKey, JSON.stringify(items));
}
function demoState(): Workspace {
  const students = INITIAL_STUDENTS.slice(0, 5);
  const attendance: AttendanceRecord[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    students.forEach((s, n) => {
      if (i === 0 && n > 2) return;
      attendance.push({
        id: `att-${getLocalDateKey(d)}-${s.id}`,
        studentId: s.id,
        studentName: s.name,
        rollNumber: s.rollNumber,
        className: s.className,
        date: getLocalDateKey(d),
        timestamp: `09:${String(3 + n * 4).padStart(2, "0")}`,
        status:
          n === 2 ? "late" : i % 3 === 0 && n === 4 ? "absent" : "present",
        confidence: 0,
        latitude: 0,
        longitude: 0,
        verificationMethod: "manual",
        syncedOffline: false,
      });
    });
  }
  return { students, attendance, classrooms: [DEFAULT_CLASSROOM], alerts: [] };
}
export function getWorkspace() {
  return state;
}
export function getSyncStatus() {
  return status;
}
export function subscribeWorkspace(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
export function isCloudWorkspace() {
  return authenticated;
}
export async function api(path: string, init: RequestInit = {}) {
  const res = await fetch(path, {
    ...init,
    credentials: "same-origin",
    signal: AbortSignal.timeout(12000),
    headers: { "Content-Type": "application/json", ...init.headers },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}
export async function initializeWorkspace() {
  revision++;
  try {
    authenticated = (await api("/api/session")).authenticated === true;
    if (!authenticated) localStorage.removeItem("attendly_offline_until");
  } catch {
    authenticated =
      !navigator.onLine &&
      Number(localStorage.getItem("attendly_offline_until")) > Date.now();
  }
  state = read(
    cacheKey(),
    authenticated
      ? { students: [], attendance: [], classrooms: [], alerts: [] }
      : demoState(),
  );
  status = {
    ...status,
    mode: authenticated ? "cloud" : "demo",
    state: "idle",
    message: authenticated
      ? "Connecting to your workspace…"
      : "Demo workspace · saved on this device",
  };
  notify();
  if (authenticated) {
    await syncOfflineQueueToCloud();
    await refreshWorkspace();
  }
}
export async function login(password: string) {
  await api("/api/session", {
    method: "POST",
    body: JSON.stringify({ password }),
  });
  localStorage.setItem("attendly_offline_until", String(Date.now() + 43200000));
  await initializeWorkspace();
}
export async function logout() {
  await api("/api/session", { method: "DELETE" });
  revision++;
  localStorage.removeItem("attendly_offline_until");
  authenticated = false;
  localStorage.removeItem("attendly_cloud_v4");
  state = read(cacheKey(), demoState());
  status = {
    mode: "demo",
    pending: 0,
    state: "idle",
    message: "Demo workspace · saved on this device",
    lastSync: null,
  };
  notify();
}
function applyMutation(target: Workspace, mutation: Mutation) {
  const field = (
    {
      students: "students",
      classrooms: "classrooms",
      attendance_logs: "attendance",
      parent_alerts: "alerts",
    } as Record<string, string>
  )[mutation.collection];
  if (!field) return;
  const records = (target as any)[field].filter(
    (item: any) => item.id !== mutation.id,
  );
  (target as any)[field] =
    mutation.action === "delete" ? records : [...records, mutation.data];
}
export async function refreshWorkspace() {
  if (!authenticated || syncing) return;
  const startedAtRevision = revision;
  try {
    const fresh: Workspace = await api("/api/attendance-data");
    if (!authenticated || startedAtRevision !== revision) return;
    queue().forEach((m) => applyMutation(fresh, m));
    state = fresh;
    status = {
      ...status,
      state: "saved",
      message: queue().length ? "Changes waiting to sync" : "All changes saved",
      lastSync: new Date().toISOString(),
    };
    persist();
  } catch (error) {
    status = { ...status, state: "error", message: (error as Error).message };
    notify();
  }
}
async function mutate(
  collection: string,
  action: "upsert" | "delete",
  id: string,
  data?: any,
) {
  revision++;
  const mutation: Mutation = {
    collection,
    action,
    id,
    data,
    version: crypto.randomUUID(),
  };
  if (authenticated)
    saveQueue([
      ...queue().filter((m) => m.id !== id || m.collection !== collection),
      mutation,
    ]);
  const next = structuredClone(state);
  applyMutation(next, mutation);
  localStorage.setItem(cacheKey(), JSON.stringify(next));
  state = next;
  status = {
    ...status,
    pending: authenticated ? queue().length : 0,
    message: authenticated
      ? "Saving changes…"
      : "Demo change saved on this device",
  };
  notify();
  if (authenticated) void syncOfflineQueueToCloud();
}
export function getOfflineQueue(): AttendanceRecord[] {
  return queue()
    .filter((m) => m.collection === "attendance_logs" && m.action === "upsert")
    .map((m) => m.data);
}
export function getPendingSyncCount() {
  return authenticated ? queue().length : 0;
}
export async function syncOfflineQueueToCloud(): Promise<number> {
  if (!authenticated || !navigator.onLine) return 0;
  if (syncing) return syncing;
  syncing = (async () => {
    let count = 0;
    status = { ...status, state: "syncing" };
    notify();
    try {
      for (const m of queue()) {
        await api("/api/attendance-data", {
          method: "POST",
          body: JSON.stringify(m),
        });
        saveQueue(queue().filter((current) => current.version !== m.version));
        count++;
      }
      status = {
        ...status,
        state: "saved",
        pending: queue().length,
        lastSync: new Date().toISOString(),
        message: queue().length
          ? "Changes waiting to sync"
          : "All changes saved",
      };
    } catch (error) {
      status = {
        ...status,
        state: "error",
        pending: queue().length,
        message: (error as Error).message,
      };
    }
    notify();
    return count;
  })();
  try {
    return await syncing;
  } finally {
    syncing = null;
  }
}
export async function fetchStudents() {
  return state.students;
}
export async function fetchClassroom() {
  return state.classrooms[0] || null;
}
export async function saveClassroom(value: Classroom) {
  await mutate("classrooms", "upsert", value.id, value);
}
export async function seedInitialDataIfNeeded() {}
export async function addStudent(
  value: Omit<Student, "id" | "createdAt" | "status">,
) {
  if (!value.name.trim() || !value.rollNumber.trim())
    throw new Error("Name and roll number are required.");
  if (
    state.students.some(
      (s) =>
        s.rollNumber.trim().toLowerCase() ===
        value.rollNumber.trim().toLowerCase(),
    )
  )
    throw new Error("This roll number is already enrolled.");
  const student: Student = {
    ...value,
    name: value.name.trim(),
    rollNumber: value.rollNumber.trim(),
    id: "stu-" + crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    status: "active",
  };
  await mutate("students", "upsert", student.id, student);
  return student;
}
export async function deleteStudent(id: string) {
  await mutate("students", "delete", id);
}
export async function logAttendanceRecord(
  value: Omit<AttendanceRecord, "id" | "syncedOffline">,
) {
  const record: AttendanceRecord = {
    ...value,
    id: `att-${value.date}-${value.studentId}`,
    syncedOffline: authenticated && !navigator.onLine,
  };
  delete record.snapshotUrl;
  await mutate("attendance_logs", "upsert", record.id, record);
  return record;
}
export function subscribeToAllAttendance(
  callback: (records: AttendanceRecord[]) => void,
) {
  callback(state.attendance);
  return subscribeWorkspace(() => callback(state.attendance));
}
export function subscribeToAttendance(
  date: string,
  callback: (records: AttendanceRecord[]) => void,
) {
  return subscribeToAllAttendance((records) =>
    callback(records.filter((r) => r.date === date)),
  );
}
export async function sendParentAbsentAlert(
  student: Student,
  date: string,
  reason = "Attendance update",
): Promise<{ success: boolean; alert?: ParentAlert }> {
  if (!authenticated) return { success: false };
  try {
    const response = await api("/api/send-parent-alert", {
      method: "POST",
      body: JSON.stringify({
        studentName: student.name,
        rollNumber: student.rollNumber,
        className: student.className,
        parentEmail: student.parentEmail,
        date,
        reason,
      }),
    });
    const alert: ParentAlert = {
      id: "alert-" + crypto.randomUUID(),
      studentId: student.id,
      studentName: student.name,
      parentEmail: student.parentEmail,
      date,
      status: "sent",
      sentAt: new Date().toISOString(),
      message: reason,
    };
    await mutate("parent_alerts", "upsert", alert.id, alert);
    return { success: response.success, alert };
  } catch {
    return { success: false };
  }
}
export async function ensureRasterStudentImages(students: Student[]) {
  return students;
}
export const runFacialScan = recognizeFaceFromDataUrl;
export async function verifyClassroomLocation(
  lat: number,
  lng: number,
  room: Classroom,
) {
  if (
    ![lat, lng, room.latitude, room.longitude, room.radiusMeters].every(
      Number.isFinite,
    )
  )
    throw new Error("Valid location is required.");
  const rad = (v: number) => (v * Math.PI) / 180;
  const a =
    Math.sin(rad(room.latitude - lat) / 2) ** 2 +
    Math.cos(rad(lat)) *
      Math.cos(rad(room.latitude)) *
      Math.sin(rad(room.longitude - lng) / 2) ** 2;
  const distanceMeters = Math.round(
    6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)),
  );
  return {
    distanceMeters,
    maxRadiusMeters: room.radiusMeters,
    isPresentInClassroom: distanceMeters <= room.radiusMeters,
    message:
      distanceMeters <= room.radiusMeters
        ? "Location verified"
        : "Outside classroom boundary",
  };
}
