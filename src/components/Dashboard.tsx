import React, { useState } from "react";
import { Student, AttendanceRecord, Classroom } from "../types";
import { logAttendanceRecord, sendParentAbsentAlert } from "../lib/attendanceStore";
import {
  Users,
  UserCheck,
  UserX,
  Clock,
  Search,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Send,
  WifiOff,
  Activity,
  Download,
  MailCheck,
  Sparkles,
  Camera,
  Check,
  AlertTriangle,
} from "lucide-react";

interface DashboardProps {
  students: Student[];
  records: AttendanceRecord[];
  classroom: Classroom;
  isOnline: boolean;
  offlineQueueCount: number;
  onSyncOfflineQueue: () => void;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  onRecordUpdated: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  students,
  records,
  classroom,
  isOnline,
  offlineQueueCount,
  onSyncOfflineQueue,
  selectedDate,
  setSelectedDate,
  onRecordUpdated,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "present" | "absent" | "late">("all");
  const [sendingAlertStudentId, setSendingAlertStudentId] = useState<string | null>(null);
  const [isSendingBatchAlerts, setIsSendingBatchAlerts] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [selectedSnapshot, setSelectedSnapshot] = useState<{ name: string; url: string; time: string; confidence: number } | null>(null);

  // Map student attendance status for selected date
  const studentStatusMap = new Map<string, AttendanceRecord>();
  records.forEach((r) => {
    studentStatusMap.set(r.studentId, r);
  });

  // Metrics
  const totalStudents = students.length;
  const presentCount = students.filter((s) => studentStatusMap.get(s.id)?.status === "present").length;
  const lateCount = students.filter((s) => studentStatusMap.get(s.id)?.status === "late").length;
  const absentStudents = students.filter((s) => {
    const st = studentStatusMap.get(s.id)?.status;
    return !st || st === "absent";
  });
  const absentCount = absentStudents.length;
  const attendanceRate = totalStudents > 0 ? Math.round(((presentCount + lateCount * 0.5) / totalStudents) * 100) : 0;

  // Filtered Students List
  const filteredStudents = students.filter((student) => {
    const matchesSearch =
      student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.rollNumber.toLowerCase().includes(searchQuery.toLowerCase());

    const record = studentStatusMap.get(student.id);
    const currentStatus = record ? record.status : "absent";

    const matchesStatus = statusFilter === "all" || currentStatus === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Manual Status Toggle
  const handleToggleStatus = async (student: Student, newStatus: "present" | "absent" | "late") => {
    const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    await logAttendanceRecord({
      studentId: student.id,
      studentName: student.name,
      rollNumber: student.rollNumber,
      className: classroom.name,
      date: selectedDate,
      timestamp: timeStr,
      status: newStatus,
      confidence: 100,
      latitude: classroom.latitude,
      longitude: classroom.longitude,
      verificationMethod: "manual",
    });

    setActionNotice(`Updated ${student.name} to ${newStatus}`);
    setTimeout(() => setActionNotice(null), 3000);
    onRecordUpdated();
  };

  // Bulk mark all unverified as absent
  const handleMarkAllAbsent = async () => {
    const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    let count = 0;

    for (const student of absentStudents) {
      await logAttendanceRecord({
        studentId: student.id,
        studentName: student.name,
        rollNumber: student.rollNumber,
        className: classroom.name,
        date: selectedDate,
        timestamp: timeStr,
        status: "absent",
        confidence: 100,
        latitude: classroom.latitude,
        longitude: classroom.longitude,
        verificationMethod: "manual",
      });
      count++;
    }

    setActionNotice(`Marked ${count} unrecorded students as Absent.`);
    setTimeout(() => setActionNotice(null), 3500);
    onRecordUpdated();
  };

  // Trigger Parent Alert Email for one student
  const handleSendAlert = async (student: Student) => {
    setSendingAlertStudentId(student.id);
    const res = await sendParentAbsentAlert(student, selectedDate, "Marked Absent in Admin Dashboard");
    setSendingAlertStudentId(null);

    if (res.success) {
      setActionNotice(`Email alert sent to parent (${student.parentEmail})`);
    } else {
      setActionNotice(`Failed to send email to ${student.parentEmail}`);
    }
    setTimeout(() => setActionNotice(null), 4000);
  };

  // Batch trigger alerts to all absent students' parents
  const handleBatchAlertAbsentParents = async () => {
    if (absentStudents.length === 0) {
      setActionNotice("No absent students to alert.");
      setTimeout(() => setActionNotice(null), 3000);
      return;
    }

    setIsSendingBatchAlerts(true);
    let successCount = 0;

    for (const student of absentStudents) {
      try {
        const res = await sendParentAbsentAlert(student, selectedDate, "Daily automated absence notification");
        if (res.success) successCount++;
      } catch (e) {}
    }

    setIsSendingBatchAlerts(false);
    setActionNotice(`Successfully dispatched ${successCount} parent absence alert emails.`);
    setTimeout(() => setActionNotice(null), 5000);
  };

  // Export Today's Attendance to CSV
  const handleExportTodayCSV = () => {
    const headers = ["Roll Number", "Student Name", "Class", "Date", "Status", "Scan Time", "Method", "Confidence (%)", "Parent Email"];
    const rows = students.map((s) => {
      const rec = studentStatusMap.get(s.id);
      return [
        `"${s.rollNumber}"`,
        `"${s.name}"`,
        `"${s.className}"`,
        `"${selectedDate}"`,
        `"${rec ? rec.status : "absent"}"`,
        `"${rec ? rec.timestamp : "—"}"`,
        `"${rec ? rec.verificationMethod : "unrecorded"}"`,
        `"${rec ? rec.confidence : 0}"`,
        `"${s.parentEmail}"`,
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Attendance_${classroom.name.replace(/\s+/g, "_")}_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Header Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200/90 gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight font-display">
            Attendance Dashboard
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {classroom.name} · Instructor: {classroom.teacherName}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center space-x-1.5 bg-white border border-slate-200 px-2.5 py-1.5 rounded-xl shadow-2xs">
            <label className="text-xs text-slate-500 font-bold">Date:</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-xs text-slate-900 font-mono font-medium focus:outline-none cursor-pointer"
            />
          </div>

          <button
            onClick={() => setSelectedDate(new Date().toISOString().split("T")[0])}
            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            title="Switch to Today"
          >
            Today
          </button>

          <button
            onClick={handleExportTodayCSV}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-bold transition-colors cursor-pointer shadow-2xs"
            title="Download CSV for selected date"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export CSV</span>
          </button>

          {absentCount > 0 && (
            <button
              onClick={handleBatchAlertAbsentParents}
              disabled={isSendingBatchAlerts}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-slate-950 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-sm transition-colors cursor-pointer disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5 text-emerald-400" />
              <span>{isSendingBatchAlerts ? "Dispatching..." : `Alert ${absentCount} Parents`}</span>
            </button>
          )}
        </div>
      </div>

      {/* Offline Status Banner */}
      {(!isOnline || offlineQueueCount > 0) && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-center justify-between text-amber-900 text-xs">
          <div className="flex items-center space-x-2.5">
            <WifiOff className="w-4 h-4 text-amber-600 shrink-0" />
            <div>
              <span className="font-semibold">
                {!isOnline ? "Offline Mode Active" : "Pending Offline Records"}
              </span>
              <span className="text-amber-700 ml-1.5">
                ({offlineQueueCount} stored locally in cache)
              </span>
            </div>
          </div>

          <button
            onClick={onSyncOfflineQueue}
            disabled={!isOnline || offlineQueueCount === 0}
            className="flex items-center space-x-1 px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white font-medium rounded-md disabled:opacity-40 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Sync</span>
          </button>
        </div>
      )}

      {/* Action Notice Toast */}
      {actionNotice && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-3.5 py-2.5 rounded-xl text-xs font-medium flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Enrolled */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider font-display">Enrolled Roster</span>
            <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 group-hover:scale-110 transition-transform">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 tracking-tight font-display">{totalStudents}</div>
          <div className="flex items-center space-x-1.5 mt-2 text-[11px] text-slate-500">
            <span className="w-2 h-2 rounded-full bg-slate-400" />
            <span>Active classroom candidates</span>
          </div>
        </div>

        {/* Present Today */}
        <div className="bg-white border border-emerald-200/80 rounded-2xl p-4 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="flex items-center justify-between text-emerald-700 mb-2">
            <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider font-display">Present Today</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700 group-hover:scale-110 transition-transform">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-emerald-700 tracking-tight font-display">{presentCount}</div>
          <div className="flex items-center space-x-1.5 mt-2 text-[11px] text-emerald-700 font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Verified in classroom</span>
          </div>
        </div>

        {/* Absent */}
        <div className="bg-white border border-red-200/80 rounded-2xl p-4 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="flex items-center justify-between text-red-700 mb-2">
            <span className="text-xs font-bold text-red-800 uppercase tracking-wider font-display">Absent Students</span>
            <div className="w-8 h-8 rounded-xl bg-red-100 flex items-center justify-center text-red-700 group-hover:scale-110 transition-transform">
              <UserX className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-red-700 tracking-tight font-display">{absentCount}</div>
          <div className="flex items-center space-x-1.5 mt-2 text-[11px] text-red-600 font-semibold">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <span>Pending check-in or alert</span>
          </div>
        </div>

        {/* Attendance Rate */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider font-display">Compliance Rate</span>
            <div className="w-8 h-8 rounded-xl bg-teal-50 flex items-center justify-center text-teal-700 group-hover:scale-110 transition-transform">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 tracking-tight font-display">{attendanceRate}%</div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-2.5">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                attendanceRate >= 80 ? "bg-emerald-500" : attendanceRate >= 60 ? "bg-amber-500" : "bg-red-500"
              }`}
              style={{ width: `${attendanceRate}%` }}
            />
          </div>
        </div>
      </div>

      {/* Roster Table Card */}
      <div className="bg-white border border-zinc-200 rounded-2xl shadow-xs overflow-hidden">
        {/* Search & Filter Header */}
        <div className="p-4 border-b border-zinc-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-zinc-400" />
            <input
              type="text"
              placeholder="Search by name or roll..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs text-zinc-900 placeholder-zinc-400 focus:bg-white focus:outline-none focus:border-zinc-900 transition-colors"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center space-x-1 bg-zinc-100 p-0.5 rounded-lg border border-zinc-200/60 text-xs">
              {(["all", "present", "absent", "late"] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-md capitalize font-medium text-xs transition-all ${
                    statusFilter === st
                      ? "bg-white text-zinc-900 shadow-xs"
                      : "text-zinc-500 hover:text-zinc-800"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            {absentCount > 0 && (
              <button
                onClick={handleMarkAllAbsent}
                className="px-2.5 py-1 text-xs font-medium text-zinc-700 bg-white hover:bg-zinc-50 border border-zinc-200 rounded-lg transition-colors cursor-pointer"
              >
                Mark Rest Absent
              </button>
            )}
          </div>
        </div>

        {/* Student Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-zinc-700">
            <thead className="bg-zinc-50 text-zinc-500 font-medium text-[11px] border-b border-zinc-200">
              <tr>
                <th className="px-5 py-3">Student</th>
                <th className="px-5 py-3">Roll Number</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Scan Time</th>
                <th className="px-5 py-3">Verification</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-zinc-400">
                    No students found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student) => {
                  const record = studentStatusMap.get(student.id);
                  const status = record ? record.status : "absent";

                  return (
                    <tr key={student.id} className="hover:bg-zinc-50/50 transition-colors">
                      {/* Student Info */}
                      <td className="px-5 py-3.5 flex items-center space-x-3">
                        <img
                          src={student.faceImageDataUrl}
                          alt={student.name}
                          className="w-8 h-8 rounded-full object-cover border border-zinc-200"
                        />
                        <div>
                          <div className="font-medium text-zinc-900">{student.name}</div>
                          <div className="text-[11px] text-zinc-400">{student.parentEmail}</div>
                        </div>
                      </td>

                      {/* Roll Number */}
                      <td className="px-5 py-3.5 font-mono text-zinc-600">
                        {student.rollNumber}
                      </td>

                      {/* Status Badge */}
                      <td className="px-5 py-3.5">
                        {status === "present" && (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Present</span>
                          </span>
                        )}
                        {status === "absent" && (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-red-50 text-red-700 border border-red-200">
                            <XCircle className="w-3 h-3" />
                            <span>Absent</span>
                          </span>
                        )}
                        {status === "late" && (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-3 h-3" />
                            <span>Late</span>
                          </span>
                        )}
                      </td>

                      {/* Scan Time */}
                      <td className="px-5 py-3.5 font-mono text-zinc-500">
                        {record ? record.timestamp : "—"}
                      </td>

                      {/* Method & Snapshot trigger */}
                      <td className="px-5 py-3.5">
                        {record ? (
                          <div className="flex items-center space-x-1.5">
                            <span className="text-[11px] text-zinc-600 bg-zinc-100 border border-zinc-200 px-1.5 py-0.5 rounded font-mono">
                              {record.verificationMethod === "face_recognition"
                                ? `AI Face (${record.confidence}%)`
                                : "Manual"}
                            </span>
                            {record.snapshotUrl && (
                              <button
                                onClick={() =>
                                  setSelectedSnapshot({
                                    name: student.name,
                                    url: record.snapshotUrl!,
                                    time: record.timestamp,
                                    confidence: record.confidence,
                                  })
                                }
                                className="p-0.5 text-zinc-400 hover:text-zinc-700 rounded transition-colors"
                                title="View verification frame snapshot"
                              >
                                <Camera className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-zinc-400">Unrecorded</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            onClick={() => handleToggleStatus(student, status === "present" ? "absent" : "present")}
                            className="px-2.5 py-1 rounded-md text-xs font-medium border border-zinc-200 text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
                          >
                            Mark {status === "present" ? "Absent" : "Present"}
                          </button>

                          {status === "absent" && (
                            <button
                              onClick={() => handleSendAlert(student)}
                              disabled={sendingAlertStudentId === student.id}
                              className="p-1 text-zinc-500 hover:text-zinc-900 border border-zinc-200 rounded-md hover:bg-zinc-100 transition-colors cursor-pointer"
                              title="Send parent absent alert"
                            >
                              <Send className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Snapshot Preview Modal */}
      {selectedSnapshot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/40 backdrop-blur-xs">
          <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xl max-w-sm w-full space-y-3 text-zinc-900">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
              <div>
                <h4 className="text-xs font-semibold">{selectedSnapshot.name}</h4>
                <p className="text-[11px] text-zinc-500">
                  Scanned at {selectedSnapshot.time} · {selectedSnapshot.confidence}% Match
                </p>
              </div>
              <button
                onClick={() => setSelectedSnapshot(null)}
                className="text-zinc-400 hover:text-zinc-600 p-1 rounded-md text-xs"
              >
                ✕
              </button>
            </div>
            <div className="aspect-4/3 rounded-xl overflow-hidden bg-zinc-950 border border-zinc-200 flex items-center justify-center">
              <img
                src={selectedSnapshot.url}
                alt="Verification Frame"
                className="w-full h-full object-cover"
              />
            </div>
            <button
              onClick={() => setSelectedSnapshot(null)}
              className="w-full py-1.5 bg-zinc-900 text-white rounded-lg text-xs font-medium hover:bg-zinc-800 transition-colors"
            >
              Close Snapshot
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

