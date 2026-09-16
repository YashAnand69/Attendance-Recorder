import { GoogleGenAI } from "@google/genai";

export default async (request: Request) => {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const apiKey = Netlify.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    return Response.json({ success: false, configured: false, error: "Gemini is not configured for this site." }, { status: 503 });
  }

  try {
    const { logs, students, month } = await request.json();
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `You are an educational attendance analyst. Analyze this class data for ${month || "the selected month"} and return JSON only with overallAttendancePercentage, lowAttendanceStudents, keyInsights, and administrativeActionItems. Students: ${JSON.stringify(students || [])}. Logs: ${JSON.stringify(logs || [])}.`,
      config: { responseMimeType: "application/json", temperature: 0.1 },
    });
    return Response.json({ success: true, insights: JSON.parse(response.text || "{}") });
  } catch (error) {
    return Response.json({ success: false, error: error instanceof Error ? error.message : "AI analysis failed" }, { status: 502 });
  }
};
