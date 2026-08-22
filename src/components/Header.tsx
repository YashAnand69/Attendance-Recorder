import React from "react";
import { Camera, LayoutDashboard, UserPlus, FileSpreadsheet, MapPin, Wifi, WifiOff, ShieldCheck, Lock, Unlock, LogOut, ShieldAlert } from "lucide-react";

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
}) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-40 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between py-3 gap-3 md:gap-0">
          {/* Brand Logo & Admin Mode Status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-blue-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <ShieldCheck className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h1 className="text-lg font-bold tracking-tight text-white leading-none">
                    Smart Attendance AI
                  </h1>
                  {isAdminUnlocked ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center space-x-1">
                      <Unlock className="w-2.5 h-2.5" />
                      <span>Admin Mode</span>
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      Kiosk Mode
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Facial Recognition &amp; Geofenced Attendance System
                </p>
              </div>
            </div>

            {/* Mobile Admin Portal Button */}
            <div className="md:hidden">
              {isAdminUnlocked ? (
                <button
                  onClick={onLockAdmin}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 rounded-lg text-xs font-semibold"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Exit Admin</span>
                </button>
              ) : (
                <button
                  onClick={onOpenAdminModal}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-md shadow-indigo-600/30"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Admin Portal</span>
                </button>
              )}
            </div>
          </div>

          {/* Controls & Nav */}
          <div className="flex items-center space-x-3 justify-between md:justify-end">
            {/* Location & Classroom Context */}
            <div className="hidden lg:flex items-center space-x-3">
              <button
                onClick={onOpenLocationModal}
                className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-xs text-slate-300 transition-colors"
                title="Click to configure classroom geolocation boundary"
              >
                <MapPin className="w-3.5 h-3.5 text-indigo-400" />
                <span className="font-medium truncate max-w-[160px]">{classroomName}</span>
              </button>

              {/* Network Offline / Online Indicator */}
              <div className="flex items-center space-x-2 px-2.5 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60 text-xs">
                {isOnline ? (
                  <div className="flex items-center space-x-1.5 text-emerald-400">
                    <Wifi className="w-3.5 h-3.5" />
                    <span className="font-medium">Cloud Synced</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-1.5 text-amber-400">
                    <WifiOff className="w-3.5 h-3.5" />
                    <span className="font-medium">Offline Cache</span>
                  </div>
                )}

                {offlineQueueCount > 0 && (
                  <button
                    onClick={onSyncOfflineQueue}
                    className="ml-1 px-2 py-0.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded text-[11px] font-semibold transition-colors"
                  >
                    Sync ({offlineQueueCount})
                  </button>
                )}
              </div>
            </div>

            {/* Navigation Tabs */}
            <nav className="flex items-center space-x-1 bg-slate-800/90 p-1 rounded-xl border border-slate-700">
              <button
                onClick={() => onSelectTab("scanner")}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === "scanner"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-300 hover:text-white hover:bg-slate-700/50"
                }`}
              >
                <Camera className="w-4 h-4" />
                <span className="inline">AI Scanner</span>
              </button>

              <button
                onClick={() => onSelectTab("dashboard")}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === "dashboard"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-300 hover:text-white hover:bg-slate-700/50"
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                <span className="hidden sm:inline">Dashboard</span>
                {!isAdminUnlocked && <Lock className="w-3 h-3 text-slate-400 ml-0.5" />}
              </button>

              <button
                onClick={() => onSelectTab("students")}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === "students"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-300 hover:text-white hover:bg-slate-700/50"
                }`}
              >
                <UserPlus className="w-4 h-4" />
                <span className="hidden sm:inline">Students</span>
                {!isAdminUnlocked && <Lock className="w-3 h-3 text-slate-400 ml-0.5" />}
              </button>

              <button
                onClick={() => onSelectTab("reports")}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === "reports"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-300 hover:text-white hover:bg-slate-700/50"
                }`}
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span className="hidden sm:inline">Reports</span>
                {!isAdminUnlocked && <Lock className="w-3 h-3 text-slate-400 ml-0.5" />}
              </button>
            </nav>

            {/* Desktop Admin Portal Action Button */}
            <div className="hidden md:block">
              {isAdminUnlocked ? (
                <button
                  onClick={onLockAdmin}
                  className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                  title="Lock Admin Portal & Return to Kiosk Mode"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Exit Admin</span>
                </button>
              ) : (
                <button
                  onClick={onOpenAdminModal}
                  className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Admin Portal</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
