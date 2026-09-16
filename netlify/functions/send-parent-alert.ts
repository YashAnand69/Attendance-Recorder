type ParentAlertRequest = {
  studentName: string;
  rollNumber?: string;
  className?: string;
  parentEmail: string;
  date: string;
  reason?: string;
};

export default async (request: Request) => {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const payload = (await request.json()) as Partial<ParentAlertRequest>;
  if (!payload.studentName || !payload.parentEmail || !payload.date) {
    return Response.json({ error: "studentName, parentEmail, and date are required" }, { status: 400 });
  }

  const apiKey = Netlify.env.get("RESEND_API_KEY");
  const fromEmail = Netlify.env.get("ATTENDANCE_FROM_EMAIL");
  if (!apiKey || !fromEmail) {
    return Response.json(
      { success: false, configured: false, error: "Email delivery is not configured for this site." },
      { status: 503 },
    );
  }

  const reason = payload.reason || "Attendance status update";
  const subject = `Attendance notice: ${payload.studentName} — ${payload.date}`;
  const text = [
    "Hello Parent/Guardian,",
    "",
    "This is an automated attendance update.",
    `Student: ${payload.studentName}`,
    `Roll number: ${payload.rollNumber || "N/A"}`,
    `Class: ${payload.className || "N/A"}`,
    `Date: ${payload.date}`,
    `Reason: ${reason}`,
    "",
    "Please contact the class administration office if this record needs attention.",
  ].join("\n");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: fromEmail, to: [payload.parentEmail], subject, text }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return Response.json({ success: false, error: errorText || "Email provider rejected the message" }, { status: 502 });
  }

  return Response.json({ success: true, recipient: payload.parentEmail, subject, sentAt: new Date().toISOString() });
};
