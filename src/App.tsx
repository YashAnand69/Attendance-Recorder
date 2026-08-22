/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from "react";
import { Student, Classroom, AttendanceRecord } from "./types";
import {
  fetchStudents,
  subscribeToAttendance,
  seedInitialDataIfNeeded,
  getOfflineQueue,
  syncOfflineQueueToCloud,
} from "./lib/attendanceStore";
import { DEFAULT_CLASSROOM } from "./lib/mockData";
import { Header } from "./components/Header";
import { CameraScanner } from "./components/CameraScanner";
import { Dashboard } from "./components/Dashboard";
import { StudentManagement } from "./components/StudentManagement";
import { ReportsAnalytics } from "./components/ReportsAnalytics";
import { LocationConfigModal } from "./components/LocationConfigModal";
import { AdminLoginModal } from "./components/AdminLoginModal";
import { ShieldCheck, Lock, Unlock, LogOut } from "lucide-react";

export default function App() {
  const [activeTab, setActiveTab] = useState<"scanner" | "dashboard" | "students" | "reports">("scanner");
  const [students, setStudents] = useState<Student[]>([]);
  const [classroom, setClassroom] = useState<Classroom>(DEFAULT_CLASSROOM);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split("T")[0]);

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
      await seedInitialDataIfNeeded();
      const loadedStudents = await fetchStudents();
      setStudents(loadedStudents);
      refreshOfflineQueueCount();
    };

    initApp();
  }, [refreshOfflineQueueCount]);

  // Subscribe to real-time attendance logs for selected date
  useEffect(() => {
    const unsubscribe = subscribeToAttendance(selectedDate, (newRecords) => {
      setRecords(newRecords);
      refreshOfflineQueueCount();
    });

    return () => unsubscribe();
  }, [selectedDate, refreshOfflineQueueCount]);

  // Sync Offline Queue manually
  const handleSyncOfflineQueue = async () => {
    const syncedCount = await syncOfflineQueueToCloud();
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white">
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
      />

      {/* Admin Mode Bar Banner if Unlocked */}
      {isAdminUnlocked && (
        <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-indigo-950 border-b border-emerald-500/30 px-4 py-2 text-xs">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-2 text-emerald-300 font-medium">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Admin Portal Authenticated &amp; Active</span>
              <span className="hidden sm:inline text-slate-400">| Full Administrative Controls Unlocked</span>
            </div>
            <button
              onClick={handleLockAdmin}
              className="flex items-center space-x-1 px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-500/30 rounded-lg text-[11px] font-semibold transition-all cursor-pointer"
            >
              <LogOut className="w-3 h-3" />
              <span>Lock Portal</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Container Viewport */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
      </main>

      {/* Admin Login Modal */}
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
        onSaveClassroom={(updatedClassroom) => setClassroom(updatedClassroom)}
      />
    </div>
  );
}
