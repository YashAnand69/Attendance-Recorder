import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";

dotenv.config();

const app = express();
const PORT = 3000;

// Increase payload limit for base64 camera image uploads
app.use(express.json({ limit: "25mb" }));

// Initialize Gemini Client
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is missing.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
};

// Haversine formula for physical distance verification
function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

// -------------------------------------------------------------
// API Route 1: Geolocation Physical Classroom Verification
// -------------------------------------------------------------
app.post("/api/verify-classroom-location", (req, res) => {
  try {
    const { userLat, userLng, classLat, classLng, maxRadiusMeters = 50 } = req.body;

    if (
      userLat === undefined ||
      userLng === undefined ||
      classLat === undefined ||
      classLng === undefined
    ) {
      return res.status(400).json({
        error: "Missing geolocation coordinates (userLat, userLng, classLat, classLng required).",
      });
    }

    const distanceMeters = calculateHaversineDistance(
      Number(userLat),
      Number(userLng),
      Number(classLat),
      Number(classLng)
    );

    const isPresentInClassroom = distanceMeters <= Number(maxRadiusMeters);

    return res.json({
      isPresentInClassroom,
      distanceMeters: Math.round(distanceMeters * 10) / 10,
      maxRadiusMeters: Number(maxRadiusMeters),
      message: isPresentInClassroom
        ? `Location verified within classroom boundary (${Math.round(distanceMeters)}m away).`
        : `Physical presence check failed. Student is ${Math.round(distanceMeters)}m away from class (max allowed: ${maxRadiusMeters}m). Remote attendance blocked.`,
    });
  } catch (error: any) {
    console.error("Location verification error:", error);
    return res.status(500).json({ error: error.message || "Failed to verify location" });
  }
});

// -------------------------------------------------------------
// API Route 2: Facial Recognition Identification Engine
// -------------------------------------------------------------
app.post("/api/facial-recognition", async (req, res) => {
  try {
    const { captureBase64, studentsCandidates } = req.body;

    if (!captureBase64) {
      return res.status(400).json({ error: "Missing camera capture frame (captureBase64)." });
    }

    if (!studentsCandidates || !Array.isArray(studentsCandidates) || studentsCandidates.length === 0) {
      return res.status(400).json({
        error: "No student profiles registered in system for facial comparison.",
      });
    }

    // Clean image base64 strings
    let cleanCapture = captureBase64.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "");
    let captureMimeType = "image/jpeg";
    const captureMimeMatch = captureBase64.match(/^data:(image\/[a-zA-Z+]+);base64,/);
    if (captureMimeMatch) {
      captureMimeType = captureMimeMatch[1];
    }

    let promptText = `You are a high-precision facial recognition security & attendance AI system.
You are given a LIVE CAMERA SCAN FRAME (Image 1) and a list of registered student profile faces.
Analyze the primary human face present in Image 1 and compare its facial features against the registered candidate faces below.

REGISTERED STUDENT CANDIDATES:
`;

    // Filter valid candidate profiles
    const candidatesToCompare = studentsCandidates.slice(0, 20);

    const imageParts: any[] = [
      {
        inlineData: {
          mimeType: captureMimeType.includes("png") ? "image/png" : "image/jpeg",
          data: cleanCapture,
        },
      },
    ];

    let imgIndex = 2; // Image 1 is live frame

    candidatesToCompare.forEach((student: any) => {
      const rawImg = student.faceImageDataUrl || "";
      const mimeMatch = rawImg.match(/^data:(image\/[a-zA-Z+]+);base64,(.*)$/);
      let studentMime = "image/jpeg";
      let studentBase64 = "";

      if (mimeMatch) {
        studentMime = mimeMatch[1];
        studentBase64 = mimeMatch[2];
      } else {
        studentBase64 = rawImg.replace(/^data:image\/(png|jpeg|jpg|webp|svg\+xml);base64,/, "");
      }

      if (studentBase64) {
        if (studentMime.includes("svg")) {
          promptText += `\nCandidate ID: "${student.id}"
Name: "${student.name}"
Roll Number: "${student.rollNumber}"
Class: "${student.className}"
Photo Reference: (Graphic Avatar for ${student.name})
`;
        } else {
          promptText += `\nCandidate ID: "${student.id}"
Name: "${student.name}"
Roll Number: "${student.rollNumber}"
Class: "${student.className}"
Photo Reference: (Image #${imgIndex})
`;
          imageParts.push({
            inlineData: {
              mimeType: studentMime.includes("png") ? "image/png" : "image/jpeg",
              data: studentBase64,
            },
          });
          imgIndex++;
        }
      }
    });

    promptText += `\nINSTRUCTIONS:
1. Carefully compare facial structure, eyes, nose, mouth, jawline, and features of the main person in Image 1 against each Candidate Photo Reference.
2. Determine if the person in Image 1 matches ANY candidate with high confidence (>= 60%).
3. If matched, return "matched": true, with studentId, studentName, rollNumber, className, and confidence score.
4. If NO student matches or no human face is detected, return "matched": false, "studentId": null, "confidence": 0.
5. Return ONLY a pure JSON object:
{
  "matched": boolean,
  "confidence": number,
  "studentId": string or null,
  "studentName": string or null,
  "rollNumber": string or null,
  "className": string or null,
  "boundingBox": [ymin, xmin, ymax, xmax] or null,
  "verificationNotes": string
}`;

    const contents = [
      { text: promptText },
      ...imageParts
    ];

    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents,
      config: {
        temperature: 0.1, // Low temperature for consistent, strict biometric matching
        responseMimeType: "application/json",
      },
    });

    const responseText = response.text || "{}";
    let matchResult;
    try {
      matchResult = JSON.parse(responseText);
    } catch (e) {
      // Fallback clean extraction if markdown enclosed
      const cleaned = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
      matchResult = JSON.parse(cleaned);
    }

    return res.json({
      success: true,
      result: matchResult,
      scannedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Facial recognition AI error:", error);
    return res.status(500).json({
      error: error.message || "Failed to process facial recognition scan.",
    });
  }
});

// -------------------------------------------------------------
// API Route 3: Send Parent Automated Absent Alert
// -------------------------------------------------------------
app.post("/api/send-parent-alert", async (req, res) => {
  try {
    const { studentName, rollNumber, className, parentEmail, date, reason = "Unexcused Absence" } = req.body;

    if (!studentName || !parentEmail || !date) {
      return res.status(400).json({ error: "Missing required fields (studentName, parentEmail, date)." });
    }

    const emailSubject = `⚠️ Attendance Notice: ${studentName} Marked Absent on ${date}`;
    const emailBody = `Dear Parent/Guardian,

This is an automated notification from the Smart Attendance System.

Student Name: ${studentName}
Roll Number: ${rollNumber || "N/A"}
Class: ${className || "N/A"}
Date: ${date}
Status: ABSENT (${reason})

Our facial recognition classroom scanner logged zero physical presence during today's attendance session. If this absence is excused, please contact the class administration office immediately.

Best regards,
Academic Administration & Attendance Department`;

    // Simulated email dispatch log with success status
    console.log(`[PARENT ALERT EMAIL SENT] To: ${parentEmail} | Subject: ${emailSubject}`);

    return res.json({
      success: true,
      sentAt: new Date().toISOString(),
      recipient: parentEmail,
      subject: emailSubject,
      preview: emailBody,
      message: `Automated alert email successfully dispatched to ${parentEmail}.`,
    });
  } catch (error: any) {
    console.error("Parent alert dispatch error:", error);
    return res.status(500).json({ error: error.message || "Failed to send parent alert email." });
  }
});

// -------------------------------------------------------------
// API Route 4: AI Monthly Attendance Analytics & Insights
// -------------------------------------------------------------
app.post("/api/ai-attendance-insights", async (req, res) => {
  try {
    const { logs, students, month } = req.body;

    const ai = getGeminiClient();
    const prompt = `You are an educational analytics expert. Analyze this classroom attendance data for ${month || "the current month"}:

STUDENT COUNT: ${students?.length || 0}
TOTAL ATTENDANCE LOGS: ${logs?.length || 0}
SUMMARY DATA:
Students: ${JSON.stringify(students?.map((s: any) => ({ id: s.id, name: s.name, rollNumber: s.rollNumber, class: s.className })))}
Logs Sample: ${JSON.stringify(logs?.slice(0, 30))}

Produce a comprehensive JSON output with:
1. overallAttendancePercentage (number 0-100)
2. lowAttendanceStudents: list of objects { studentName, percentage, totalClasses, presentCount, status: 'At Risk' | 'Critical' }
3. keyInsights: list of 3-4 bullet points analyzing trends, day patterns, and physical presence compliance
4. administrativeActionItems: list of 3 recommended actions for teachers/admins
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    return res.json({ success: true, insights: parsed });
  } catch (error: any) {
    console.error("AI Insights error:", error);
    return res.status(500).json({ error: error.message || "Failed to generate AI attendance insights." });
  }
});

// -------------------------------------------------------------
// Vite Server Integration
// -------------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
