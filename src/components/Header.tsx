import React from "react";
import { Camera, LayoutDashboard, Users, FileSpreadsheet, MapPin, Wifi, WifiOff, Lock, Unlock, LogOut, ShieldCheck } from "lucide-react";

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
    <header className="bg-white border-b border-zinc-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand & Mode */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-lg bg-zinc-900 flex items-center justify-center text-white">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-semibold text-sm tracking-tight text-zinc-900">
                    Smart Attendance
                  </span>
                  <span
                    className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                      isAdminUnlocked
                        ? "bg-zinc-100 text-zinc-800 border-zinc-300"
                        : "bg-zinc-50 text-zinc-600 border-zinc-200"
                    }`}
                  >
                    {isAdminUnlocked ? "Admin Mode" : "Kiosk Mode"}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500 hidden sm:block">
                  Facial Recognition &amp; Geofenced Attendance
                </p>
              </div>
            </div>
          </div>

          {/* Navigation Segment Tabs */}
          <nav className="hidden md:flex items-center bg-zinc-100 p-1 rounded-lg border border-zinc-200/80">
            <button
              onClick={() => onSelectTab("scanner")}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                activeTab === "scanner"
                  ? "bg-white text-zinc-900 shadow-xs"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>AI Scanner</span>
            </button>

            <button
              onClick={() => onSelectTab("dashboard")}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                activeTab === "dashboard"
                  ? "bg-white text-zinc-900 shadow-xs"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Dashboard</span>
              {!isAdminUnlocked && <Lock className="w-3 h-3 text-zinc-400 ml-0.5" />}
            </button>

            <button
              onClick={() => onSelectTab("students")}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                activeTab === "students"
                  ? "bg-white text-zinc-900 shadow-xs"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Students</span>
              {!isAdminUnlocked && <Lock className="w-3 h-3 text-zinc-400 ml-0.5" />}
            </button>

            <button
              onClick={() => onSelectTab("reports")}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                activeTab === "reports"
                  ? "bg-white text-zinc-900 shadow-xs"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Reports</span>
              {!isAdminUnlocked && <Lock className="w-3 h-3 text-zinc-400 ml-0.5" />}
            </button>
          </nav>

          {/* Right Status Actions */}
          <div className="flex items-center space-x-2.5">
            {/* Geofence location shortcut */}
            <button
              onClick={onOpenLocationModal}
              className="hidden lg:flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border border-zinc-200 text-xs text-zinc-700 hover:bg-zinc-50 transition-colors"
              title="Classroom Geofence Settings"
            >
              <MapPin className="w-3.5 h-3.5 text-zinc-500" />
              <span className="truncate max-w-[130px] font-medium">{classroomName}</span>
            </button>

            {/* Sync / Connectivity status */}
            <div className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border border-zinc-200 bg-zinc-50/50 text-xs">
              {isOnline ? (
                <div className="flex items-center space-x-1.5 text-emerald-700 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
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
                  className="ml-1 px-1.5 py-0.5 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded text-[10px] font-semibold transition-colors"
                >
                  Sync ({offlineQueueCount})
                </button>
              )}
            </div>

            {/* Admin Lock / Unlock Button */}
            {isAdminUnlocked ? (
              <button
                onClick={onLockAdmin}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 text-xs font-medium transition-colors"
              >
                <LogOut className="w-3.5 h-3.5 text-zinc-500" />
                <span className="hidden sm:inline">Exit Admin</span>
              </button>
            ) : (
              <button
                onClick={onOpenAdminModal}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium shadow-xs transition-colors"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Admin Login</span>
              </button>
            )}
          </div>
        </div>

        {/* Mobile Tab Navigation Strip */}
        <div className="flex md:hidden items-center justify-between border-t border-zinc-100 py-2">
          <button
            onClick={() => onSelectTab("scanner")}
            className={`flex-1 py-1 text-center text-xs font-medium ${
              activeTab === "scanner" ? "text-zinc-900 font-semibold" : "text-zinc-500"
            }`}
          >
            Scanner
          </button>
          <button
            onClick={() => onSelectTab("dashboard")}
            className={`flex-1 py-1 text-center text-xs font-medium ${
              activeTab === "dashboard" ? "text-zinc-900 font-semibold" : "text-zinc-500"
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => onSelectTab("students")}
            className={`flex-1 py-1 text-center text-xs font-medium ${
              activeTab === "students" ? "text-zinc-900 font-semibold" : "text-zinc-500"
            }`}
          >
            Students
          </button>
          <button
            onClick={() => onSelectTab("reports")}
            className={`flex-1 py-1 text-center text-xs font-medium ${
              activeTab === "reports" ? "text-zinc-900 font-semibold" : "text-zinc-500"
            }`}
          >
            Reports
          </button>
        </div>
      </div>
    </header>
  );
};
