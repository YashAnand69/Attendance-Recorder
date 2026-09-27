import React, { useState } from "react";
import {
  ArrowUpRight,
  ScanFace,
  Download,
  Search,
  Users,
  Check,
  Clock3,
  CircleDashed,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { Student, AttendanceRecord, Classroom } from "../types";
import { getLocalDateKey } from "../lib/dateUtils";
import { logAttendanceRecord } from "../lib/attendanceStore";
import { downloadCSV } from "../lib/csv";
export function Overview({
  students,
  records,
  classroom,
  onScan,
  onStudents,
}: {
  students: Student[];
  records: AttendanceRecord[];
  classroom: Classroom;
  onScan: () => void;
  onStudents: () => void;
}) {
  const [date, setDate] = useState(getLocalDateKey());
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [notice, setNotice] = useState("");
  const todayRecords = new Map(
    records.filter((r) => r.date === date).map((r) => [r.studentId, r]),
  );
  const present = students.filter(
    (s) => todayRecords.get(s.id)?.status === "present",
  ).length;
  const late = students.filter(
    (s) => todayRecords.get(s.id)?.status === "late",
  ).length;
  const absent = students.filter(
    (s) => todayRecords.get(s.id)?.status === "absent",
  ).length;
  const pending = students.length - present - late - absent;
  const rate = students.length
    ? Math.round(((present + late) / students.length) * 100)
    : 0;
  const filtered = students.filter(
    (s) =>
      (s.name + " " + s.rollNumber)
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (filter === "all" ||
        (todayRecords.get(s.id)?.status || "unmarked") === filter),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / 8));
  const activePage = Math.min(page, pages - 1);
  const rows = filtered.slice(activePage * 8, activePage * 8 + 8);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(date + "T12:00:00");
    d.setDate(d.getDate() - 6 + i);
    const key = getLocalDateKey(d);
    const arrivals = new Set(
      records
        .filter(
          (r) =>
            r.date === key &&
            r.status !== "absent" &&
            students.some((s) => s.id === r.studentId),
        )
        .map((r) => r.studentId),
    ).size;
    return {
      label: d.toLocaleDateString("en", { weekday: "short" }),
      count: arrivals,
      rate: students.length
        ? Math.round((arrivals / students.length) * 100)
        : 0,
    };
  });
  async function mark(s: Student, value: string) {
    try {
      await logAttendanceRecord({
        studentId: s.id,
        studentName: s.name,
        rollNumber: s.rollNumber,
        className: classroom.name,
        date,
        timestamp: new Date().toLocaleTimeString("en-GB"),
        status: value as AttendanceRecord["status"],
        confidence: 0,
        latitude: classroom.latitude,
        longitude: classroom.longitude,
        verificationMethod: "manual",
      });
      setNotice(s.name + " marked " + value + ".");
    } catch (e) {
      setNotice((e as Error).message);
    }
  }
  const exportRows = () =>
    downloadCSV("attendance-" + date + ".csv", [
      ["Roll number", "Name", "Date", "Status", "Time", "Method"],
      ...filtered.map((s) => {
        const r = todayRecords.get(s.id);
        return [
          s.rollNumber,
          s.name,
          date,
          r?.status || "unmarked",
          r?.timestamp || "",
          r?.verificationMethod || "",
        ];
      }),
    ]);
  return (
    <>
      <div className="overview-heading">
        <div>
          <div className="eyebrow">YOUR DAY, AT A GLANCE</div>
          <h1>
            Good to see you here<span className="lime-text">.</span>
          </h1>
          <p>Here's what's happening in your classroom today.</p>
        </div>
        <button className="primary-button" onClick={onScan}>
          <ScanFace size={18} /> Start face check-in <ArrowUpRight size={16} />
        </button>
      </div>
      <div className="context-row">
        <span>
          <span className="live-dot" /> {classroom.name}
        </span>
        <label className="date-control">
          <input
            aria-label="Attendance date"
            type="date"
            value={date}
            max={getLocalDateKey()}
            onChange={(e) => {
              if (e.target.value) setDate(e.target.value);
            }}
          />
        </label>
      </div>
      <div className="metric-grid">
        {[
          {
            label: "Total students",
            value: students.length,
            detail: "In your classroom",
            icon: Users,
            color: "violet",
          },
          {
            label: "Present today",
            value: present,
            detail: rate + "% checked in, including late",
            icon: Check,
            color: "green",
          },
          {
            label: "Late arrivals",
            value: late,
            detail: "Counted as attended",
            icon: Clock3,
            color: "amber",
          },
          {
            label: "Not checked in",
            value: pending + absent,
            detail: pending + " unmarked · " + absent + " absent",
            icon: CircleDashed,
            color: "rose",
          },
        ].map((m) => (
          <div className="metric-card" key={m.label}>
            <div className="metric-label">
              {m.label}
              <span className={"metric-icon " + m.color}>
                <m.icon size={18} />
              </span>
            </div>
            <strong>{m.value.toString().padStart(2, "0")}</strong>
            <small>{m.detail}</small>
          </div>
        ))}
      </div>
      <div className="insight-grid">
        <section className="surface trend-card">
          <div className="section-heading">
            <div>
              <h2>A little consistency goes a long way.</h2>
              <p>Attendance over the last 7 days</p>
            </div>
            <span className="chart-legend">
              <i /> Present + late
            </span>
          </div>
          <div
            className="bar-chart"
            role="img"
            aria-label={days
              .map((d) => d.label + ": " + d.rate + "%")
              .join(", ")}
          >
            <div className="chart-axis">
              <span>100%</span>
              <span>50%</span>
              <span>0%</span>
            </div>
            <div className="chart-bars">
              {days.map((d, i) => (
                <div className="bar-column" key={i}>
                  <div className="bar-track">
                    <div
                      className={"bar-fill " + (i === 6 ? "current" : "")}
                      style={{ height: d.rate + "%" }}
                    >
                      <span>{d.rate}%</span>
                    </div>
                  </div>
                  <small>{d.label}</small>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section className="checkin-card">
          <div className="checkin-kicker">
            <span className="live-dot" /> READY WHEN YOU ARE
          </div>
          <div className="face-illustration">
            <ScanFace size={64} strokeWidth={1} />
            <span className="scan-line" />
          </div>
          <h2>
            Less roll call.
            <br /> More learning.
          </h2>
          <p>
            Open the camera and let on-device face matching take care of
            check-in.
          </p>
          <button onClick={onScan}>
            Open face check-in <ArrowUpRight size={17} />
          </button>
        </section>
      </div>
      <section className="surface attendance-table">
        <div className="section-heading">
          <div>
            <h2>
              Classroom attendance{" "}
              <span className="count-chip">{students.length}</span>
            </h2>
            <p>A clear record of every student's day.</p>
          </div>
          <button className="secondary-button" onClick={exportRows}>
            <Download size={16} /> Export CSV
          </button>
        </div>
        <div className="table-toolbar">
          <div className="filter-tabs" aria-label="Filter attendance">
            {["all", "present", "late", "absent", "unmarked"].map((f) => (
              <button
                key={f}
                className={filter === f ? "active" : ""}
                onClick={() => {
                  setFilter(f);
                  setPage(0);
                }}
              >
                {f === "all" ? "All students" : f[0].toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          <label className="search-field">
            <Search size={16} />
            <input
              aria-label="Search students"
              placeholder="Search name or roll number…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
            />
          </label>
        </div>
        {notice && (
          <p className="inline-notice" role="status">
            {notice}
          </p>
        )}
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Roll number</th>
                <th>Status</th>
                <th>Check-in time</th>
                <th>Method</th>
                <th>Update status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const r = todayRecords.get(s.id);
                return (
                  <tr key={s.id}>
                    <td>
                      <div className="student-cell">
                        <span className="initial-avatar">
                          {s.name
                            .split(" ")
                            .map((n) => n[0])
                            .slice(0, 2)
                            .join("")}
                        </span>
                        <div>
                          <strong>{s.name}</strong>
                          <small>{s.className}</small>
                        </div>
                      </div>
                    </td>
                    <td className="mono">{s.rollNumber}</td>
                    <td>
                      <span
                        className={"status-badge " + (r?.status || "unmarked")}
                      >
                        <i />
                        {r?.status || "Unmarked"}
                      </span>
                    </td>
                    <td>{r?.timestamp || "—"}</td>
                    <td>
                      {r?.verificationMethod === "face_recognition"
                        ? "Face match"
                        : r
                          ? "Manual"
                          : "—"}
                    </td>
                    <td>
                      <select
                        aria-label={"Update " + s.name + " attendance"}
                        value={r?.status || ""}
                        onChange={(e) => void mark(s, e.target.value)}
                      >
                        <option value="" disabled>
                          Mark attendance
                        </option>
                        <option value="present">Present</option>
                        <option value="late">Late</option>
                        <option value="absent">Absent</option>
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!rows.length && (
            <div className="empty-state">
              <Users size={28} />
              <h3>
                {students.length
                  ? "No matching students"
                  : "Your classroom starts here."}
              </h3>
              <p>
                {students.length
                  ? "Try a different name or status filter."
                  : "Add your first student to start recording attendance."}
              </p>
              {!students.length && (
                <button className="primary-button" onClick={onStudents}>
                  Add students <ArrowUpRight size={16} />
                </button>
              )}
            </div>
          )}
        </div>
        <div className="table-footer">
          <span>
            {filtered.length ? activePage * 8 + 1 : 0}–
            {Math.min((activePage + 1) * 8, filtered.length)} of{" "}
            {filtered.length} students
          </span>
          <div>
            <button
              aria-label="Previous page"
              disabled={activePage === 0}
              onClick={() => setPage(activePage - 1)}
            >
              <ChevronLeft size={16} />
            </button>
            <span>
              Page {activePage + 1} of {pages}
            </span>
            <button
              aria-label="Next page"
              disabled={activePage >= pages - 1}
              onClick={() => setPage(activePage + 1)}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
