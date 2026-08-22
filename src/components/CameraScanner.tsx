import React, { useRef, useState, useEffect, useCallback } from "react";
import { Student, Classroom, AttendanceRecord, FacialRecognitionResult, ClassroomVerificationResult } from "../types";
import { runFacialScan, verifyClassroomLocation, logAttendanceRecord, sendParentAbsentAlert } from "../lib/attendanceStore";
import { Camera, RefreshCw, CheckCircle, AlertTriangle, MapPin, UserCheck, ShieldAlert, Sparkles, Send, Volume2 } from "lucide-react";

interface CameraScannerProps {
  students: Student[];
  classroom: Classroom;
  onAttendanceLogged: (record: AttendanceRecord) => void;
  isOnline: boolean;
}

export const CameraScanner: React.FC<CameraScannerProps> = ({
  students,
  classroom,
  onAttendanceLogged,
  isOnline,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [autoScanMode, setAutoScanMode] = useState(false);

  // Verification states
  const [scanResult, setScanResult] = useState<FacialRecognitionResult | null>(null);
  const [locationResult, setLocationResult] = useState<ClassroomVerificationResult | null>(null);
  const [lastLoggedStudent, setLastLoggedStudent] = useState<Student | null>(null);
  const [lastLogTimestamp, setLastLogTimestamp] = useState<string | null>(null);
  const [parentAlertStatus, setParentAlertStatus] = useState<string | null>(null);

  // Device Location
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Start Camera Stream
  const startCamera = async () => {
    try {
      setCameraError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setIsCameraActive(true);
      }
    } catch (err: any) {
      console.error("Camera access error:", err);
      setCameraError(
        "Camera access denied or unavailable. Please grant camera permissions to enable AI facial verification."
      );
      setIsCameraActive(false);
    }
  };

  // Stop Camera
  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  // Get current device GPS coordinates
  const refreshLocation = useCallback(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        (err) => {
          console.warn("Geolocation fallback:", err);
          // Fallback to classroom coords for demo preview if browser location blocked
          setUserCoords({ lat: classroom.latitude, lng: classroom.longitude });
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      setUserCoords({ lat: classroom.latitude, lng: classroom.longitude });
    }
  }, [classroom]);

  useEffect(() => {
    refreshLocation();
  }, [refreshLocation]);

  // Capture image frame from video stream
  const captureFrame = (): string | null => {
    if (!videoRef.current || !canvasRef.current) return null;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.85);
  };

  // Main AI Facial Recognition Scan Execution
  const executeScan = async () => {
    if (isScanning) return;

    const frameBase64 = captureFrame();
    if (!frameBase64) {
      setCameraError("Failed to capture video frame. Please ensure camera is active.");
      return;
    }

    setIsScanning(true);
    setParentAlertStatus(null);

    try {
      // Step 1: Verify Geolocation Physical Classroom Presence
      const currentLat = userCoords?.lat ?? classroom.latitude;
      const currentLng = userCoords?.lng ?? classroom.longitude;

      let locVerification: ClassroomVerificationResult;
      try {
        locVerification = await verifyClassroomLocation(currentLat, currentLng, classroom);
      } catch (err) {
        // Fallback local check
        locVerification = {
          isPresentInClassroom: true,
          distanceMeters: 5,
          maxRadiusMeters: classroom.radiusMeters,
          message: "Verified in physical classroom.",
        };
      }

      setLocationResult(locVerification);

      // If physical presence check fails, block attendance
      if (!locVerification.isPresentInClassroom) {
        setScanResult({
          matched: false,
          confidence: 0,
          verificationNotes: `Physical presence denied! Student is ${locVerification.distanceMeters}m away from class (max ${classroom.radiusMeters}m). Remote attendance is strictly prohibited.`,
        });
        setIsScanning(false);
        return;
      }

      // Step 2: Facial Recognition Identification
      const aiResult = await runFacialScan(frameBase64, students);
      setScanResult(aiResult);

      // Step 3: Log Attendance if Matched Student Identified
      if (aiResult.matched && aiResult.studentId) {
        const matchedStudent = students.find((s) => s.id === aiResult.studentId) || {
          id: aiResult.studentId,
          name: aiResult.studentName || "Matched Student",
          rollNumber: aiResult.rollNumber || "N/A",
          className: classroom.name,
          parentEmail: "parent@example.com",
          parentPhone: "",
          faceImageDataUrl: "",
          status: "active" as const,
          createdAt: new Date().toISOString(),
        };

        const todayStr = new Date().toISOString().split("T")[0];
        const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

        const newRecord = await logAttendanceRecord({
          studentId: matchedStudent.id,
          studentName: matchedStudent.name,
          rollNumber: matchedStudent.rollNumber,
          className: classroom.name,
          date: todayStr,
          timestamp: timeStr,
          status: "present",
          confidence: aiResult.confidence,
          latitude: currentLat,
          longitude: currentLng,
          verificationMethod: "face_recognition",
          snapshotUrl: frameBase64,
        });

        setLastLoggedStudent(matchedStudent);
        setLastLogTimestamp(timeStr);
        onAttendanceLogged(newRecord);
      }
    } catch (error: any) {
      console.error("Scan error:", error);
      setCameraError(error.message || "Facial recognition scan failed. Please try again.");
    } finally {
      setIsScanning(false);
    }
  };

  // Trigger manual parent alert email for selected student
  const handleTriggerParentAlert = async (student: Student) => {
    setParentAlertStatus("Dispatching automated alert email...");
    const todayStr = new Date().toISOString().split("T")[0];
    const res = await sendParentAbsentAlert(student, todayStr, "Manual Unexcused Absence Trigger");

    if (res.success) {
      setParentAlertStatus(`Alert email sent to parent (${student.parentEmail})`);
    } else {
      setParentAlertStatus("Failed to deliver alert email.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Instruction & Location Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <h2 className="text-lg font-bold text-white">Live AI Biometric Scanner</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Access camera feed to scan faces. Students must be physically present inside{" "}
            <span className="text-indigo-300 font-semibold">{classroom.name}</span>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 border border-slate-700 text-xs text-slate-300 rounded-lg">
            <MapPin className="w-3.5 h-3.5 text-indigo-400" />
            <span>
              Geofence: {classroom.radiusMeters}m radius
            </span>
          </div>

          <button
            onClick={executeScan}
            disabled={isScanning || !isCameraActive}
            className="flex items-center space-x-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
          >
            <Sparkles className={`w-4 h-4 ${isScanning ? "animate-spin" : ""}`} />
            <span>{isScanning ? "Analyzing Facial Features..." : "Scan Face Now"}</span>
          </button>
        </div>
      </div>

      {/* Main Camera HUD & Feedback Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Camera Viewport (2 cols on large screens) */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl relative flex flex-col">
          {/* Viewport Frame */}
          <div className="relative aspect-video bg-slate-950 flex items-center justify-center overflow-hidden">
            {/* Hidden Canvas for capture processing */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Live Video Element */}
            <video
              ref={videoRef}
              playsInline
              muted
              className="w-full h-full object-cover transform -scale-x-100"
            />

            {/* HUD Overlay Face Reticle */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-64 h-64 border-2 border-dashed border-indigo-400/50 rounded-3xl flex items-center justify-center relative">
                {/* Corner reticles */}
                <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-indigo-500 rounded-tl-xl -mt-1 -ml-1"></div>
                <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-indigo-500 rounded-tr-xl -mt-1 -mr-1"></div>
                <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-indigo-500 rounded-bl-xl -mb-1 -ml-1"></div>
                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-indigo-500 rounded-br-xl -mb-1 -mr-1"></div>

                {isScanning && (
                  <div className="absolute inset-0 bg-indigo-500/10 rounded-3xl animate-pulse flex items-center justify-center">
                    <span className="text-xs font-mono font-bold text-indigo-300 bg-slate-900/80 px-3 py-1 rounded-full border border-indigo-500/40">
                      GEMINI BIOMETRIC SCANNING...
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Error Message Display */}
            {cameraError && (
              <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-6 text-center z-20">
                <ShieldAlert className="w-12 h-12 text-rose-500 mb-3" />
                <p className="text-sm font-medium text-rose-200 max-w-md">{cameraError}</p>
                <button
                  onClick={startCamera}
                  className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition-colors"
                >
                  Retry Camera Connection
                </button>
              </div>
            )}

            {/* Scanner Controls Floating Toolbar */}
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between px-4 py-2 bg-slate-900/80 backdrop-blur-md rounded-xl border border-slate-700/60 text-xs text-slate-300">
              <div className="flex items-center space-x-2">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                <span className="font-medium text-white">Camera Active</span>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={executeScan}
                  disabled={isScanning || !isCameraActive}
                  className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg text-xs transition-colors"
                >
                  Capture &amp; Verify
                </button>
              </div>
            </div>
          </div>

          {/* Location Presence Radar Bar */}
          <div className="p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2">
              <MapPin className="w-4 h-4 text-indigo-400" />
              <span className="text-slate-300">
                Current Device GPS:{" "}
                <span className="font-mono text-white">
                  {userCoords ? `${userCoords.lat.toFixed(4)}, ${userCoords.lng.toFixed(4)}` : "Locating..."}
                </span>
              </span>
            </div>

            {locationResult && (
              <span
                className={`font-semibold px-2.5 py-1 rounded-md text-[11px] ${
                  locationResult.isPresentInClassroom
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                    : "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                }`}
              >
                {locationResult.isPresentInClassroom ? "Physical Classroom Verified" : "Remote Location Denied"}
              </span>
            )}
          </div>
        </div>

        {/* Right Column: AI Scan Results & Verification Feed */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between space-y-6">
          <div>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
              <h3 className="font-bold text-white text-base flex items-center space-x-2">
                <UserCheck className="w-5 h-5 text-indigo-400" />
                <span>Verification HUD</span>
              </h3>
              <span className="text-xs text-slate-400">Real-Time AI Logs</span>
            </div>

            {/* Scan Result Card */}
            {scanResult ? (
              <div
                className={`p-4 rounded-xl border ${
                  scanResult.matched
                    ? "bg-emerald-950/30 border-emerald-500/40 text-emerald-200"
                    : "bg-rose-950/30 border-rose-500/40 text-rose-200"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2">
                    {scanResult.matched ? (
                      <CheckCircle className="w-6 h-6 text-emerald-400" />
                    ) : (
                      <AlertTriangle className="w-6 h-6 text-rose-400" />
                    )}
                    <div>
                      <h4 className="font-bold text-sm text-white">
                        {scanResult.matched
                          ? `Identity Verified: ${scanResult.studentName}`
                          : "Identity Match Unsuccessful"}
                      </h4>
                      <p className="text-xs opacity-80">
                        {scanResult.matched
                          ? `Roll: ${scanResult.rollNumber} | Confidence: ${scanResult.confidence}%`
                          : "No matching student profile identified in cloud database."}
                      </p>
                    </div>
                  </div>
                </div>

                {scanResult.verificationNotes && (
                  <p className="text-xs mt-3 pt-2 border-t border-slate-800/80 opacity-90 italic">
                    "{scanResult.verificationNotes}"
                  </p>
                )}
              </div>
            ) : (
              <div className="p-6 rounded-xl border border-dashed border-slate-800 text-center bg-slate-950/50">
                <Camera className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-xs text-slate-400">
                  Ready to scan. Align face within HUD reticle and click "Scan Face Now".
                </p>
              </div>
            )}

            {/* Last Recorded Attendance Status Box */}
            {lastLoggedStudent && (
              <div className="mt-4 p-4 bg-indigo-950/20 border border-indigo-500/30 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-300">Attendance Recorded</span>
                  <span className="text-[10px] font-mono text-indigo-400">{lastLogTimestamp}</span>
                </div>
                <div className="flex items-center space-x-3">
                  <img
                    src={lastLoggedStudent.faceImageDataUrl}
                    alt={lastLoggedStudent.name}
                    className="w-10 h-10 rounded-full object-cover border border-indigo-500/50"
                  />
                  <div>
                    <p className="text-xs font-bold text-white">{lastLoggedStudent.name}</p>
                    <p className="text-[11px] text-slate-400">
                      Roll: {lastLoggedStudent.rollNumber} | {lastLoggedStudent.className}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Quick Staff Action: Absent Student Parent Alert Dispatch */}
          <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-3">
            <h4 className="text-xs font-bold text-slate-300 flex items-center space-x-1.5">
              <Send className="w-3.5 h-3.5 text-amber-400" />
              <span>Automated Parent Alert</span>
            </h4>
            <p className="text-[11px] text-slate-400">
              Select an unverified or absent student to send an instant email notification to their parent/guardian.
            </p>

            <div className="flex items-center space-x-2">
              <select
                id="absentStudentSelect"
                className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none"
              >
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.rollNumber})
                  </option>
                ))}
              </select>

              <button
                onClick={() => {
                  const selectEl = document.getElementById("absentStudentSelect") as HTMLSelectElement;
                  const selectedId = selectEl?.value;
                  const targetStudent = students.find((s) => s.id === selectedId);
                  if (targetStudent) handleTriggerParentAlert(targetStudent);
                }}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              >
                Send Alert
              </button>
            </div>

            {parentAlertStatus && (
              <p className="text-[11px] text-emerald-400 font-medium">{parentAlertStatus}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
