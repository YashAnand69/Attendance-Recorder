/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { lazy, Suspense, useState, useEffect, useCallback } from "react";
import { Student, Classroom, AttendanceRecord } from "./types";
import {
  fetchStudents,
  subscribeToAllAttendance,
  seedInitialDataIfNeeded,
  getOfflineQueue,
  syncOfflineQueueToCloud,
} from "./lib/attendanceStore";
import { DEFAULT_CLASSROOM } from "./lib/mockData";
import { getLocalDateKey } from "./lib/dateUtils";
import { Header } from "./components/Header";
import { LogOut, ShieldCheck } from "lucide-react";

const CameraScanner = lazy(() => import("./components/CameraScanner").then((module) => ({ default: module.CameraScanner })));
const Dashboard = lazy(() => import("./components/Dashboard").then((module) => ({ default: module.Dashboard })));
const StudentManagement = lazy(() => import("./components/StudentManagement").then((module) => ({ default: module.StudentManagement })));
const ReportsAnalytics = lazy(() => import("./components/ReportsAnalytics").then((module) => ({ default: module.ReportsAnalytics })));
const LocationConfigModal = lazy(() => import("./components/LocationConfigModal").then((module) => ({ default: module.LocationConfigModal })));
const AdminLoginModal = lazy(() => import("./components/AdminLoginModal").then((module) => ({ default: module.AdminLoginModal })));

const CLASSROOM_CACHE_KEY = "smart_attendance_classroom_v1";

function getStoredClassroom(): Classroom {
  try {
    const cached = localStorage.getItem(CLASSROOM_CACHE_KEY);
    if (cached) return { ...DEFAULT_CLASSROOM, ...JSON.parse(cached) };
  } catch {
    // Fall through to the safe demo classroom when storage is unavailable.
  }
  return DEFAULT_CLASSROOM;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<"scanner" | "dashboard" | "students" | "reports">("scanner");
  const [students, setStudents] = useState<Student[]>([]);
  const [classroom, setClassroom] = useState<Classroom>(getStoredClassroom);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(getLocalDateKey());
  const [isInitializing, setIsInitializing] = useState(true);

  // Admin Mode & Password Protection State
  const [isAdminUnlocked, setIsAdminUnlocked] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem("smart_attendance_admin_unlocked") === "true";
    } catch (e) {
      return false;
    }
  });
  const [isAdminModalOpen, setIsAdminModalOpen] = useState<boolean>(false);
  const [pendingTab, setPendingTab] = useState<"scanner" | "dashboard" | "students" | "reports" | null>(null);

  // Network & Offline Cache States
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [offlineQueueCount, setOfflineQueueCount] = useState<number>(0);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState<boolean>(false);

  // Handle Tab Switch with Admin Gate
  const handleSelectTab = (tab: "scanner" | "dashboard" | "students" | "reports") => {
    if (tab === "scanner") {
      setActiveTab("scanner");
      return;
    }

    if (isAdminUnlocked) {
      setActiveTab(tab);
    } else {
      setPendingTab(tab);
      setIsAdminModalOpen(true);
    }
  };

  const handleAdminSuccess = () => {
    setIsAdminUnlocked(true);
    try {
      sessionStorage.setItem("smart_attendance_admin_unlocked", "true");
    } catch (e) {}

    setIsAdminModalOpen(false);
    if (pendingTab) {
      setActiveTab(pendingTab);
      setPendingTab(null);
    } else if (activeTab === "scanner") {
      setActiveTab("dashboard");
    }
  };

  const handleLockAdmin = () => {
    setIsAdminUnlocked(false);
    try {
      sessionStorage.removeItem("smart_attendance_admin_unlocked");
    } catch (e) {}
    setActiveTab("scanner");
  };

  // Update offline queue count
  const refreshOfflineQueueCount = useCallback(() => {
    const queue = getOfflineQueue();
    setOfflineQueueCount(queue.length);
  }, []);

  // Handle Online/Offline Status
  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      const count = await syncOfflineQueueToCloud();
      if (count > 0) {
        refreshOfflineQueueCount();
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [refreshOfflineQueueCount]);

  // Load Students and Seed Database
  useEffect(() => {
    const initApp = async () => {
      try {
        // Keep the first paint fast on a slow connection; the local cache is the immediate source of truth.
        await Promise.race([
          seedInitialDataIfNeeded(),
          new Promise((resolve) => setTimeout(resolve, 2200)),
        ]);
        const loadedStudents = await fetchStudents();
        setStudents(loadedStudents);
      } finally {
        refreshOfflineQueueCount();
        setIsInitializing(false);
      }
    };

    initApp();
  }, [refreshOfflineQueueCount]);

  // Subscribe once to the full attendance stream so dashboard and monthly reports stay truthful.
  useEffect(() => {
    const unsubscribe = subscribeToAllAttendance((newRecords) => {
      setRecords(newRecords);
      refreshOfflineQueueCount();
    });

    return () => unsubscribe();
  }, [refreshOfflineQueueCount]);

  // Sync Offline Queue manually
  const handleSyncOfflineQueue = async () => {
    await syncOfflineQueueToCloud();
    refreshOfflineQueueCount();
    // Refresh student records
    const updatedStudents = await fetchStudents();
    setStudents(updatedStudents);
  };

  const handleStudentAdded = (newStudent: Student) => {
    setStudents((prev) => [newStudent, ...prev.filter((s) => s.id !== newStudent.id)]);
  };

  const handleStudentDeleted = (studentId: string) => {
    setStudents((prev) => prev.filter((s) => s.id !== studentId));
  };

  const handleAttendanceLogged = (newRecord: AttendanceRecord) => {
    setRecords((prev) => [newRecord, ...prev.filter((r) => r.id !== newRecord.id)]);
    refreshOfflineQueueCount();
  };

  const handleSaveClassroom = (updatedClassroom: Classroom) => {
    setClassroom(updatedClassroom);
    try {
      localStorage.setItem(CLASSROOM_CACHE_KEY, JSON.stringify(updatedClassroom));
    } catch {
      // Classroom settings still apply for the current session if storage is blocked.
    }
  };

  return (
    <div className="app-shell min-h-screen text-zinc-900 font-sans antialiased selection:bg-slate-900 selection:text-white">
      {/* Application Navigation Bar */}
      <Header
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        isOnline={isOnline}
        offlineQueueCount={offlineQueueCount}
        onSyncOfflineQueue={handleSyncOfflineQueue}
        onOpenLocationModal={() => {
          if (isAdminUnlocked) {
            setIsLocationModalOpen(true);
          } else {
            setIsAdminModalOpen(true);
          }
        }}
        classroomName={classroom.name}
        isAdminUnlocked={isAdminUnlocked}
        onOpenAdminModal={() => setIsAdminModalOpen(true)}
        onLockAdmin={handleLockAdmin}
        totalStudentsCount={students.length}
      />

      {/* Admin Mode Bar Banner if Unlocked */}
      {isAdminUnlocked && (
        <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-1.5 text-xs">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-2 text-emerald-900 font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Admin Mode Active</span>
              <span className="hidden sm:inline text-emerald-700 font-normal">· Full administrative privileges unlocked</span>
            </div>
            <button
              onClick={handleLockAdmin}
              className="flex items-center space-x-1 px-2 py-0.5 bg-white hover:bg-emerald-100/60 text-emerald-800 border border-emerald-300 rounded text-[11px] font-medium transition-colors cursor-pointer"
            >
              <LogOut className="w-3 h-3 text-emerald-600" />
              <span>Lock Admin</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Container Viewport */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {isInitializing && (
          <div className="mb-4 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-600 shadow-sm">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-500" />
            <span>Loading your classroom roster… local mode is ready while cloud sync connects.</span>
          </div>
        )}
        <Suspense fallback={<div className="flex min-h-[360px] items-center justify-center rounded-3xl border border-slate-200 bg-white/70 text-sm text-slate-500 shadow-sm">Loading workspace…</div>}>
          {activeTab === "scanner" && (
            <CameraScanner
              students={students}
              classroom={classroom}
              onAttendanceLogged={handleAttendanceLogged}
              isOnline={isOnline}
            />
          )}

          {activeTab === "dashboard" && (
            <Dashboard
              students={students}
              records={records}
              classroom={classroom}
              isOnline={isOnline}
              offlineQueueCount={offlineQueueCount}
              onSyncOfflineQueue={handleSyncOfflineQueue}
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              onRecordUpdated={() => {
                refreshOfflineQueueCount();
              }}
            />
          )}

          {activeTab === "students" && (
            <StudentManagement
              students={students}
              onStudentAdded={handleStudentAdded}
              onStudentDeleted={handleStudentDeleted}
              className={classroom.name}
            />
          )}

          {activeTab === "reports" && (
            <ReportsAnalytics
              students={students}
              records={records}
              classroom={classroom}
            />
          )}
        </Suspense>
      </main>

      {/* Admin Login Modal */}
      <Suspense fallback={null}>
        <AdminLoginModal
          isOpen={isAdminModalOpen}
          onClose={() => {
            setIsAdminModalOpen(false);
            setPendingTab(null);
          }}
          onSuccess={handleAdminSuccess}
        />

        {/* Classroom Geofence Location Configuration Modal */}
        <LocationConfigModal
          classroom={classroom}
          isOpen={isLocationModalOpen}
          onClose={() => setIsLocationModalOpen(false)}
          onSaveClassroom={handleSaveClassroom}
        />
      </Suspense>
    </div>
  );
}
