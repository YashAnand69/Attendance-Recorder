import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  where,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import { Student, Classroom, AttendanceRecord, ParentAlert, FacialRecognitionResult, ClassroomVerificationResult } from "../types";
import { INITIAL_STUDENTS, DEFAULT_CLASSROOM, INITIAL_ATTENDANCE_RECORDS } from "./mockData";
import { recognizeFaceFromDataUrl } from "./faceRecognition";

const STUDENTS_COLLECTION = "students";
const CLASSROOMS_COLLECTION = "classrooms";
const ATTENDANCE_COLLECTION = "attendance_logs";
const ALERTS_COLLECTION = "parent_alerts";

const LOCAL_STORAGE_OFFLINE_QUEUE_KEY = "smart_attendance_offline_queue_v1";
const LOCAL_STORAGE_STUDENTS_KEY = "smart_attendance_students_cache_v2";
const LOCAL_STORAGE_ATTENDANCE_KEY = "smart_attendance_records_cache_v1";

function readLocalAttendance(): AttendanceRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_ATTENDANCE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalAttendance(records: AttendanceRecord[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_ATTENDANCE_KEY, JSON.stringify(records));
  } catch (error) {
    console.warn("Failed to update local attendance cache:", error);
  }
}

function mergeAttendanceRecords(records: AttendanceRecord[]): AttendanceRecord[] {
  return Array.from(new Map(records.map((record) => [`${record.date}:${record.studentId}`, record])).values()).sort((a, b) =>
    b.timestamp.localeCompare(a.timestamp),
  );
}

function recordsForDate(dateFilter: string): AttendanceRecord[] {
  const localRecords = readLocalAttendance().filter((record) => record.date === dateFilter);
  const seededRecords = INITIAL_ATTENDANCE_RECORDS.filter((record) => record.date === dateFilter);
  const queuedRecords = getOfflineQueue().filter((record) => record.date === dateFilter);
  return mergeAttendanceRecords([...seededRecords, ...localRecords, ...queuedRecords]);
}

// -------------------------------------------------------------
// Offline Queue Management
// -------------------------------------------------------------
export function getOfflineQueue(): AttendanceRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_OFFLINE_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function saveOfflineQueue(queue: AttendanceRecord[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.error("Failed to write to local offline queue", e);
  }
}

// -------------------------------------------------------------
// Initialize Default Database Seed (if empty)
// -------------------------------------------------------------
export async function seedInitialDataIfNeeded(): Promise<void> {
  try {
    const isSeeded = localStorage.getItem("smart_attendance_seeded_v2");
    if (isSeeded) return;

    const studentsSnap = await getDocs(collection(db, STUDENTS_COLLECTION));
    if (studentsSnap.empty) {
      console.log("Seeding Firestore with initial students...");
      for (const student of INITIAL_STUDENTS) {
        await setDoc(doc(db, STUDENTS_COLLECTION, student.id), student);
      }
      localStorage.setItem("smart_attendance_seeded_v2", "true");
    } else {
      // Check if any existing student has old SVG avatar and upgrade to realistic headshot
      studentsSnap.forEach(async (docSnap) => {
        const data = docSnap.data() as Student;
        if (data.faceImageDataUrl && data.faceImageDataUrl.includes("image/svg")) {
          const matchInitial = INITIAL_STUDENTS.find((s) => s.id === data.id);
          if (matchInitial) {
            await setDoc(doc(db, STUDENTS_COLLECTION, data.id), {
              ...data,
              faceImageDataUrl: matchInitial.faceImageDataUrl,
            });
          }
        }
      });
      localStorage.setItem("smart_attendance_seeded_v2", "true");
    }

    const classSnap = await getDocs(collection(db, CLASSROOMS_COLLECTION));
    if (classSnap.empty) {
      await setDoc(doc(db, CLASSROOMS_COLLECTION, DEFAULT_CLASSROOM.id), DEFAULT_CLASSROOM);
    }
  } catch (error) {
    console.warn("Firestore seed note (may be offline or starting up):", error);
  }
}

// -------------------------------------------------------------
// Student Operations
// -------------------------------------------------------------
export async function fetchStudents(): Promise<Student[]> {
  try {
    const querySnapshot = await Promise.race([
      getDocs(collection(db, STUDENTS_COLLECTION)),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Student sync timed out")), 3500)),
    ]);
    const students: Student[] = [];
    querySnapshot.forEach((docSnap) => {
      students.push(docSnap.data() as Student);
    });
    // Cache locally
    localStorage.setItem(LOCAL_STORAGE_STUDENTS_KEY, JSON.stringify(students));
    return students;
  } catch (e) {
    console.warn("Offline fallback for student retrieval", e);
  }

  // Fallback to local storage cache or initial mock data
  try {
    const cached = localStorage.getItem(LOCAL_STORAGE_STUDENTS_KEY);
    if (cached !== null) return JSON.parse(cached);
  } catch (err) {}

  return INITIAL_STUDENTS;
}

export async function addStudent(studentData: Omit<Student, "id" | "createdAt" | "status">): Promise<Student> {
  const newId = `stu-${Date.now()}`;
  const newStudent: Student = {
    ...studentData,
    id: newId,
    status: "active",
    createdAt: new Date().toISOString(),
  };

  try {
    await setDoc(doc(db, STUDENTS_COLLECTION, newId), newStudent);
  } catch (error: any) {
    console.error("Firestore write for new student profile failed:", error);
    if (navigator.onLine) {
      throw new Error(error?.message || "Failed to save student profile to cloud database.");
    }
  }

  // Update local cache safely
  try {
    const cachedRaw = localStorage.getItem(LOCAL_STORAGE_STUDENTS_KEY);
    let currentStudents: Student[] = [];
    if (cachedRaw) {
      try {
        currentStudents = JSON.parse(cachedRaw);
      } catch (e) {
        currentStudents = INITIAL_STUDENTS;
      }
    } else {
      currentStudents = INITIAL_STUDENTS;
    }

    const updatedList = [newStudent, ...currentStudents.filter(s => s.id !== newId)];
    localStorage.setItem(LOCAL_STORAGE_STUDENTS_KEY, JSON.stringify(updatedList));
  } catch (err) {
    console.warn("Failed to update local cache for student:", err);
  }

  return newStudent;
}

export async function deleteStudent(studentId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, STUDENTS_COLLECTION, studentId));
  } catch (error) {
    console.warn("Firestore delete failed for student:", error);
  }

  try {
    const cached = localStorage.getItem(LOCAL_STORAGE_STUDENTS_KEY);
    let current: Student[] = [];
    if (cached) {
      current = JSON.parse(cached);
    } else {
      current = INITIAL_STUDENTS;
    }
    const filtered = current.filter((s) => s.id !== studentId);
    localStorage.setItem(LOCAL_STORAGE_STUDENTS_KEY, JSON.stringify(filtered));
  } catch (err) {
    console.warn("Failed to update local cache on student deletion:", err);
  }
}

// -------------------------------------------------------------
// Attendance Record Operations & Real-Time Sync
// -------------------------------------------------------------
export function subscribeToAttendance(
  dateFilter: string,
  callback: (records: AttendanceRecord[]) => void
) {
  try {
    const q = query(
      collection(db, ATTENDANCE_COLLECTION),
      where("date", "==", dateFilter)
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const records: AttendanceRecord[] = [];
        snapshot.forEach((docSnap) => {
          records.push(docSnap.data() as AttendanceRecord);
        });

        // Merge offline queued records for current date
        const offlineQueue = getOfflineQueue().filter((r) => r.date === dateFilter);
        const combined = [...records, ...readLocalAttendance().filter((record) => record.date === dateFilter)];
        offlineQueue.forEach((offRec) => {
          if (!combined.some((c) => c.id === offRec.id)) {
            combined.push(offRec);
          }
        });

        const merged = mergeAttendanceRecords(combined);
        saveLocalAttendance(mergeAttendanceRecords([...readLocalAttendance(), ...records]));
        callback(merged);
      },
      (error) => {
        console.warn("Real-time listener offline mode:", error);
        callback(recordsForDate(dateFilter));
      }
    );
  } catch (e) {
    callback(recordsForDate(dateFilter));
    return () => {};
  }
}

export function subscribeToAllAttendance(callback: (records: AttendanceRecord[]) => void) {
  try {
    return onSnapshot(
      collection(db, ATTENDANCE_COLLECTION),
      (snapshot) => {
        const cloudRecords: AttendanceRecord[] = [];
        snapshot.forEach((docSnap) => cloudRecords.push(docSnap.data() as AttendanceRecord));
        const merged = mergeAttendanceRecords([
          ...INITIAL_ATTENDANCE_RECORDS,
          ...cloudRecords,
          ...readLocalAttendance(),
          ...getOfflineQueue(),
        ]);
        saveLocalAttendance(merged);
        callback(merged);
      },
      (error) => {
        console.warn("All-attendance listener offline mode:", error);
        callback(mergeAttendanceRecords([...readLocalAttendance(), ...getOfflineQueue(), ...INITIAL_ATTENDANCE_RECORDS]));
      },
    );
  } catch (error) {
    console.warn("Could not subscribe to all attendance records:", error);
    callback(mergeAttendanceRecords([...readLocalAttendance(), ...getOfflineQueue(), ...INITIAL_ATTENDANCE_RECORDS]));
    return () => {};
  }
}

export async function logAttendanceRecord(record: Omit<AttendanceRecord, "id" | "syncedOffline">): Promise<AttendanceRecord> {
  // One document per student per date prevents duplicate scans from creating conflicting rows.
  const newId = `att-${record.date}-${record.studentId}`;
  const isOnline = navigator.onLine;

  const fullRecord: AttendanceRecord = {
    ...record,
    id: newId,
    syncedOffline: !isOnline,
  };

  const localRecords = readLocalAttendance().filter((item) => item.id !== newId);
  saveLocalAttendance([...localRecords, fullRecord]);

  if (isOnline) {
    try {
      await setDoc(doc(db, ATTENDANCE_COLLECTION, newId), fullRecord);
    } catch (e) {
      console.warn("Cloud write failed, adding to offline queue", e);
      fullRecord.syncedOffline = true;
      const queue = getOfflineQueue();
      queue.push(fullRecord);
      saveOfflineQueue(queue);
    }
  } else {
    // Save to offline queue
    const queue = getOfflineQueue();
    queue.push(fullRecord);
    saveOfflineQueue(queue);
  }

  return fullRecord;
}

// Flush pending offline queue to Firestore when back online
export async function syncOfflineQueueToCloud(): Promise<number> {
  if (!navigator.onLine) return 0;

  const queue = getOfflineQueue();
  if (queue.length === 0) return 0;

  let syncedCount = 0;
  const remainingQueue: AttendanceRecord[] = [];

  for (const item of queue) {
    try {
      const syncedItem = { ...item, syncedOffline: false };
      await setDoc(doc(db, ATTENDANCE_COLLECTION, item.id), syncedItem);
      syncedCount++;
    } catch (e) {
      remainingQueue.push(item);
    }
  }

  saveOfflineQueue(remainingQueue);
  saveLocalAttendance(
    mergeAttendanceRecords(
      readLocalAttendance().map((record) =>
        queue.some((item) => item.id === record.id && !remainingQueue.some((pending) => pending.id === item.id))
          ? { ...record, syncedOffline: false }
          : record,
      ),
    ),
  );
  return syncedCount;
}

// -------------------------------------------------------------
// Parent Alert Email Trigger
// -------------------------------------------------------------
export async function sendParentAbsentAlert(
  student: Student,
  date: string,
  reason: string = "Physical Absence Logged"
): Promise<{ success: boolean; alert?: ParentAlert }> {
  try {
    const res = await fetch("/api/send-parent-alert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentName: student.name,
        rollNumber: student.rollNumber,
        className: student.className,
        parentEmail: student.parentEmail,
        date,
        reason,
      }),
    });

    const data = await res.json().catch(() => ({}));

    const alertRecord: ParentAlert = {
      id: `alert-${Date.now()}`,
      studentId: student.id,
      studentName: student.name,
      parentEmail: student.parentEmail,
      date,
      status: data.success ? "sent" : "failed",
      sentAt: new Date().toISOString(),
      message: data.preview || `Alert dispatched to ${student.parentEmail}`,
    };

    // Save alert log to Firestore
    try {
      await setDoc(doc(db, ALERTS_COLLECTION, alertRecord.id), alertRecord);
    } catch (err) {}

    return { success: Boolean(data.success), alert: alertRecord };
  } catch (error) {
    console.error("Failed to send parent alert:", error);
    return { success: false };
  }
}

// Helper to safely prepare student face images for AI multi-modal comparison
export async function ensureRasterStudentImages(students: Student[]): Promise<Student[]> {
  if (typeof window === "undefined") return students;

  try {
    const processed = await Promise.all(
      students.map(async (student) => {
        const rawUrl = student.faceImageDataUrl || "";
        if (!rawUrl || (!rawUrl.includes("image/svg") && !rawUrl.includes("<svg"))) {
          return student;
        }

        try {
          const rasterJpeg = await new Promise<string>((resolve) => {
            const timeout = setTimeout(() => resolve(rawUrl), 600);
            try {
              const img = new Image();
              img.crossOrigin = "anonymous";
              img.onload = () => {
                clearTimeout(timeout);
                try {
                  const canvas = document.createElement("canvas");
                  canvas.width = 240;
                  canvas.height = 240;
                  const ctx = canvas.getContext("2d");
                  if (ctx) {
                    ctx.fillStyle = "#1e293b";
                    ctx.fillRect(0, 0, 240, 240);
                    ctx.drawImage(img, 0, 0, 240, 240);
                    resolve(canvas.toDataURL("image/jpeg", 0.8));
                  } else {
                    resolve(rawUrl);
                  }
                } catch {
                  resolve(rawUrl);
                }
              };
              img.onerror = () => {
                clearTimeout(timeout);
                resolve(rawUrl);
              };
              img.src = rawUrl;
            } catch {
              clearTimeout(timeout);
              resolve(rawUrl);
            }
          });

          return { ...student, faceImageDataUrl: rasterJpeg };
        } catch {
          return student;
        }
      })
    );
    return processed;
  } catch {
    return students;
  }
}

// -------------------------------------------------------------
// Facial Recognition Scanner API Client
// -------------------------------------------------------------
export async function runFacialScan(
  captureBase64: string,
  candidateStudents: Student[]
): Promise<FacialRecognitionResult> {
  return recognizeFaceFromDataUrl(captureBase64, candidateStudents);
}

// -------------------------------------------------------------
// Geolocation Physical Presence Verification API Client
// -------------------------------------------------------------
export async function verifyClassroomLocation(
  userLat: number,
  userLng: number,
  classRoom: Classroom
): Promise<ClassroomVerificationResult> {
  const earthRadiusMeters = 6371e3;
  const lat1 = (userLat * Math.PI) / 180;
  const lat2 = (classRoom.latitude * Math.PI) / 180;
  const deltaLat = ((classRoom.latitude - userLat) * Math.PI) / 180;
  const deltaLng = ((classRoom.longitude - userLng) * Math.PI) / 180;
  const haversine =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
  const distanceMeters = earthRadiusMeters * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
  const roundedDistance = Math.round(distanceMeters * 10) / 10;
  const isPresentInClassroom = distanceMeters <= classRoom.radiusMeters;

  return {
    isPresentInClassroom,
    distanceMeters: roundedDistance,
    maxRadiusMeters: classRoom.radiusMeters,
    message: isPresentInClassroom
      ? `Location verified within classroom boundary (${Math.round(distanceMeters)}m away).`
      : `Outside classroom boundary (${Math.round(distanceMeters)}m away; ${classRoom.radiusMeters}m allowed).`,
  };
}
