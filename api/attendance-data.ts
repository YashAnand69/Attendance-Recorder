import { createAttendanceHandler } from "../server/attendance-handler.js";
import { vercelStore } from "../server/vercel-store.js";
export default { fetch: createAttendanceHandler(() => vercelStore) };
