import React, { useState, useMemo } from "react";
import { Student, AttendanceRecord, Classroom } from "../types";
import {
  calculateMonthlySummaries,
  exportMonthlyReportCSV,
  exportMonthlyReportPDF,
  MonthlyStudentSummary,
} from "../lib/exportUtils";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";
import {
  Download,
  FileText,
  TrendingUp,
  AlertTriangle,
  Sparkles,
  Award,
  Loader2,
  BarChart2,
  Calendar,
  Layers,
} from "lucide-react";

interface ReportsAnalyticsProps {
  students: Student[];
  records: AttendanceRecord[];
  classroom: Classroom;
}

export const ReportsAnalytics: React.FC<ReportsAnalyticsProps> = ({
  students,
  records,
  classroom,
}) => {
  const [selectedMonth, setSelectedMonth] = useState("August 2026");
  const [totalSchoolDays, setTotalSchoolDays] = useState(20);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiInsights, setAiInsights] = useState<any | null>(null);

  // Compute monthly student attendance percentages
  const summaries: MonthlyStudentSummary[] = useMemo(
    () => calculateMonthlySummaries(students, records, totalSchoolDays),
    [students, records, totalSchoolDays]
  );

  const overallClassPercentage =
    summaries.length > 0
      ? Math.round(
          summaries.reduce((acc, curr) => acc + curr.percentage, 0) / summaries.length
        )
      : 0;

  const atRiskStudents = summaries.filter((s) => s.percentage < 75);

  // Generate 7-Day Attendance Trend Data
  const trendData = useMemo(() => {
    // Generate dates for past 7 days
    const days: { date: string; label: string; present: number; absent: number; rate: number }[] = [];
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const dayLabel = d.toLocaleDateString("en-US", { weekday: "short", month: "numeric", day: "numeric" });

      const dayRecords = records.filter((r) => r.date === dateStr);
      const presentCount = dayRecords.filter((r) => r.status === "present").length;
      const lateCount = dayRecords.filter((r) => r.status === "late").length;
      const verifiedPresent = Math.min(students.length, presentCount + lateCount);
      const absentCount = Math.max(0, students.length - verifiedPresent);
      const rate = students.length > 0 ? Math.round((verifiedPresent / students.length) * 100) : 0;

      days.push({
        date: dateStr,
        label: dayLabel,
        present: verifiedPresent,
        absent: absentCount,
        rate,
      });
    }
    return days;
  }, [records, students.length]);

  // Attendance Distribution Bins
  const distributionData = useMemo(() => {
    const excellent = summaries.filter((s) => s.percentage >= 90).length;
    const good = summaries.filter((s) => s.percentage >= 80 && s.percentage < 90).length;
    const warning = summaries.filter((s) => s.percentage >= 70 && s.percentage < 80).length;
    const critical = summaries.filter((s) => s.percentage < 70).length;

    return [
      { category: "90-100% (High)", count: excellent, color: "#10b981" },
      { category: "80-89% (Good)", count: good, color: "#3b82f6" },
      { category: "70-79% (Warning)", count: warning, color: "#f59e0b" },
      { category: "<70% (At-Risk)", count: critical, color: "#ef4444" },
    ];
  }, [summaries]);

  // Call Gemini AI API for Monthly Attendance Analysis
  const handleGenerateAiAnalysis = async () => {
    setIsGeneratingAi(true);
    try {
      const res = await fetch("/api/ai-attendance-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          students,
          logs: records,
          month: selectedMonth,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setAiInsights(data.insights);
      }
    } catch (e) {
      console.error("AI Insights error:", e);
    } finally {
      setIsGeneratingAi(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Export Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-zinc-200 gap-3">
        <div>
          <h2 className="text-xl font-semibold text-zinc-900 tracking-tight">
            Reports &amp; Analytics
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            {classroom.name} · Monthly summaries, visual trends, and compliance reports
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center space-x-1.5 bg-zinc-50 border border-zinc-200 px-2.5 py-1 rounded-lg text-xs">
            <span className="text-zinc-500">School Days:</span>
            <input
              type="number"
              min="1"
              max="31"
              value={totalSchoolDays}
              onChange={(e) => setTotalSchoolDays(parseInt(e.target.value, 10) || 20)}
              className="w-10 bg-white border border-zinc-200 text-zinc-900 px-1 py-0.5 rounded text-center font-medium focus:outline-none focus:border-zinc-900"
            />
          </div>

          <button
            onClick={() => exportMonthlyReportCSV(summaries, selectedMonth, classroom.name)}
            className="flex items-center space-x-1 px-3 py-1.5 bg-white hover:bg-zinc-50 text-zinc-700 font-medium text-xs rounded-lg border border-zinc-200 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-zinc-500" />
            <span>CSV</span>
          </button>

          <button
            onClick={() => exportMonthlyReportPDF(summaries, selectedMonth, classroom.name, overallClassPercentage)}
            className="flex items-center space-x-1 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white font-medium text-xs rounded-lg transition-colors cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>PDF Report</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs text-zinc-500 font-medium">Average Attendance</p>
            <p className="text-2xl font-semibold text-zinc-900 mt-1">{overallClassPercentage}%</p>
            <p className="text-[11px] text-zinc-400 mt-0.5">Across all enrolled students</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-zinc-100 text-zinc-700 flex items-center justify-center">
            <TrendingUp className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs text-zinc-500 font-medium">Consistent (≥85%)</p>
            <p className="text-2xl font-semibold text-emerald-700 mt-1">
              {summaries.filter((s) => s.percentage >= 85).length}
            </p>
            <p className="text-[11px] text-zinc-400 mt-0.5">On-track attendance record</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
            <Award className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs text-zinc-500 font-medium">At-Risk (&lt;75%)</p>
            <p className="text-2xl font-semibold text-red-700 mt-1">{atRiskStudents.length}</p>
            <p className="text-[11px] text-zinc-400 mt-0.5">Requires parent outreach</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-red-50 text-red-700 flex items-center justify-center">
            <AlertTriangle className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Visual Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Attendance Trend Chart (7 cols) */}
        <div className="lg:col-span-7 bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-zinc-900 text-xs tracking-tight">7-Day Attendance Rate Trend</h3>
              <p className="text-[11px] text-zinc-500">Daily verification compliance rate (%)</p>
            </div>
            <span className="text-[11px] font-mono text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200">
              Avg: {overallClassPercentage}%
            </span>
          </div>

          <div className="h-56 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="attendanceGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#18181b" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#18181b" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
                <XAxis dataKey="label" stroke="#a1a1aa" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} stroke="#a1a1aa" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#18181b",
                    borderRadius: "8px",
                    color: "#fff",
                    fontSize: "12px",
                    border: "none",
                    padding: "8px 12px",
                  }}
                  formatter={(value: any) => [`${value}% Compliance`, "Rate"]}
                />
                <Area
                  type="monotone"
                  dataKey="rate"
                  stroke="#18181b"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#attendanceGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Attendance Distribution Chart (5 cols) */}
        <div className="lg:col-span-5 bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs space-y-3">
          <div>
            <h3 className="font-semibold text-zinc-900 text-xs tracking-tight">Attendance Distribution</h3>
            <p className="text-[11px] text-zinc-500">Student count grouped by percentage tier</p>
          </div>

          <div className="h-56 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={distributionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
                <XAxis dataKey="category" stroke="#a1a1aa" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} stroke="#a1a1aa" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#18181b",
                    borderRadius: "8px",
                    color: "#fff",
                    fontSize: "12px",
                    border: "none",
                    padding: "8px 12px",
                  }}
                  formatter={(value: any) => [`${value} Students`, "Count"]}
                />
                <Bar dataKey="count" fill="#18181b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* AI Attendance Insights Section */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-zinc-700" />
            <h3 className="font-medium text-zinc-900 text-sm">Automated Trend Analysis</h3>
          </div>

          <button
            onClick={handleGenerateAiAnalysis}
            disabled={isGeneratingAi}
            className="flex items-center space-x-1 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors cursor-pointer"
          >
            {isGeneratingAi ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Analyzing...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3 h-3" />
                <span>Generate Insights</span>
              </>
            )}
          </button>
        </div>

        {aiInsights ? (
          <div className="space-y-3 text-xs text-zinc-700 pt-3 border-t border-zinc-100">
            {aiInsights.keyInsights && (
              <div>
                <h4 className="font-medium text-zinc-900 mb-1.5">Key Observations</h4>
                <ul className="list-disc list-inside space-y-1 text-zinc-600 pl-1">
                  {aiInsights.keyInsights.map((insight: string, idx: number) => (
                    <li key={idx}>{insight}</li>
                  ))}
                </ul>
              </div>
            )}

            {aiInsights.administrativeActionItems && (
              <div>
                <h4 className="font-medium text-zinc-900 mb-1.5">Action Items</h4>
                <ul className="list-disc list-inside space-y-1 text-zinc-600 pl-1">
                  {aiInsights.administrativeActionItems.map((action: string, idx: number) => (
                    <li key={idx}>{action}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-zinc-500">
            Generate an AI-powered summary to identify trends, chronic absenteeism patterns, and actionable follow-ups.
          </p>
        )}
      </div>

      {/* Monthly Attendance Breakdown Table */}
      <div className="bg-white border border-zinc-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="p-4 border-b border-zinc-200">
          <h3 className="font-medium text-zinc-900 text-sm">Monthly Attendance Breakdown</h3>
          <p className="text-xs text-zinc-500 mt-0.5">Individual student attendance records and calculated percentages.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-zinc-700">
            <thead className="bg-zinc-50 text-zinc-500 font-medium text-[11px] border-b border-zinc-200">
              <tr>
                <th className="px-5 py-3">Roll Number</th>
                <th className="px-5 py-3">Student</th>
                <th className="px-5 py-3">Present</th>
                <th className="px-5 py-3">Absent</th>
                <th className="px-5 py-3">Rate</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {summaries.map((s) => (
                <tr key={s.student.id} className="hover:bg-zinc-50/50 transition-colors">
                  <td className="px-5 py-3.5 font-mono text-zinc-600">{s.student.rollNumber}</td>
                  <td className="px-5 py-3.5 font-medium text-zinc-900 flex items-center space-x-2.5">
                    <img
                      src={s.student.faceImageDataUrl}
                      alt={s.student.name}
                      className="w-6 h-6 rounded-full object-cover border border-zinc-200"
                    />
                    <span>{s.student.name}</span>
                  </td>
                  <td className="px-5 py-3.5 text-emerald-700 font-medium">{s.presentDays} days</td>
                  <td className="px-5 py-3.5 text-red-700 font-medium">{s.absentDays} days</td>

                  {/* Attendance Percentage & Progress */}
                  <td className="px-5 py-3.5 w-44">
                    <div className="flex items-center justify-between text-xs font-medium mb-1">
                      <span
                        className={
                          s.percentage >= 85
                            ? "text-emerald-700"
                            : s.percentage >= 75
                            ? "text-amber-700"
                            : "text-red-700"
                        }
                      >
                        {s.percentage}%
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          s.percentage >= 85
                            ? "bg-emerald-600"
                            : s.percentage >= 75
                            ? "bg-amber-500"
                            : "bg-red-600"
                        }`}
                        style={{ width: `${s.percentage}%` }}
                      />
                    </div>
                  </td>

                  <td className="px-5 py-3.5">
                    {s.percentage >= 85 ? (
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md text-[11px] font-medium">
                        Good
                      </span>
                    ) : s.percentage >= 75 ? (
                      <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-md text-[11px] font-medium">
                        Warning
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-red-50 text-red-700 border border-red-200 rounded-md text-[11px] font-medium flex items-center space-x-1 w-max">
                        <AlertTriangle className="w-3 h-3" />
                        <span>Critical (&lt;75%)</span>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

