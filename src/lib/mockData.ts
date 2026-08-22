import { Student, Classroom, AttendanceRecord } from "../types";

// Default classroom (e.g. Science Lab 101)
export const DEFAULT_CLASSROOM: Classroom = {
  id: "class-101",
  name: "CS-301 Computer Science Lab",
  latitude: 37.7749, // Default sample coordinates
  longitude: -122.4194,
  radiusMeters: 50,
  teacherName: "Prof. Sarah Jenkins",
};

// SVG face image generators for initial demo students
function generateAvatarSvgDataUrl(name: string, bgHex: string, accessory: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300">
    <rect width="300" height="300" fill="${bgHex}"/>
    <circle cx="150" cy="110" r="55" fill="#fbd38d"/>
    <ellipse cx="150" cy="240" rx="85" ry="65" fill="#2b6cb0"/>
    <circle cx="130" cy="100" r="6" fill="#2d3748"/>
    <circle cx="170" cy="100" r="6" fill="#2d3748"/>
    <path d="M 130 125 Q 150 140 170 125" stroke="#2d3748" stroke-width="4" fill="none" stroke-linecap="round"/>
    <text x="150" y="280" font-family="sans-serif" font-size="16" font-weight="bold" fill="#ffffff" text-anchor="middle">${name}</text>
  </svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

export const INITIAL_STUDENTS: Student[] = [
  {
    id: "stu-001",
    name: "Alex Rivera",
    rollNumber: "CS2026-001",
    className: "CS-301 Computer Science Lab",
    parentEmail: "parent.alex@example.com",
    parentPhone: "+1 (555) 234-5678",
    faceImageDataUrl: generateAvatarSvgDataUrl("Alex Rivera", "#ebf8ff", "glasses"),
    status: "active",
    createdAt: "2026-08-01T08:00:00Z",
  },
  {
    id: "stu-002",
    name: "Sophia Chen",
    rollNumber: "CS2026-002",
    className: "CS-301 Computer Science Lab",
    parentEmail: "parent.sophia@example.com",
    parentPhone: "+1 (555) 876-5432",
    faceImageDataUrl: generateAvatarSvgDataUrl("Sophia Chen", "#feebc8", "smile"),
    status: "active",
    createdAt: "2026-08-01T08:00:00Z",
  },
  {
    id: "stu-003",
    name: "Marcus Vance",
    rollNumber: "CS2026-003",
    className: "CS-301 Computer Science Lab",
    parentEmail: "parent.marcus@example.com",
    parentPhone: "+1 (555) 345-6789",
    faceImageDataUrl: generateAvatarSvgDataUrl("Marcus Vance", "#e9d8fd", "short-hair"),
    status: "active",
    createdAt: "2026-08-01T08:00:00Z",
  },
  {
    id: "stu-004",
    name: "Elena Rostova",
    rollNumber: "CS2026-004",
    className: "CS-301 Computer Science Lab",
    parentEmail: "parent.elena@example.com",
    parentPhone: "+1 (555) 901-2345",
    faceImageDataUrl: generateAvatarSvgDataUrl("Elena Rostova", "#c6f6d5", "long-hair"),
    status: "active",
    createdAt: "2026-08-01T08:00:00Z",
  },
  {
    id: "stu-005",
    name: "David Kim",
    rollNumber: "CS2026-005",
    className: "CS-301 Computer Science Lab",
    parentEmail: "parent.david@example.com",
    parentPhone: "+1 (555) 678-9012",
    faceImageDataUrl: generateAvatarSvgDataUrl("David Kim", "#fed7d7", "cap"),
    status: "active",
    createdAt: "2026-08-01T08:00:00Z",
  },
];

export const INITIAL_ATTENDANCE_RECORDS: AttendanceRecord[] = [
  {
    id: "att-101",
    studentId: "stu-001",
    studentName: "Alex Rivera",
    rollNumber: "CS2026-001",
    className: "CS-301 Computer Science Lab",
    date: new Date().toISOString().split("T")[0],
    timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    status: "present",
    confidence: 98.4,
    latitude: 37.7749,
    longitude: -122.4194,
    verificationMethod: "face_recognition",
    syncedOffline: false,
  },
  {
    id: "att-102",
    studentId: "stu-002",
    studentName: "Sophia Chen",
    rollNumber: "CS2026-002",
    className: "CS-301 Computer Science Lab",
    date: new Date().toISOString().split("T")[0],
    timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    status: "present",
    confidence: 96.1,
    latitude: 37.7749,
    longitude: -122.4194,
    verificationMethod: "face_recognition",
    syncedOffline: false,
  },
];
