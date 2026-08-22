import React, { useState } from "react";
import { Student, AttendanceRecord, Classroom } from "../types";
import { logAttendanceRecord, sendParentAbsentAlert } from "../lib/attendanceStore";
import {
  Users,
  UserCheck,
  UserX,
  Clock,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Send,
  Wifi,
  WifiOff,
  MapPin,
  Sparkles,
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
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Map student attendance status for selected date
  const studentStatusMap = new Map<string, AttendanceRecord>();
  records.forEach((r) => {
    studentStatusMap.set(r.studentId, r);
  });

  // Metrics
  const totalStudents = students.length;
  const presentCount = students.filter((s) => studentStatusMap.get(s.id)?.status === "present").length;
  const lateCount = students.filter((s) => studentStatusMap.get(s.id)?.status === "late").length;
  const absentCount = totalStudents - presentCount - lateCount;
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

  // Manual Override Handler (Teacher Override)
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
      confidence: 100, // Manual staff override
      latitude: classroom.latitude,
      longitude: classroom.longitude,
      verificationMethod: "manual",
    });

    setActionNotice(`Updated ${student.name} status to ${newStatus.toUpperCase()}`);
    setTimeout(() => setActionNotice(null), 3000);
    onRecordUpdated();
  };

  // Trigger Parent Alert Email
  const handleSendAlert = async (student: Student) => {
    setSendingAlertStudentId(student.id);
    const res = await sendParentAbsentAlert(student, selectedDate, "Marked Absent in Admin Dashboard");
    setSendingAlertStudentId(null);

    if (res.success) {
      setActionNotice(`Automated email alert delivered to parent (${student.parentEmail})`);
    } else {
      setActionNotice(`Failed to send email alert to ${student.parentEmail}`);
    }
    setTimeout(() => setActionNotice(null), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Date Picker */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center space-x-2">
            <span>Teacher &amp; Admin Real-Time Oversight</span>
            <span className="text-xs bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono px-2.5 py-0.5 rounded-full">
              Live Feed
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Classroom: <span className="text-indigo-300 font-semibold">{classroom.name}</span> | Teacher:{" "}
            <span className="text-slate-200">{classroom.teacherName}</span>
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <label className="text-xs font-semibold text-slate-300">Select Date:</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Offline Caching Status Banner */}
      {(!isOnline || offlineQueueCount > 0) && (
        <div className="bg-amber-950/40 border border-amber-500/40 rounded-2xl p-4 flex items-center justify-between text-amber-200 text-xs">
          <div className="flex items-center space-x-3">
            <WifiOff className="w-5 h-5 text-amber-400 flex-shrink-0" />
            <div>
              <p className="font-bold">
                {!isOnline ? "Network Connection Lost (Offline Caching Active)" : "Pending Offline Records"}
              </p>
              <p className="opacity-80">
                {offlineQueueCount} attendance records stored locally in IndexedDB cache. Data will auto-sync to Cloud Firestore once connection is restored.
              </p>
            </div>
          </div>

          <button
            onClick={onSyncOfflineQueue}
            disabled={!isOnline || offlineQueueCount === 0}
            className="flex items-center space-x-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg disabled:opacity-40 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Sync Now ({offlineQueueCount})</span>
          </button>
        </div>
      )}

      {/* Action Notice Alert */}
      {actionNotice && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 px-4 py-3 rounded-xl text-xs font-semibold flex items-center space-x-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Students */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold">Total Enrolled</span>
            <Users className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-black text-white">{totalStudents}</div>
          <p className="text-[11px] text-slate-400 mt-1">Classroom Roster</p>
        </div>

        {/* Present */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold">Present Today</span>
            <UserCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400">{presentCount}</div>
          <p className="text-[11px] text-emerald-500/80 mt-1">Facial Scan Verified</p>
        </div>

        {/* Absent */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold">Absent</span>
            <UserX className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-black text-rose-400">{absentCount}</div>
          <p className="text-[11px] text-rose-400/80 mt-1">Requires Parent Alert</p>
        </div>

        {/* Overall Attendance % */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold">Today's Rate</span>
            <Sparkles className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-black text-indigo-300">{attendanceRate}%</div>
          <p className="text-[11px] text-indigo-400/80 mt-1">Overall Compliance</p>
        </div>
      </div>

      {/* Roster Oversight Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        {/* Search & Filter Header */}
        <div className="p-4 sm:p-6 border-b border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search student name or roll..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-slate-400" />
            <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700 text-xs">
              {(["all", "present", "absent", "late"] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1 rounded-lg capitalize font-semibold transition-all ${
                    statusFilter === st
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Student List Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase font-mono text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-6 py-3">Student</th>
                <th className="px-6 py-3">Roll Number</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Scan Time</th>
                <th className="px-6 py-3">Verification Method</th>
                <th className="px-6 py-3 text-right">Teacher Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                    No student records matching your search query.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student) => {
                  const record = studentStatusMap.get(student.id);
                  const status = record ? record.status : "absent";

                  return (
                    <tr key={student.id} className="hover:bg-slate-800/40 transition-colors">
                      {/* Student Info */}
                      <td className="px-6 py-4 flex items-center space-x-3">
                        <img
                          src={student.faceImageDataUrl}
                          alt={student.name}
                          className="w-9 h-9 rounded-full object-cover border border-slate-700"
                        />
                        <div>
                          <div className="font-bold text-white text-sm">{student.name}</div>
                          <div className="text-[11px] text-slate-400">{student.parentEmail}</div>
                        </div>
                      </td>

                      {/* Roll Number */}
                      <td className="px-6 py-4 font-mono font-medium text-slate-300">
                        {student.rollNumber}
                      </td>

                      {/* Status Badge */}
                      <td className="px-6 py-4">
                        {status === "present" && (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Present</span>
                          </span>
                        )}
                        {status === "absent" && (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Absent</span>
                          </span>
                        )}
                        {status === "late" && (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                            <Clock className="w-3.5 h-3.5" />
                            <span>Late</span>
                          </span>
                        )}
                      </td>

                      {/* Scan Time */}
                      <td className="px-6 py-4 font-mono text-slate-400">
                        {record ? record.timestamp : "--:--"}
                      </td>

                      {/* Verification Method */}
                      <td className="px-6 py-4">
                        {record ? (
                          <span className="text-[11px] text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded font-mono">
                            {record.verificationMethod === "face_recognition"
                              ? `AI Face Match (${record.confidence}%)`
                              : "Teacher Manual"}
                          </span>
                        ) : (
                          <span className="text-slate-500">Unscanned</span>
                        )}
                      </td>

                      {/* Teacher Actions */}
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => handleToggleStatus(student, status === "present" ? "absent" : "present")}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                              status === "present"
                                ? "bg-rose-500/20 text-rose-300 hover:bg-rose-500/30"
                                : "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"
                            }`}
                          >
                            Mark {status === "present" ? "Absent" : "Present"}
                          </button>

                          {status === "absent" && (
                            <button
                              onClick={() => handleSendAlert(student)}
                              disabled={sendingAlertStudentId === student.id}
                              className="p-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-lg transition-colors border border-amber-500/30"
                              title="Send automated email alert to parent"
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
    </div>
  );
};
