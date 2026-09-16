import { AiAttendanceInsights, AttendanceRecord, Student } from "../types";

export function buildLocalAttendanceInsights(
  students: Student[],
  records: AttendanceRecord[],
  schoolDays: number,
): AiAttendanceInsights {
  const observedDays = new Set(records.map((record) => record.date)).size;
  const totalDays = Math.max(observedDays, schoolDays > 0 ? schoolDays : 1);
  const presentCount = records.filter((record) => record.status === "present" || record.status === "late").length;
  const overallAttendancePercentage = students.length
    ? Math.round((presentCount / Math.max(students.length * totalDays, 1)) * 100)
    : 0;

  const lowAttendanceStudents = students
    .map((student) => {
      const studentRecords = records.filter((record) => record.studentId === student.id);
      const uniquePresentDays = new Set(
        studentRecords
          .filter((record) => record.status === "present" || record.status === "late")
          .map((record) => record.date),
      ).size;
      const percentage = Math.round((uniquePresentDays / totalDays) * 100);
      return {
        studentName: student.name,
        percentage,
        totalClasses: totalDays,
        presentCount: uniquePresentDays,
        status: percentage < 60 ? ("Critical" as const) : ("At Risk" as const),
      };
    })
    .filter((student) => student.percentage < 75)
    .sort((first, second) => first.percentage - second.percentage);

  const lateCount = records.filter((record) => record.status === "late").length;
  return {
    overallAttendancePercentage,
    lowAttendanceStudents,
    keyInsights: records.length
      ? [
          `${observedDays} attendance day${observedDays === 1 ? "" : "s"} are represented in the selected period.`,
          `${presentCount} verified arrival${presentCount === 1 ? "" : "s"} recorded across the roster.`,
          lateCount ? `${lateCount} late arrival${lateCount === 1 ? "" : "s"} should be reviewed for recurring patterns.` : "No late arrivals are recorded in this period.",
        ]
      : ["No attendance logs are available for this period yet. Start a scan or use a manual check-in to build the trend."],
    administrativeActionItems: lowAttendanceStudents.length
      ? [
          "Review the flagged students with their instructor before sending parent outreach.",
          "Confirm the classroom geofence and camera setup before the next attendance session.",
          "Keep the offline queue synced so the monthly record stays complete.",
        ]
      : [
          "Keep scanning at the classroom entrance for a complete attendance trail.",
          "Review the 7-day trend at the end of each week.",
          "Export a monthly report for the academic record.",
        ],
  };
}
