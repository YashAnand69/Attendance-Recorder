import { GoogleGenAI } from "@google/genai";

import { guard } from './_shared/auth';
export default async (request: Request) => {
  const denied = guard(request);
  if (denied) return denied;
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const apiKey = Netlify.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    return Response.json({ success: false, configured: false, error: "Gemini is not configured for this site." }, { status: 503 });
  }

  try {
    const { logs, students, month } = await request.json();
    const safeStudents = (Array.isArray(students) ? students : []).map(({id,name})=>({id,name}));
    const safeLogs = (Array.isArray(logs) ? logs : []).map(({studentId,date,status})=>({studentId,date,status}));
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `You are an educational attendance analyst. Analyze this class data for ${month || "the selected month"} and return JSON only with overallAttendancePercentage, lowAttendanceStudents, keyInsights, and administrativeActionItems. Students: ${JSON.stringify(safeStudents)}. Logs: ${JSON.stringify(safeLogs)}.`,
      config: { responseMimeType: "application/json", temperature: 0.1 },
    });
    return Response.json({ success: true, insights: JSON.parse(response.text || "{}") });
  } catch (error) {
    return Response.json({ success: false, error: error instanceof Error ? error.message : "AI analysis failed" }, { status: 502 });
  }
};
