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

// Safe Base64 SVG Face Avatar Generator
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
  try {
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  } catch (e) {
    return `data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIj48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0iIzFlMjl4YiIvPjwvc3ZnPg==`;
  }
}

export const INITIAL_STUDENTS: Student[] = [
  {
    id: "stu-001",
    name: "Alex Rivera",
    rollNumber: "CS2026-001",
    className: "CS-301 Computer Science Lab",
    parentEmail: "parent.alex@example.com",
    parentPhone: "+1 (555) 234-5678",
    faceImageDataUrl: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400&auto=format&fit=crop&q=80",
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
    faceImageDataUrl: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&auto=format&fit=crop&q=80",
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
    faceImageDataUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80",
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
    faceImageDataUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&auto=format&fit=crop&q=80",
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
    faceImageDataUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&auto=format&fit=crop&q=80",
    status: "active",
    createdAt: "2026-08-01T08:00:00Z",
  },
  {
    id: "stu-006",
    name: "Amina Al-Mansoor",
    rollNumber: "CS2026-006",
    className: "CS-301 Computer Science Lab",
    parentEmail: "parent.amina@example.com",
    parentPhone: "+1 (555) 432-1098",
    faceImageDataUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80",
    status: "active",
    createdAt: "2026-08-01T08:00:00Z",
  },
  {
    id: "stu-007",
    name: "Liam O'Connor",
    rollNumber: "CS2026-007",
    className: "CS-301 Computer Science Lab",
    parentEmail: "parent.liam@example.com",
    parentPhone: "+1 (555) 567-8901",
    faceImageDataUrl: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=400&auto=format&fit=crop&q=80",
    status: "active",
    createdAt: "2026-08-01T08:00:00Z",
  },
  {
    id: "stu-008",
    name: "Zoe Washington",
    rollNumber: "CS2026-008",
    className: "CS-301 Computer Science Lab",
    parentEmail: "parent.zoe@example.com",
    parentPhone: "+1 (555) 654-3210",
    faceImageDataUrl: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&auto=format&fit=crop&q=80",
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
    timestamp: "08:42 AM",
    status: "present",
    confidence: 98.4,
    latitude: 37.7749,
    longitude: -122.4194,
    verificationMethod: "face_recognition",
    syncedOffline: false,
    snapshotUrl: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400&auto=format&fit=crop&q=80",
  },
  {
    id: "att-102",
    studentId: "stu-002",
    studentName: "Sophia Chen",
    rollNumber: "CS2026-002",
    className: "CS-301 Computer Science Lab",
    date: new Date().toISOString().split("T")[0],
    timestamp: "08:45 AM",
    status: "present",
    confidence: 96.1,
    latitude: 37.7749,
    longitude: -122.4194,
    verificationMethod: "face_recognition",
    syncedOffline: false,
    snapshotUrl: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&auto=format&fit=crop&q=80",
  },
  {
    id: "att-103",
    studentId: "stu-003",
    studentName: "Marcus Vance",
    rollNumber: "CS2026-003",
    className: "CS-301 Computer Science Lab",
    date: new Date().toISOString().split("T")[0],
    timestamp: "09:12 AM",
    status: "late",
    confidence: 94.7,
    latitude: 37.7749,
    longitude: -122.4194,
    verificationMethod: "face_recognition",
    syncedOffline: false,
    snapshotUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80",
  },
  {
    id: "att-104",
    studentId: "stu-006",
    studentName: "Amina Al-Mansoor",
    rollNumber: "CS2026-006",
    className: "CS-301 Computer Science Lab",
    date: new Date().toISOString().split("T")[0],
    timestamp: "08:50 AM",
    status: "present",
    confidence: 99.1,
    latitude: 37.7749,
    longitude: -122.4194,
    verificationMethod: "face_recognition",
    syncedOffline: false,
    snapshotUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80",
  },
];
