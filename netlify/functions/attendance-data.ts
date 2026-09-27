import { getStore } from "@netlify/blobs";
import type { Config } from "@netlify/functions";
import { createAttendanceHandler } from "../../server/attendance-handler.js";
export default createAttendanceHandler(() => getStore({name: "attendly-attendance", consistency: "strong"}));
export const config: Config = {path: "/api/attendance-data", method: ["GET", "POST"]};
