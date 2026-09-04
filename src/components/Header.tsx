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
    <header className="glass-panel border-b border-slate-200/80 sticky top-0 z-40 shadow-xs backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand & Mode */}
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-slate-950 flex items-center justify-center text-white shadow-sm ring-1 ring-slate-800/80 relative group">
              <ShieldCheck className="w-5 h-5 text-emerald-400 group-hover:scale-110 transition-transform" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-slate-950 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-base tracking-tight text-slate-900 font-display">
                  Smart Attendance
                </span>
                <span
                  className={`text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full border ${
                    isAdminUnlocked
                      ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                      : "bg-slate-100 text-slate-700 border-slate-200"
                  }`}
                >
                  {isAdminUnlocked ? "Admin Mode" : "Kiosk Active"}
                </span>
              </div>
              <div className="flex items-center space-x-2 text-[11px] text-slate-500">
                <span className="hidden sm:inline font-medium">Biometric Intelligence</span>
                <span className="hidden sm:inline text-slate-300">•</span>
                <span className="font-mono text-slate-600 font-semibold flex items-center space-x-1">
                  <ClockIcon className="w-3 h-3 text-slate-400 inline" />
                  <span>{currentDate} {currentTime}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Segment Tabs */}
          <nav className="hidden md:flex items-center bg-slate-100/90 p-1 rounded-xl border border-slate-200/80 shadow-inner">
            <button
              onClick={() => onSelectTab("scanner")}
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === "scanner"
                  ? "bg-white text-slate-950 shadow-xs ring-1 ring-slate-200/90"
                  : "text-slate-600 hover:text-slate-950"
              }`}
            >
              <Camera className="w-3.5 h-3.5 text-slate-700" />
              <span>Scanner HUD</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
            </button>

            <button
              onClick={() => onSelectTab("dashboard")}
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === "dashboard"
                  ? "bg-white text-slate-950 shadow-xs ring-1 ring-slate-200/90"
                  : "text-slate-600 hover:text-slate-950"
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5 text-slate-700" />
              <span>Dashboard</span>
              {!isAdminUnlocked && <Lock className="w-3 h-3 text-slate-400 ml-0.5" />}
            </button>

            <button
              onClick={() => onSelectTab("students")}
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === "students"
                  ? "bg-white text-slate-950 shadow-xs ring-1 ring-slate-200/90"
                  : "text-slate-600 hover:text-slate-950"
              }`}
            >
              <Users className="w-3.5 h-3.5 text-slate-700" />
              <span>Roster</span>
              {totalStudentsCount > 0 && (
                <span className="text-[10px] bg-slate-200 text-slate-800 font-mono px-1.5 py-0.2 rounded-full font-bold">
                  {totalStudentsCount}
                </span>
              )}
              {!isAdminUnlocked && <Lock className="w-3 h-3 text-slate-400 ml-0.5" />}
            </button>

            <button
              onClick={() => onSelectTab("reports")}
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === "reports"
                  ? "bg-white text-slate-950 shadow-xs ring-1 ring-slate-200/90"
                  : "text-slate-600 hover:text-slate-950"
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-slate-700" />
              <span>Analytics & AI</span>
              {!isAdminUnlocked && <Lock className="w-3 h-3 text-slate-400 ml-0.5" />}
            </button>
          </nav>

          {/* Right Status Actions */}
          <div className="flex items-center space-x-2">
            {/* Audio Feedback Toggle */}
            <button
              onClick={handleToggleSound}
              className={`p-2 rounded-xl border text-xs transition-colors cursor-pointer ${
                soundEnabled
                  ? "bg-emerald-50/60 border-emerald-200 text-emerald-800 hover:bg-emerald-100"
                  : "bg-slate-100 border-slate-200 text-slate-400 hover:text-slate-600"
              }`}
              title={soundEnabled ? "Audio Chime Enabled" : "Audio Chime Muted"}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-600" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* Geofence location shortcut */}
            <button
              onClick={onOpenLocationModal}
              className="hidden lg:flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs text-slate-700 transition-colors cursor-pointer shadow-2xs"
              title="Classroom Geofence Settings"
            >
              <MapPin className="w-3.5 h-3.5 text-emerald-600" />
              <span className="truncate max-w-[130px] font-semibold">{classroomName}</span>
            </button>

            {/* Sync / Connectivity status */}
            <div className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white/90 text-xs shadow-2xs">
              {isOnline ? (
                <div className="flex items-center space-x-1.5 text-emerald-700 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="hidden sm:inline">Online</span>
                </div>
              ) : (
                <div className="flex items-center space-x-1.5 text-amber-700 font-semibold">
                  <WifiOff className="w-3.5 h-3.5 text-amber-600" />
                  <span className="hidden sm:inline">Offline</span>
                </div>
              )}

              {offlineQueueCount > 0 && (
                <button
                  onClick={onSyncOfflineQueue}
                  className="ml-1 px-1.5 py-0.5 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded text-[10px] font-bold transition-colors cursor-pointer"
                >
                  Sync ({offlineQueueCount})
                </button>
              )}
            </div>

            {/* Admin Lock / Unlock Button */}
            {isAdminUnlocked ? (
              <button
                onClick={onLockAdmin}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold shadow-2xs transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden sm:inline">Lock</span>
              </button>
            ) : (
              <button
                onClick={onOpenAdminModal}
                className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-white text-xs font-bold shadow-sm transition-colors cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5 text-slate-300" />
                <span>Admin Login</span>
              </button>
            )}
          </div>
        </div>

        {/* Mobile Tab Navigation Strip */}
        <div className="flex md:hidden items-center justify-between border-t border-slate-200/70 py-2">
          <button
            onClick={() => onSelectTab("scanner")}
            className={`flex-1 py-1.5 text-center text-xs font-bold ${
              activeTab === "scanner" ? "text-slate-950 bg-slate-100 rounded-md" : "text-slate-500"
            }`}
          >
            Scanner
          </button>
          <button
            onClick={() => onSelectTab("dashboard")}
            className={`flex-1 py-1.5 text-center text-xs font-bold ${
              activeTab === "dashboard" ? "text-slate-950 bg-slate-100 rounded-md" : "text-slate-500"
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => onSelectTab("students")}
            className={`flex-1 py-1.5 text-center text-xs font-bold ${
              activeTab === "students" ? "text-slate-950 bg-slate-100 rounded-md" : "text-slate-500"
            }`}
          >
            Roster
          </button>
          <button
            onClick={() => onSelectTab("reports")}
            className={`flex-1 py-1.5 text-center text-xs font-bold ${
              activeTab === "reports" ? "text-slate-950 bg-slate-100 rounded-md" : "text-slate-500"
            }`}
          >
            Reports
          </button>
        </div>
      </div>
    </header>
  );
};

