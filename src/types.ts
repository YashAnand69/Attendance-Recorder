export interface Student {
  id: string;
  name: string;
  rollNumber: string;
  className: string;
  parentEmail: string;
  parentPhone: string;
  faceImageDataUrl: string;
  status: "active" | "inactive";
  createdAt: string;
}

export interface Classroom {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  teacherName: string;
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  studentName: string;
  rollNumber: string;
  className: string;
  date: string; // YYYY-MM-DD
  timestamp: string;
  status: "present" | "absent" | "late";
  confidence: number;
  latitude: number;
  longitude: number;
  verificationMethod: "face_recognition" | "manual";
  syncedOffline: boolean;
  snapshotUrl?: string;
  notes?: string;
}

export interface ParentAlert {
  id: string;
  studentId: string;
  studentName: string;
  parentEmail: string;
  date: string;
  status: "sent" | "failed" | "pending";
  sentAt: string;
  message: string;
}

export interface FacialRecognitionResult {
  matched: boolean;
  confidence: number;
  studentId?: string;
  studentName?: string;
  rollNumber?: string;
  className?: string;
  boundingBox?: number[];
  verificationNotes?: string;
}

export interface ClassroomVerificationResult {
  isPresentInClassroom: boolean;
  distanceMeters: number;
  maxRadiusMeters: number;
  message: string;
}

export interface AiAttendanceInsights {
  overallAttendancePercentage: number;
  lowAttendanceStudents?: Array<{
    studentName: string;
    percentage: number;
    totalClasses: number;
    presentCount: number;
    status: "At Risk" | "Critical";
  }>;
  keyInsights: string[];
  administrativeActionItems: string[];
  peakArrivalPattern?: string;
  attendanceForecast?: string;
}

