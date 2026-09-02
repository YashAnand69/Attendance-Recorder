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

const STUDENTS_COLLECTION = "students";
const CLASSROOMS_COLLECTION = "classrooms";
const ATTENDANCE_COLLECTION = "attendance_logs";
const ALERTS_COLLECTION = "parent_alerts";

const LOCAL_STORAGE_OFFLINE_QUEUE_KEY = "smart_attendance_offline_queue_v1";
const LOCAL_STORAGE_STUDENTS_KEY = "smart_attendance_students_cache_v2";

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
    const querySnapshot = await getDocs(collection(db, STUDENTS_COLLECTION));
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
        const combined = [...records];
        offlineQueue.forEach((offRec) => {
          if (!combined.some((c) => c.id === offRec.id)) {
            combined.push(offRec);
          }
        });

        callback(combined);
      },
      (error) => {
        console.warn("Real-time listener offline mode:", error);
        callback(INITIAL_ATTENDANCE_RECORDS);
      }
    );
  } catch (e) {
    callback(INITIAL_ATTENDANCE_RECORDS);
    return () => {};
  }
}

export async function logAttendanceRecord(record: Omit<AttendanceRecord, "id" | "syncedOffline">): Promise<AttendanceRecord> {
  const newId = `att-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const isOnline = navigator.onLine;

  const fullRecord: AttendanceRecord = {
    ...record,
    id: newId,
    syncedOffline: !isOnline,
  };

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

    const data = await res.json();

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

    return { success: data.success, alert: alertRecord };
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
  const rasterizedCandidates = await ensureRasterStudentImages(candidateStudents);

  const res = await fetch("/api/facial-recognition", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      captureBase64,
      studentsCandidates: rasterizedCandidates,
    }),
  });

  if (!res.ok) {
    const errData = await res.json();
    throw new Error(errData.error || "Facial recognition service unavailable.");
  }

  const data = await res.json();
  return data.result;
}

// -------------------------------------------------------------
// Geolocation Physical Presence Verification API Client
// -------------------------------------------------------------
export async function verifyClassroomLocation(
  userLat: number,
  userLng: number,
  classRoom: Classroom
): Promise<ClassroomVerificationResult> {
  const res = await fetch("/api/verify-classroom-location", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userLat,
      userLng,
      classLat: classRoom.latitude,
      classLng: classRoom.longitude,
      maxRadiusMeters: classRoom.radiusMeters,
    }),
  });

  if (!res.ok) {
    const errData = await res.json();
    throw new Error(errData.error || "Location verification service unavailable.");
  }

  return await res.json();
}
