import jsPDF from "jspdf";
import { Student, AttendanceRecord } from "../types";

export interface MonthlyStudentSummary {
  student: Student;
  totalDays: number;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  percentage: number;
}

// -------------------------------------------------------------
// Calculate Monthly Summaries
// -------------------------------------------------------------
export function calculateMonthlySummaries(
  students: Student[],
  records: AttendanceRecord[],
  totalSchoolDays: number = 20
): MonthlyStudentSummary[] {
  return students.map((student) => {
    const studentRecords = records.filter((r) => r.studentId === student.id);
    const presentDays = studentRecords.filter((r) => r.status === "present").length;
    const lateDays = studentRecords.filter((r) => r.status === "late").length;
    const absentDays = Math.max(0, totalSchoolDays - presentDays - lateDays);

    // Calculate overall percentage (present + 0.5*late)
    const effectivePresent = presentDays + lateDays * 0.5;
    const percentage = Math.min(100, Math.round((effectivePresent / totalSchoolDays) * 100));

    return {
      student,
      totalDays: totalSchoolDays,
      presentDays,
      absentDays,
      lateDays,
      percentage,
    };
  });
}

// -------------------------------------------------------------
// Export to CSV
// -------------------------------------------------------------
export function exportMonthlyReportCSV(
  summaries: MonthlyStudentSummary[],
  monthName: string,
  className: string
): void {
  const headers = [
    "Roll Number",
    "Student Name",
    "Class",
    "Parent Email",
    "Total Class Days",
    "Days Present",
    "Days Late",
    "Days Absent",
    "Attendance Percentage (%)",
    "Status Indicator",
  ];

  const rows = summaries.map((s) => [
    `"${s.student.rollNumber}"`,
    `"${s.student.name}"`,
    `"${s.student.className}"`,
    `"${s.student.parentEmail}"`,
    s.totalDays,
    s.presentDays,
    s.lateDays,
    s.absentDays,
    `${s.percentage}%`,
    s.percentage >= 85 ? "Good" : s.percentage >= 75 ? "Warning" : "Critical (<75%)",
  ]);

  const csvContent =
    "data:text/csv;charset=utf-8," +
    [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `Monthly_Attendance_Report_${className.replace(/\s+/g, "_")}_${monthName}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// -------------------------------------------------------------
// Export to PDF
// -------------------------------------------------------------
export function exportMonthlyReportPDF(
  summaries: MonthlyStudentSummary[],
  monthName: string,
  className: string,
  overallPercentage: number
): void {
  const doc = new jsPDF();

  // Header Title Banner
  doc.setFillColor(30, 41, 59); // Slate-800 background
  doc.rect(0, 0, 210, 35, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("SMART ATTENDANCE SYSTEM - MONTHLY REPORT", 14, 18);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Generated on: ${new Date().toLocaleDateString()} | Class: ${className}`, 14, 27);

  // Summary Metrics Card
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(`Monthly Executive Overview - ${monthName}`, 14, 46);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Total Students Enrolled: ${summaries.length}`, 14, 54);
  doc.text(`Overall Class Attendance Rate: ${overallPercentage}%`, 14, 61);
  doc.text(`Students at Risk (<75%): ${summaries.filter((s) => s.percentage < 75).length}`, 14, 68);

  // Table Headers
  let yPosition = 80;

  doc.setFillColor(241, 245, 249); // Slate-100 table header
  doc.rect(14, yPosition - 5, 182, 8, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Roll No.", 16, yPosition);
  doc.text("Student Name", 45, yPosition);
  doc.text("Total", 100, yPosition);
  doc.text("Present", 120, yPosition);
  doc.text("Absent", 145, yPosition);
  doc.text("Att %", 170, yPosition);

  yPosition += 8;

  // Table Rows
  doc.setFont("helvetica", "normal");
  summaries.forEach((s) => {
    if (yPosition > 270) {
      doc.addPage();
      yPosition = 20;
    }

    doc.text(s.student.rollNumber, 16, yPosition);
    doc.text(s.student.name.substring(0, 25), 45, yPosition);
    doc.text(`${s.totalDays}`, 100, yPosition);
    doc.text(`${s.presentDays}`, 120, yPosition);
    doc.text(`${s.absentDays}`, 145, yPosition);

    // Color code percentage text
    if (s.percentage < 75) {
      doc.setTextColor(220, 38, 38); // Red
    } else if (s.percentage < 85) {
      doc.setTextColor(217, 119, 6); // Amber
    } else {
      doc.setTextColor(22, 163, 74); // Green
    }
    doc.text(`${s.percentage}%`, 170, yPosition);

    doc.setTextColor(30, 41, 59); // Reset text color
    doc.setDrawColor(226, 232, 240);
    doc.line(14, yPosition + 2, 196, yPosition + 2);

    yPosition += 8;
  });

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text("Confidential Academic Record - Smart Attendance AI System with Facial Biometrics", 14, 285);

  doc.save(`Monthly_Attendance_Report_${className.replace(/\s+/g, "_")}_${monthName}.pdf`);
}
