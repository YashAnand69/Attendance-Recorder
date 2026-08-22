import React, { useState } from "react";
import { Student, AttendanceRecord, Classroom } from "../types";
import {
  calculateMonthlySummaries,
  exportMonthlyReportCSV,
  exportMonthlyReportPDF,
  MonthlyStudentSummary,
} from "../lib/exportUtils";
import {
  FileSpreadsheet,
  Download,
  FileText,
  TrendingUp,
  AlertTriangle,
  Sparkles,
  Award,
  CheckCircle2,
  Calendar,
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
  const summaries: MonthlyStudentSummary[] = calculateMonthlySummaries(students, records, totalSchoolDays);

  const overallClassPercentage =
    summaries.length > 0
      ? Math.round(
          summaries.reduce((acc, curr) => acc + curr.percentage, 0) / summaries.length
        )
      : 0;

  const atRiskStudents = summaries.filter((s) => s.percentage < 75);

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
      {/* Top Banner & Export Actions */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center space-x-2">
            <FileSpreadsheet className="w-5 h-5 text-indigo-400" />
            <span>Monthly Attendance Reports &amp; Overall Percentage</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Classroom: <span className="text-indigo-300 font-semibold">{classroom.name}</span> | Target Total Class Days:{" "}
            <span className="text-slate-200">{totalSchoolDays} days</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Days selector */}
          <div className="flex items-center space-x-2 bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700 text-xs">
            <span className="text-slate-400">Class Days:</span>
            <input
              type="number"
              min="1"
              max="31"
              value={totalSchoolDays}
              onChange={(e) => setTotalSchoolDays(parseInt(e.target.value, 10) || 20)}
              className="w-12 bg-slate-900 text-white px-2 py-0.5 rounded text-center font-bold focus:outline-none"
            />
          </div>

          <button
            onClick={() => exportMonthlyReportCSV(summaries, selectedMonth, classroom.name)}
            className="flex items-center space-x-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl border border-slate-700 transition-colors"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => exportMonthlyReportPDF(summaries, selectedMonth, classroom.name, overallClassPercentage)}
            className="flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 transition-all"
          >
            <FileText className="w-4 h-4" />
            <span>Export PDF</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-semibold">Overall Class Attendance Rate</p>
            <p className="text-3xl font-black text-indigo-300 mt-1">{overallClassPercentage}%</p>
            <p className="text-[11px] text-slate-500 mt-1">Average across all students</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-semibold">Good Attendance (≥85%)</p>
            <p className="text-3xl font-black text-emerald-400 mt-1">
              {summaries.filter((s) => s.percentage >= 85).length}
            </p>
            <p className="text-[11px] text-emerald-500/80 mt-1">Consistent presence</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <Award className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-semibold">At-Risk Students (&lt;75%)</p>
            <p className="text-3xl font-black text-rose-400 mt-1">{atRiskStudents.length}</p>
            <p className="text-[11px] text-rose-400/80 mt-1">Requires parent follow-up</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* AI Attendance Insights Section */}
      <div className="bg-slate-900 border border-indigo-500/30 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-white text-base">Gemini Automated Executive Analysis</h3>
          </div>

          <button
            onClick={handleGenerateAiAnalysis}
            disabled={isGeneratingAi}
            className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer"
          >
            <Sparkles className={`w-3.5 h-3.5 ${isGeneratingAi ? "animate-spin" : ""}`} />
            <span>{isGeneratingAi ? "Analyzing Classroom Records..." : "Generate AI Insights"}</span>
          </button>
        </div>

        {aiInsights ? (
          <div className="space-y-4 text-xs text-slate-300 pt-2 border-t border-slate-800">
            {aiInsights.keyInsights && (
              <div>
                <h4 className="font-bold text-indigo-300 mb-2">Key Observational Trends</h4>
                <ul className="list-disc list-inside space-y-1 text-slate-300">
                  {aiInsights.keyInsights.map((insight: string, idx: number) => (
                    <li key={idx}>{insight}</li>
                  ))}
                </ul>
              </div>
            )}

            {aiInsights.administrativeActionItems && (
              <div>
                <h4 className="font-bold text-amber-300 mb-2">Recommended Administrative Actions</h4>
                <ul className="list-disc list-inside space-y-1 text-slate-300">
                  {aiInsights.administrativeActionItems.map((action: string, idx: number) => (
                    <li key={idx}>{action}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-slate-400">
            Click "Generate AI Insights" to run Gemini multi-record trend analysis on current classroom attendance metrics.
          </p>
        )}
      </div>

      {/* Monthly Student Attendance Breakdown Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="p-6 border-b border-slate-800">
          <h3 className="font-bold text-white text-base">Student Overall Percentage Calculation</h3>
          <p className="text-xs text-slate-400 mt-1">Individual monthly attendance metrics and visual progress bars.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase font-mono text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-6 py-3">Roll Number</th>
                <th className="px-6 py-3">Student Name</th>
                <th className="px-6 py-3">Days Present</th>
                <th className="px-6 py-3">Days Absent</th>
                <th className="px-6 py-3">Attendance Rate</th>
                <th className="px-6 py-3">Status Indicator</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {summaries.map((s) => (
                <tr key={s.student.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="px-6 py-4 font-mono font-medium text-slate-300">{s.student.rollNumber}</td>
                  <td className="px-6 py-4 font-bold text-white flex items-center space-x-2">
                    <img
                      src={s.student.faceImageDataUrl}
                      alt={s.student.name}
                      className="w-7 h-7 rounded-full object-cover"
                    />
                    <span>{s.student.name}</span>
                  </td>
                  <td className="px-6 py-4 font-bold text-emerald-400">{s.presentDays} days</td>
                  <td className="px-6 py-4 font-bold text-rose-400">{s.absentDays} days</td>

                  {/* Attendance Percentage & Progress Bar */}
                  <td className="px-6 py-4 w-48">
                    <div className="flex items-center justify-between text-xs font-bold mb-1">
                      <span
                        className={
                          s.percentage >= 85
                            ? "text-emerald-400"
                            : s.percentage >= 75
                            ? "text-amber-400"
                            : "text-rose-400"
                        }
                      >
                        {s.percentage}%
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          s.percentage >= 85
                            ? "bg-emerald-500"
                            : s.percentage >= 75
                            ? "bg-amber-500"
                            : "bg-rose-500"
                        }`}
                        style={{ width: `${s.percentage}%` }}
                      />
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    {s.percentage >= 85 ? (
                      <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-full text-[11px] font-bold">
                        Good
                      </span>
                    ) : s.percentage >= 75 ? (
                      <span className="px-2.5 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-full text-[11px] font-bold">
                        Warning
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 bg-rose-500/10 text-rose-400 border border-rose-500/30 rounded-full text-[11px] font-bold flex items-center space-x-1 w-max">
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
