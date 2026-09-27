import React, { lazy, Suspense, useEffect, useState } from "react";
import {
  LayoutDashboard,
  ScanFace,
  Users,
  BarChart3,
  Settings2,
  ArrowUpRight,
  Bell,
  RefreshCw,
  LogOut,
  LockKeyhole,
  ChevronRight,
  Menu,
  X,
  Database,
  Download,
  ShieldCheck,
  MapPin,
} from "lucide-react";
import {
  getWorkspace,
  getSyncStatus,
  subscribeWorkspace,
  initializeWorkspace,
  refreshWorkspace,
  syncOfflineQueueToCloud,
  isCloudWorkspace,
  logout,
  saveClassroom,
} from "./lib/attendanceStore";
import { DEFAULT_CLASSROOM } from "./lib/mockData";
import { Overview } from "./components/Overview";
const Scanner = lazy(() =>
  import("./components/CameraScanner").then((m) => ({
    default: m.CameraScanner,
  })),
);
const Roster = lazy(() =>
  import("./components/StudentManagement").then((m) => ({
    default: m.StudentManagement,
  })),
);
const Reports = lazy(() =>
  import("./components/ReportsAnalytics").then((m) => ({
    default: m.ReportsAnalytics,
  })),
);
const Login = lazy(() =>
  import("./components/AdminLoginModal").then((m) => ({
    default: m.AdminLoginModal,
  })),
);
const Location = lazy(() =>
  import("./components/LocationConfigModal").then((m) => ({
    default: m.LocationConfigModal,
  })),
);
type Tab = "overview" | "scanner" | "students" | "reports" | "settings";
const links = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "scanner", label: "Face check-in", icon: ScanFace },
  { id: "students", label: "Students", icon: Users },
  { id: "reports", label: "Reports & insights", icon: BarChart3 },
  { id: "settings", label: "Workspace settings", icon: Settings2 },
] as const;
export default function App() {
  const [tab, setTab] = useState<Tab>("overview");
  const [workspace, setWorkspace] = useState(getWorkspace);
  const [sync, setSync] = useState(getSyncStatus);
  const [loginOpen, setLoginOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const unsubscribe = subscribeWorkspace(() => {
      setWorkspace({ ...getWorkspace() });
      setSync({ ...getSyncStatus() });
    });
    void initializeWorkspace();
    const refresh = () => {
      if (document.visibilityState === "visible") {
        void syncOfflineQueueToCloud().then(refreshWorkspace);
      }
    };
    const interval = setInterval(refresh, 20000);
    const connection = () => {
      setOnline(navigator.onLine);
      if (navigator.onLine) refresh();
    };
    window.addEventListener("online", connection);
    window.addEventListener("offline", connection);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      unsubscribe();
      clearInterval(interval);
      window.removeEventListener("online", connection);
      window.removeEventListener("offline", connection);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  const cloud = sync.mode === "cloud";
  const classroom = workspace.classrooms[0] || DEFAULT_CLASSROOM;
  const navigate = (id: Tab) => {
    setTab(id);
    setMobileOpen(false);
  };
  const downloadBackup = () => {
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            { version: 1, exportedAt: new Date().toISOString(), ...workspace },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download =
      "attendly-backup-" + new Date().toISOString().slice(0, 10) + ".json";
    a.click();
    URL.revokeObjectURL(url);
    setNotice(
      "Backup downloaded. It contains personal information; store it securely.",
    );
  };
  return (
    <div className="workspace">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      {mobileOpen && (
        <button
          className="sidebar-scrim"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside className={"sidebar " + (mobileOpen ? "is-open" : "")}>
        <a
          className="brand"
          href="#overview"
          onClick={() => navigate("overview")}
        >
          <span className="brand-mark">
            <ScanFace size={25} />
          </span>
          attendly<span className="brand-dot">.</span>
        </a>
        <div className="workspace-selector">
          <span className="workspace-avatar">A</span>
          <div>
            <strong>Academic workspace</strong>
            <small>{cloud ? "Administrator access" : "Interactive demo"}</small>
          </div>
          <ChevronRight size={15} />
        </div>
        <p className="nav-caption">WORKSPACE</p>
        <nav aria-label="Main navigation">
          {links.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={"nav-item " + (id === tab ? "selected" : "")}
              onClick={() => navigate(id)}
              aria-current={id === tab ? "page" : undefined}
            >
              <Icon size={19} />
              <span>{label}</span>
              {id === "students" && <b>{workspace.students.length}</b>}
              {id === "scanner" && <i className="live-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="privacy-card">
            <ShieldCheck size={22} />
            <strong>Recognition stays here.</strong>
            <p>
              Face matching runs on your device. New scan images are not
              retained.
            </p>
            <button onClick={() => navigate("settings")}>
              About your data <ArrowUpRight size={14} />
            </button>
          </div>
          <button
            className="account-button"
            onClick={() => {
              if (cloud) {
                void logout().catch((e) => setNotice(e.message));
              } else setLoginOpen(true);
            }}
          >
            <span className="workspace-avatar">{cloud ? "YA" : "D"}</span>
            <span>
              <strong>{cloud ? "Administrator" : "Demo workspace"}</strong>
              <small>
                {cloud ? "Sign out securely" : "Sign in to your workspace"}
              </small>
            </span>
            {cloud ? <LogOut size={17} /> : <LockKeyhole size={17} />}
          </button>
        </div>
      </aside>
      <div className="workspace-body">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="mobile-toggle"
              aria-label="Open navigation"
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={21} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>{links.find((l) => l.id === tab)?.label}</strong>
          </div>
          <div className="topbar-actions">
            <button
              className={
                "sync-pill " + (sync.state === "error" ? "sync-error" : "")
              }
              onClick={() =>
                void syncOfflineQueueToCloud().then(refreshWorkspace)
              }
              title={sync.message}
            >
              <span className="live-dot" />
              {!online
                ? "Offline"
                : !cloud
                  ? "Demo mode"
                  : sync.pending
                    ? sync.pending + " pending"
                    : sync.state === "error"
                      ? "Sync needs attention"
                      : "Cloud connected"}
            </button>
            <button
              className="icon-button"
              aria-label="View sync details"
              onClick={() => navigate("settings")}
            >
              <Bell size={18} />
            </button>
            <button
              className="user-avatar"
              aria-label={cloud ? "Account settings" : "Sign in"}
              onClick={() =>
                cloud ? navigate("settings") : setLoginOpen(true)
              }
            >
              {cloud ? "YA" : "D"}
            </button>
          </div>
        </header>
        <main id="main" className="main-content">
          {!cloud && (
            <div className="demo-banner">
              <span>
                <strong>Take a look around.</strong> You're viewing sample data.
                Demo changes stay in this browser.
              </span>
              <button onClick={() => setLoginOpen(true)}>
                Open my workspace <ArrowUpRight size={15} />
              </button>
            </div>
          )}
          {notice && (
            <div className="notice" role="status">
              {notice}
              <button aria-label="Dismiss" onClick={() => setNotice("")}>
                <X size={16} />
              </button>
            </div>
          )}
          <Suspense
            fallback={
              <div className="loading-card">
                <RefreshCw className="animate-spin" size={20} /> Opening your
                workspace…
              </div>
            }
          >
            {tab === "overview" && (
              <Overview
                students={workspace.students}
                records={workspace.attendance}
                classroom={classroom}
                onScan={() => navigate("scanner")}
                onStudents={() => navigate("students")}
              />
            )}
            {tab === "scanner" && (
              <>
                <div className="page-heading">
                  <div className="eyebrow">A BETTER WAY TO CHECK IN</div>
                  <h1>A face. A moment. You're here.</h1>
                  <p>
                    Position one face in the frame. Location permission is
                    required to verify classroom presence.
                  </p>
                </div>
                <div className="legacy-panel">
                  <Scanner
                    students={workspace.students}
                    classroom={classroom}
                    onAttendanceLogged={() => {}}
                    isOnline={online}
                  />
                </div>
              </>
            )}
            {tab === "students" && (
              <>
                <div className="page-heading">
                  <div className="eyebrow">YOUR CLASSROOM COMMUNITY</div>
                  <h1>Every student, in one place.</h1>
                  <p>
                    Manage your roster, enroll a face photo, and keep guardian
                    details up to date.
                  </p>
                </div>
                <div className="legacy-panel">
                  <Roster
                    students={workspace.students}
                    onStudentAdded={() => {}}
                    onStudentDeleted={() => {}}
                    className={classroom.name}
                  />
                </div>
              </>
            )}
            {tab === "reports" && (
              <>
                <div className="page-heading">
                  <div className="eyebrow">FROM RECORDS TO UNDERSTANDING</div>
                  <h1>See the bigger picture.</h1>
                  <p>
                    Review attendance patterns, select your reporting period,
                    and export your records.
                  </p>
                </div>
                <div className="legacy-panel">
                  <Reports
                    students={workspace.students}
                    records={workspace.attendance}
                    classroom={classroom}
                  />
                </div>
              </>
            )}
            {tab === "settings" && (
              <>
                <div className="page-heading">
                  <div className="eyebrow">WORKSPACE / SETTINGS</div>
                  <h1>Built around your classroom.</h1>
                  <p>
                    Your location, your records, and a clear view of where
                    everything is saved.
                  </p>
                </div>
                <div className="settings-grid">
                  <section className="surface settings-card">
                    <MapPin />
                    <h2>Classroom & location</h2>
                    <p>{classroom.name}</p>
                    <dl>
                      <dt>Instructor</dt>
                      <dd>{classroom.teacherName}</dd>
                      <dt>Allowed radius</dt>
                      <dd>{classroom.radiusMeters} meters</dd>
                      <dt>Coordinates</dt>
                      <dd>
                        {classroom.latitude}, {classroom.longitude}
                      </dd>
                    </dl>
                    <button
                      className="primary-button"
                      onClick={() => setLocationOpen(true)}
                    >
                      Edit classroom <Settings2 size={16} />
                    </button>
                  </section>
                  <section className="surface settings-card">
                    <Database />
                    <h2>Storage & synchronization</h2>
                    <p>
                      {cloud
                        ? (import.meta.env.VITE_STORAGE_LABEL || "Netlify Blobs · attendly-attendance")
                        : "Demo data · this browser only"}
                    </p>
                    <dl>
                      <dt>Sync status</dt>
                      <dd>{sync.message}</dd>
                      <dt>Pending changes</dt>
                      <dd>{sync.pending}</dd>
                      <dt>Last successful sync</dt>
                      <dd>
                        {sync.lastSync
                          ? new Date(sync.lastSync).toLocaleString()
                          : "Not yet synced"}
                      </dd>
                    </dl>
                    <button
                      className="secondary-button"
                      onClick={() =>
                        void syncOfflineQueueToCloud().then(refreshWorkspace)
                      }
                    >
                      <RefreshCw size={16} /> Retry sync
                    </button>
                  </section>
                  <section className="surface settings-card">
                    <ShieldCheck />
                    <h2>Your data, explained</h2>
                    <p>
                      Student profiles, enrolled photos, attendance and
                      classroom settings are stored in the protected cloud
                      workspace. Face descriptors are computed in browser
                      memory. New camera snapshots are discarded after matching.
                    </p>
                    <p>
                      Offline changes stay in this browser until a successful
                      sync. Keep pending changes synced before clearing browser
                      data.
                    </p>
                    <p>
                      Face matching is an aid for a supervised classroom: it
                      does not include liveness detection or prevent photo
                      spoofing.
                    </p>
                  </section>
                  <section className="surface settings-card">
                    <Download />
                    <h2>Keep a copy</h2>
                    <p>
                      Download all currently loaded records, students and
                      classroom settings as JSON. This backup includes enrolled
                      photos and contact details.
                    </p>
                    <button className="primary-button" onClick={downloadBackup}>
                      Download backup <Download size={16} />
                    </button>
                    <p className="fine-print">
                      Backups are manual. There is no scheduled retention or
                      automatic recovery service configured.
                    </p>
                  </section>
                </div>
              </>
            )}
          </Suspense>
          <footer className="workspace-footer">
            <span>
              attendly. <span>Less paperwork. More presence.</span>
            </span>
            <span>{cloud ? "Private workspace" : "Demo workspace"} · v2.0</span>
          </footer>
        </main>
      </div>
      <Suspense fallback={null}>
        <Login
          isOpen={loginOpen}
          onClose={() => setLoginOpen(false)}
          onSuccess={() => setLoginOpen(false)}
        />
        <Location
          classroom={classroom}
          isOpen={locationOpen}
          onClose={() => setLocationOpen(false)}
          onSaveClassroom={(value) => {
            void saveClassroom(value).catch((e) => setNotice(e.message));
          }}
        />
      </Suspense>
    </div>
  );
}
