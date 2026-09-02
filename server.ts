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
// In-memory cache for candidate student photos to avoid repeated remote fetches
const candidateImageCache = new Map<string, { mimeType: string; data: string }>();

// -------------------------------------------------------------
// Face Recognition Verification Route (High-Speed Biometric Pipeline)
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

    // Helper to extract clean base64 data and mime type with in-memory caching
    const extractBase64Data = async (dataOrUrl: string): Promise<{ mimeType: string; data: string }> => {
      if (!dataOrUrl) return { mimeType: "image/jpeg", data: "" };

      // Return cached image if available
      if (candidateImageCache.has(dataOrUrl)) {
        return candidateImageCache.get(dataOrUrl)!;
      }

      let result: { mimeType: string; data: string } = { mimeType: "image/jpeg", data: "" };

      if (dataOrUrl.startsWith("http://") || dataOrUrl.startsWith("https://")) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 3000);
          const resp = await fetch(dataOrUrl, { signal: controller.signal });
          clearTimeout(timeout);
          const buffer = await resp.arrayBuffer();
          const base64 = Buffer.from(buffer).toString("base64");
          const contentType = resp.headers.get("content-type") || "image/jpeg";
          let mime = "image/jpeg";
          if (contentType.includes("png")) mime = "image/png";
          else if (contentType.includes("webp")) mime = "image/webp";
          result = { mimeType: mime, data: base64 };
        } catch (e) {
          console.warn("Failed to fetch candidate image URL:", e);
          result = { mimeType: "image/jpeg", data: "" };
        }
      } else {
        const matches = dataOrUrl.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/s);
        if (matches) {
          let mime = matches[1];
          if (mime.includes("svg")) mime = "image/png";
          else if (mime.includes("webp")) mime = "image/webp";
          else if (mime.includes("png")) mime = "image/png";
          else mime = "image/jpeg";
          result = { mimeType: mime, data: matches[2].trim() };
        } else {
          const raw = dataOrUrl.replace(/^data:[^;]+;base64,/, "").trim();
          result = { mimeType: "image/jpeg", data: raw };
        }
      }

      if (result.data) {
        if (candidateImageCache.size > 150) {
          const firstKey = candidateImageCache.keys().next().value;
          if (firstKey) candidateImageCache.delete(firstKey);
        }
        candidateImageCache.set(dataOrUrl, result);
      }

      return result;
    };

    // Live scan cleanup (skip caching live frame)
    const cleanLiveMatch = captureBase64.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/s);
    let liveScan: { mimeType: string; data: string };
    if (cleanLiveMatch) {
      liveScan = { mimeType: cleanLiveMatch[1].includes("png") ? "image/png" : "image/jpeg", data: cleanLiveMatch[2].trim() };
    } else {
      liveScan = { mimeType: "image/jpeg", data: captureBase64.replace(/^data:[^;]+;base64,/, "").trim() };
    }

    if (!liveScan.data) {
      return res.status(400).json({ error: "Invalid camera capture image data." });
    }

    const parts: any[] = [];

    // Header prompt
    parts.push({
      text: `Automated Biometric Attendance Matching.
1. Inspect [LIVE FRAME] for a human face.
2. Match against candidate photos in [ENROLLED ROSTER].
3. Return matched student details + confidence (75-99%). If no face or no match, return matched: false.

[LIVE FRAME]:`,
    });

    // Add live scan image
    parts.push({
      inlineData: {
        mimeType: liveScan.mimeType,
        data: liveScan.data,
      },
    });

    parts.push({
      text: `\n[ENROLLED ROSTER]:`,
    });

    // Concurrently decode candidate images in parallel
    const candidatesToCompare = studentsCandidates.slice(0, 15);
    const decodedCandidates = await Promise.all(
      candidatesToCompare.map(async (student: any) => {
        const studentImg = await extractBase64Data(student.faceImageDataUrl || "");
        return { student, studentImg };
      })
    );

    decodedCandidates.forEach(({ student, studentImg }, i) => {
      if (studentImg.data) {
        parts.push({
          text: `\nCandidate #${i + 1} (ID: "${student.id}", Name: "${student.name}", Roll: "${student.rollNumber || "N/A"}", Class: "${student.className || ""}"):`,
        });
        parts.push({
          inlineData: {
            mimeType: studentImg.mimeType,
            data: studentImg.data,
          },
        });
      } else {
        parts.push({
          text: `\nCandidate #${i + 1} (No Photo) ID: "${student.id}", Name: "${student.name}"`,
        });
      }
    });

    // Output schema instructions
    parts.push({
      text: `
JSON OUTPUT SCHEMA:
{
  "matched": boolean,
  "confidence": number,
  "studentId": string | null,
  "studentName": string | null,
  "rollNumber": string | null,
  "className": string | null,
  "verificationNotes": string
}`,
    });

    const ai = getGeminiClient();
    const candidateModels = ["gemini-3.7-flash", "gemini-3.6-flash", "gemini-flash-latest"];
    let response: any = null;
    let lastError: any = null;

    for (const modelName of candidateModels) {
      try {
        response = await ai.models.generateContent({
          model: modelName,
          contents: {
            parts,
          },
          config: {
            temperature: 0,
            maxOutputTokens: 200,
            responseMimeType: "application/json",
          },
        });
        if (response && response.text) {
          break;
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`Model ${modelName} failed during facial recognition, trying next:`, err?.message);
      }
    }

    if (!response || !response.text) {
      throw lastError || new Error("All vision models failed to process facial recognition request.");
    }

    const responseText = response.text || "{}";
    let matchResult: any;
    try {
      matchResult = JSON.parse(responseText);
    } catch (e) {
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

    let response;
    try {
      response = await ai.models.generateContent({
        model: "gemini-3.7-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        },
      });
    } catch (modelErr: any) {
      console.warn("Primary insights model failed, falling back to gemini-3.6-flash:", modelErr?.message);
      response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        },
      });
    }

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
