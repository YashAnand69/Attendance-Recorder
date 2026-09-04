import React, { useState, useEffect } from "react";
import {
  Camera,
  LayoutDashboard,
  Users,
  FileSpreadsheet,
  MapPin,
  Wifi,
  WifiOff,
  Lock,
  LogOut,
  ShieldCheck,
  Volume2,
  VolumeX,
  Clock as ClockIcon,
  Sparkles,
} from "lucide-react";
import { audioFeedback } from "../lib/audio";

interface HeaderProps {
  activeTab: "scanner" | "dashboard" | "students" | "reports";
  onSelectTab: (tab: "scanner" | "dashboard" | "students" | "reports") => void;
  isOnline: boolean;
  offlineQueueCount: number;
  onSyncOfflineQueue: () => void;
  onOpenLocationModal: () => void;
  classroomName: string;
  isAdminUnlocked: boolean;
  onOpenAdminModal: () => void;
  onLockAdmin: () => void;
  totalStudentsCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onSelectTab,
  isOnline,
  offlineQueueCount,
  onSyncOfflineQueue,
  onOpenLocationModal,
  classroomName,
  isAdminUnlocked,
  onOpenAdminModal,
  onLockAdmin,
  totalStudentsCount = 0,
}) => {
  const [currentTime, setCurrentTime] = useState<string>("");
  const [currentDate, setCurrentDate] = useState<string>("");
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => audioFeedback.isSoundEnabled());

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        })
      );
      setCurrentDate(
        now.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        })
      );
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    audioFeedback.setSoundEnabled(next);
    if (next) {
      audioFeedback.playSuccessChime();
    }
  };

  return (
    <header className="bg-white/95 backdrop-blur-md border-b border-zinc-200/90 sticky top-0 z-40 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand & Mode */}
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-zinc-950 flex items-center justify-center text-white shadow-xs ring-1 ring-zinc-800/60">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-sm tracking-tight text-zinc-900">
                  Smart Attendance
                </span>
                <span
                  className={`text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full border ${
                    isAdminUnlocked
                      ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                      : "bg-zinc-100 text-zinc-700 border-zinc-200"
                  }`}
                >
                  {isAdminUnlocked ? "Admin Unlocked" : "Kiosk Mode"}
                </span>
              </div>
              <div className="flex items-center space-x-2 text-[11px] text-zinc-500">
                <span className="hidden sm:inline">AI Facial Recognition</span>
                <span className="hidden sm:inline text-zinc-300">•</span>
                <span className="font-mono text-zinc-600 font-medium">
                  {currentDate} {currentTime}
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Segment Tabs */}
          <nav className="hidden md:flex items-center bg-zinc-100/90 p-1 rounded-xl border border-zinc-200">
            <button
              onClick={() => onSelectTab("scanner")}
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "scanner"
                  ? "bg-white text-zinc-950 shadow-xs ring-1 ring-zinc-200"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              <Camera className="w-3.5 h-3.5 text-zinc-700" />
              <span>AI Scanner</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            </button>

            <button
              onClick={() => onSelectTab("dashboard")}
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "dashboard"
                  ? "bg-white text-zinc-950 shadow-xs ring-1 ring-zinc-200"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5 text-zinc-700" />
              <span>Dashboard</span>
              {!isAdminUnlocked && <Lock className="w-3 h-3 text-zinc-400 ml-0.5" />}
            </button>

            <button
              onClick={() => onSelectTab("students")}
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "students"
                  ? "bg-white text-zinc-950 shadow-xs ring-1 ring-zinc-200"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              <Users className="w-3.5 h-3.5 text-zinc-700" />
              <span>Students</span>
              {totalStudentsCount > 0 && (
                <span className="text-[10px] bg-zinc-200 text-zinc-700 font-mono px-1.5 py-0.2 rounded-full">
                  {totalStudentsCount}
                </span>
              )}
              {!isAdminUnlocked && <Lock className="w-3 h-3 text-zinc-400 ml-0.5" />}
            </button>

            <button
              onClick={() => onSelectTab("reports")}
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "reports"
                  ? "bg-white text-zinc-950 shadow-xs ring-1 ring-zinc-200"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-zinc-700" />
              <span>Reports</span>
              {!isAdminUnlocked && <Lock className="w-3 h-3 text-zinc-400 ml-0.5" />}
            </button>
          </nav>

          {/* Right Status Actions */}
          <div className="flex items-center space-x-2">
            {/* Audio Feedback Toggle */}
            <button
              onClick={handleToggleSound}
              className={`p-2 rounded-lg border text-xs transition-colors cursor-pointer ${
                soundEnabled
                  ? "bg-zinc-50 border-zinc-200 text-zinc-700 hover:bg-zinc-100"
                  : "bg-zinc-100 border-zinc-200 text-zinc-400 hover:text-zinc-600"
              }`}
              title={soundEnabled ? "Audio Chime Enabled" : "Audio Chime Muted"}
            >
              {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-emerald-600" /> : <VolumeX className="w-3.5 h-3.5" />}
            </button>

            {/* Geofence location shortcut */}
            <button
              onClick={onOpenLocationModal}
              className="hidden lg:flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border border-zinc-200 text-xs text-zinc-700 hover:bg-zinc-50 transition-colors cursor-pointer"
              title="Classroom Geofence Settings"
            >
              <MapPin className="w-3.5 h-3.5 text-emerald-600" />
              <span className="truncate max-w-[130px] font-medium">{classroomName}</span>
            </button>

            {/* Sync / Connectivity status */}
            <div className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border border-zinc-200 bg-zinc-50/80 text-xs">
              {isOnline ? (
                <div className="flex items-center space-x-1.5 text-emerald-700 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="hidden sm:inline">Online</span>
                </div>
              ) : (
                <div className="flex items-center space-x-1.5 text-amber-700 font-medium">
                  <WifiOff className="w-3 h-3 text-amber-600" />
                  <span className="hidden sm:inline">Offline</span>
                </div>
              )}

              {offlineQueueCount > 0 && (
                <button
                  onClick={onSyncOfflineQueue}
                  className="ml-1 px-1.5 py-0.5 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded text-[10px] font-semibold transition-colors cursor-pointer"
                >
                  Sync ({offlineQueueCount})
                </button>
              )}
            </div>

            {/* Admin Lock / Unlock Button */}
            {isAdminUnlocked ? (
              <button
                onClick={onLockAdmin}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5 text-zinc-500" />
                <span className="hidden sm:inline">Exit Admin</span>
              </button>
            ) : (
              <button
                onClick={onOpenAdminModal}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5 text-zinc-300" />
                <span>Admin Login</span>
              </button>
            )}
          </div>
        </div>

        {/* Mobile Tab Navigation Strip */}
        <div className="flex md:hidden items-center justify-between border-t border-zinc-100 py-2">
          <button
            onClick={() => onSelectTab("scanner")}
            className={`flex-1 py-1.5 text-center text-xs font-semibold ${
              activeTab === "scanner" ? "text-zinc-950 bg-zinc-100 rounded-md" : "text-zinc-500"
            }`}
          >
            Scanner
          </button>
          <button
            onClick={() => onSelectTab("dashboard")}
            className={`flex-1 py-1.5 text-center text-xs font-semibold ${
              activeTab === "dashboard" ? "text-zinc-950 bg-zinc-100 rounded-md" : "text-zinc-500"
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => onSelectTab("students")}
            className={`flex-1 py-1.5 text-center text-xs font-semibold ${
              activeTab === "students" ? "text-zinc-950 bg-zinc-100 rounded-md" : "text-zinc-500"
            }`}
          >
            Students
          </button>
          <button
            onClick={() => onSelectTab("reports")}
            className={`flex-1 py-1.5 text-center text-xs font-semibold ${
              activeTab === "reports" ? "text-zinc-950 bg-zinc-100 rounded-md" : "text-zinc-500"
            }`}
          >
            Reports
          </button>
        </div>
      </div>
    </header>
  );
};

