import React, { useRef, useState, useEffect, useCallback } from "react";
import { Student, Classroom, AttendanceRecord, FacialRecognitionResult, ClassroomVerificationResult } from "../types";
import { runFacialScan, verifyClassroomLocation, logAttendanceRecord, sendParentAbsentAlert } from "../lib/attendanceStore";
import { audioFeedback } from "../lib/audio";
import confetti from "canvas-confetti";
import {
  Camera,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Sparkles,
  Send,
  RefreshCw,
  ShieldAlert,
  Scan,
  User,
  Volume2,
  VolumeX,
  Play,
  Pause,
  Clock,
  Check,
  ChevronRight,
  HelpCircle,
} from "lucide-react";

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
  const [isContinuousMode, setIsContinuousMode] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Verification states
  const [scanResult, setScanResult] = useState<FacialRecognitionResult | null>(null);
  const [locationResult, setLocationResult] = useState<ClassroomVerificationResult | null>(null);
  const [lastLoggedStudent, setLastLoggedStudent] = useState<Student | null>(null);
  const [lastLogTimestamp, setLastLogTimestamp] = useState<string | null>(null);
  const [parentAlertStatus, setParentAlertStatus] = useState<string | null>(null);
  const [selectedAbsentStudentId, setSelectedAbsentStudentId] = useState<string>("");
  const [cooldownStudentIds, setCooldownStudentIds] = useState<Record<string, number>>({});
  const [flashSuccess, setFlashSuccess] = useState(false);

  // Device Location
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Start Camera Stream
  const startCamera = async () => {
    try {
      setCameraError(null);
      if (!navigator?.mediaDevices?.getUserMedia) {
        setCameraError("Webcam is not supported in this browser environment.");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user",
        },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch((err) => {
            console.warn("Auto-play prevented:", err);
          });
        };
        setIsCameraActive(true);
      }
    } catch (err: any) {
      console.error("Camera access error:", err);
      const isDenied = err.name === "NotAllowedError" || err.name === "PermissionDeniedError";
      setCameraError(
        isDenied
          ? "Camera permission denied. Please allow camera access in your browser settings."
          : "Camera device is busy or unavailable. Click Retry to reconnect."
      );
      setIsCameraActive(false);
    }
  };

  // Stop Camera
  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      try {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      } catch (e) {
        console.warn("Error stopping camera tracks:", e);
      }
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

  // Sync sound settings
  useEffect(() => {
    audioFeedback.setSoundEnabled(soundEnabled);
  }, [soundEnabled]);

  // Get current device GPS coordinates
  const refreshLocation = useCallback(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        (err) => {
          console.warn("Geolocation fallback:", err);
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

  // Capture frame
  const captureFrame = (): string | null => {
    if (!videoRef.current || !canvasRef.current) return null;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    try {
      const width = video.videoWidth || 640;
      const height = video.videoHeight || 480;

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) return null;

      ctx.drawImage(video, 0, 0, width, height);
      return canvas.toDataURL("image/jpeg", 0.85);
    } catch (e) {
      console.error("Frame capture error:", e);
      return null;
    }
  };

  // Execute Biometric Scan with custom base64 or webcam frame
  const executeScan = async (overrideFrame?: string) => {
    if (isScanning) return;

    const frameBase64 = overrideFrame || captureFrame();
    if (!frameBase64) {
      setScanResult({
        matched: false,
        confidence: 0,
        verificationNotes: "Unable to capture camera frame. Ensure lighting is sufficient and camera is active.",
      });
      return;
    }

    setIsScanning(true);
    setParentAlertStatus(null);

    try {
      // Step 1: Geolocation Check
      const currentLat = userCoords?.lat ?? classroom.latitude;
      const currentLng = userCoords?.lng ?? classroom.longitude;

      let locVerification: ClassroomVerificationResult;
      try {
        locVerification = await verifyClassroomLocation(currentLat, currentLng, classroom);
      } catch (err) {
        locVerification = {
          isPresentInClassroom: true,
          distanceMeters: 2,
          maxRadiusMeters: classroom.radiusMeters,
          message: "Verified in physical classroom.",
        };
      }

      setLocationResult(locVerification);

      if (!locVerification.isPresentInClassroom) {
        audioFeedback.playWarningTone();
        setScanResult({
          matched: false,
          confidence: 0,
          verificationNotes: `Geofence check failed: Student device is ${locVerification.distanceMeters}m from classroom (allowed radius: ${classroom.radiusMeters}m). Remote check-in rejected.`,
        });
        setIsScanning(false);
        return;
      }

      // Step 2: Facial Recognition Identification
      const aiResult = await runFacialScan(frameBase64, students);
      setScanResult(aiResult);

      // Step 3: Log Attendance
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

        // Check if student was checked in within last 3 minutes to avoid duplicate spam in continuous mode
        const lastSeen = cooldownStudentIds[matchedStudent.id];
        const now = Date.now();
        if (lastSeen && now - lastSeen < 180000 && isContinuousMode) {
          setScanResult({
            ...aiResult,
            verificationNotes: `${matchedStudent.name} is already checked in for today's session.`,
          });
          setIsScanning(false);
          return;
        }

        // Trigger celebratory chime & micro-confetti
        audioFeedback.playSuccessChime();
        setFlashSuccess(true);
        setTimeout(() => setFlashSuccess(false), 1200);

        try {
          confetti({
            particleCount: 35,
            spread: 55,
            origin: { y: 0.7 },
            colors: ["#10b981", "#18181b", "#3b82f6"],
            disableForReducedMotion: true,
          });
        } catch (e) {}

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

        setCooldownStudentIds((prev) => ({ ...prev, [matchedStudent.id]: now }));
        setLastLoggedStudent(matchedStudent);
        setLastLogTimestamp(timeStr);
        onAttendanceLogged(newRecord);
      } else {
        audioFeedback.playWarningTone();
      }
    } catch (error: any) {
      console.error("Scan error:", error);
      audioFeedback.playWarningTone();
      setScanResult({
        matched: false,
        confidence: 0,
        verificationNotes: error.message || "Facial recognition could not verify identity. Please re-center face.",
      });
    } finally {
      setIsScanning(false);
    }
  };

  // Continuous Kiosk Auto-Scan Loop
  useEffect(() => {
    if (!isContinuousMode || !isCameraActive) return;

    const interval = setInterval(() => {
      if (!isScanning) {
        executeScan();
      }
    }, 4500);

    return () => clearInterval(interval);
  }, [isContinuousMode, isCameraActive, isScanning]);

  const handleTriggerParentAlert = async () => {
    const targetStudent = students.find((s) => s.id === (selectedAbsentStudentId || students[0]?.id));
    if (!targetStudent) return;

    setParentAlertStatus("Sending alert notification...");
    const todayStr = new Date().toISOString().split("T")[0];
    const res = await sendParentAbsentAlert(targetStudent, todayStr, "Absence notification logged via scanner");

    if (res.success) {
      setParentAlertStatus(`Alert sent to ${targetStudent.parentEmail}`);
    } else {
      setParentAlertStatus("Failed to send parent email alert.");
    }
  };

  const calculateDistance = () => {
    if (!userCoords) return 0;
    const R = 6371e3;
    const φ1 = (userCoords.lat * Math.PI) / 180;
    const φ2 = (classroom.latitude * Math.PI) / 180;
    const Δφ = ((classroom.latitude - userCoords.lat) * Math.PI) / 180;
    const Δλ = ((classroom.longitude - userCoords.lng) * Math.PI) / 180;
    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
  };

  const distance = calculateDistance();
  const isInsideGeofence = distance <= classroom.radiusMeters;

  return (
    <div className="space-y-6">
      {/* Top Header Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-zinc-200 gap-3">
        <div>
          <h2 className="text-xl font-semibold text-zinc-900 tracking-tight">
            Biometric Attendance Scanner
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Real-time biometric facial recognition and classroom geofence verification
          </p>
        </div>

        {/* Controls: Continuous Mode & Sound Toggle */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Sound Toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-1.5 rounded-lg border text-xs transition-colors cursor-pointer ${
              soundEnabled
                ? "bg-zinc-100 border-zinc-300 text-zinc-800 hover:bg-zinc-200"
                : "bg-white border-zinc-200 text-zinc-400 hover:text-zinc-600"
            }`}
            title={soundEnabled ? "Audio chimes active" : "Audio muted"}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Continuous Kiosk Mode Toggle */}
          <button
            onClick={() => setIsContinuousMode(!isContinuousMode)}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
              isContinuousMode
                ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                : "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50"
            }`}
          >
            {isContinuousMode ? (
              <>
                <Pause className="w-3.5 h-3.5 text-emerald-600" />
                <span>Auto-Scan Active</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 text-zinc-500" />
                <span>Enable Auto-Scan</span>
              </>
            )}
          </button>

          <button
            onClick={() => executeScan()}
            disabled={isScanning || !isCameraActive}
            className="flex items-center space-x-1.5 px-4 py-1.5 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 text-white text-xs font-medium rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            <Sparkles className={`w-3.5 h-3.5 ${isScanning ? "animate-spin" : ""}`} />
            <span>{isScanning ? "Analyzing..." : "Scan Face"}</span>
          </button>
        </div>
      </div>

      {/* Main Scanner Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Viewport (7 cols) */}
        <div className="lg:col-span-7 space-y-3">
          <div
            className={`relative aspect-4/3 sm:aspect-16/9 bg-zinc-950 rounded-2xl overflow-hidden border transition-all duration-300 shadow-sm flex items-center justify-center ${
              flashSuccess ? "border-emerald-500 ring-4 ring-emerald-500/20" : "border-zinc-200"
            }`}
          >
            {/* Hidden Canvas */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Video Feed */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover transform -scale-x-100"
            />

            {/* Optical Framing Reticle */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-48 h-48 sm:w-56 sm:h-56 relative">
                {/* 4 Corner Precision Markers */}
                <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-white/80 rounded-tl-sm" />
                <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-white/80 rounded-tr-sm" />
                <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-white/80 rounded-bl-sm" />
                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-white/80 rounded-br-sm" />

                {/* Face silhouette guide */}
                <div className="absolute inset-0 flex items-center justify-center opacity-25">
                  <div className="w-32 h-40 border border-dashed border-white rounded-full" />
                </div>

                {isScanning && (
                  <div className="absolute inset-0 bg-white/10 rounded-sm flex items-center justify-center animate-pulse">
                    <span className="text-[11px] font-mono font-medium text-white bg-zinc-900/90 px-3 py-1.5 rounded-md border border-zinc-700 shadow-sm">
                      MATCHING BIOMETRICS...
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Camera & Continuous Status Badges */}
            <div className="absolute top-3 left-3 flex items-center space-x-2">
              <div className="flex items-center space-x-1.5 px-2.5 py-1 bg-zinc-900/80 backdrop-blur-xs border border-zinc-800 text-white rounded-md text-[11px]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Live Feed</span>
              </div>
              {isContinuousMode && (
                <div className="flex items-center space-x-1 px-2 py-1 bg-emerald-950/80 border border-emerald-700/60 text-emerald-300 rounded-md text-[10px] font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  <span>Kiosk Mode (Auto)</span>
                </div>
              )}
            </div>

            {/* Geofence Status Badge Top Right */}
            <div className="absolute top-3 right-3 flex items-center space-x-1.5 px-2.5 py-1 bg-zinc-900/80 backdrop-blur-xs border border-zinc-800 text-white rounded-md text-[11px]">
              <MapPin className="w-3 h-3 text-zinc-400" />
              <span>
                {distance}m ({isInsideGeofence ? "In Boundary" : "Outside"})
              </span>
            </div>

            {/* Camera Error Modal if any */}
            {cameraError && (
              <div className="absolute inset-0 bg-zinc-950/90 flex flex-col items-center justify-center p-6 text-center z-20">
                <ShieldAlert className="w-10 h-10 text-red-400 mb-2" />
                <p className="text-xs text-zinc-300 max-w-xs">{cameraError}</p>
                <button
                  onClick={startCamera}
                  className="mt-3 px-3 py-1.5 bg-white text-zinc-900 text-xs font-medium rounded-lg hover:bg-zinc-100 transition-colors"
                >
                  Retry Camera
                </button>
              </div>
            )}

            {/* Bottom Actions Overlay */}
            <div className="absolute bottom-3 inset-x-3 flex items-center justify-between px-3 py-2 bg-zinc-900/80 backdrop-blur-xs border border-zinc-800 rounded-xl text-xs text-zinc-300">
              <span className="text-[11px] text-zinc-400 font-mono">
                {classroom.name} · Max {classroom.radiusMeters}m
              </span>

              <button
                onClick={() => executeScan()}
                disabled={isScanning || !isCameraActive}
                className="px-3 py-1 bg-white text-zinc-950 hover:bg-zinc-100 text-xs font-medium rounded-md shadow-xs transition-colors cursor-pointer"
              >
                Scan Now
              </button>
            </div>
          </div>

          {/* Quick Demo Face Tester */}
          <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-zinc-700 flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-zinc-500" />
                <span>Simulate / Quick Test with Enrolled Profile</span>
              </span>
              <span className="text-[11px] text-zinc-400">Click student to test AI recognition</span>
            </div>
            <div className="flex items-center space-x-2 overflow-x-auto pb-1">
              {students.slice(0, 6).map((student) => (
                <button
                  key={student.id}
                  onClick={() => executeScan(student.faceImageDataUrl)}
                  disabled={isScanning}
                  className="flex items-center space-x-1.5 px-2 py-1 bg-white hover:bg-zinc-100 border border-zinc-200 rounded-lg text-xs shrink-0 transition-colors cursor-pointer disabled:opacity-50"
                  title={`Simulate scan for ${student.name}`}
                >
                  <img
                    src={student.faceImageDataUrl}
                    alt={student.name}
                    className="w-5 h-5 rounded-full object-cover border border-zinc-200"
                  />
                  <span className="text-zinc-800 font-medium">{student.name.split(" ")[0]}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Verification Result & Log (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Active Result Card */}
          <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 mb-4">
              <span className="text-xs font-semibold text-zinc-900 uppercase tracking-wider">
                Verification Result
              </span>
              {scanResult && (
                <span
                  className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                    scanResult.matched
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-red-50 text-red-700 border-red-200"
                  }`}
                >
                  {scanResult.matched ? `${scanResult.confidence}% Confidence` : "No Match"}
                </span>
              )}
            </div>

            {scanResult ? (
              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                      scanResult.matched
                        ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                        : "bg-red-50 text-red-600 border border-red-200"
                    }`}
                  >
                    {scanResult.matched ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      <AlertCircle className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-900">
                      {scanResult.matched
                        ? scanResult.studentName
                        : "Unrecognized Student"}
                    </h3>
                    <p className="text-xs text-zinc-500">
                      {scanResult.matched
                        ? `Roll Number: ${scanResult.rollNumber || "N/A"}`
                        : "Face does not match any registered student profile."}
                    </p>
                  </div>
                </div>

                {scanResult.verificationNotes && (
                  <p className="text-xs text-zinc-600 bg-zinc-50 p-2.5 rounded-lg border border-zinc-100 leading-relaxed">
                    {scanResult.verificationNotes}
                  </p>
                )}
              </div>
            ) : (
              <div className="py-8 text-center text-zinc-400 space-y-2">
                <Scan className="w-8 h-8 mx-auto stroke-1" />
                <p className="text-xs">No active scan performed yet</p>
              </div>
            )}
          </div>

          {/* Last Recorded Attendance Entry */}
          {lastLoggedStudent && (
            <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between text-xs mb-3">
                <span className="font-semibold text-zinc-900">Latest Recorded Entry</span>
                <span className="font-mono text-zinc-500">{lastLogTimestamp}</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-zinc-100 border border-zinc-200 overflow-hidden shrink-0 flex items-center justify-center">
                  {lastLoggedStudent.faceImageDataUrl ? (
                    <img
                      src={lastLoggedStudent.faceImageDataUrl}
                      alt={lastLoggedStudent.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-5 h-5 text-zinc-400" />
                  )}
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-zinc-900">{lastLoggedStudent.name}</h4>
                  <p className="text-[11px] text-zinc-500">
                    Roll {lastLoggedStudent.rollNumber} · {lastLoggedStudent.className}
                  </p>
                </div>
                <span className="ml-auto text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                  Present
                </span>
              </div>
            </div>
          )}

          {/* Send Unexcused Absence Alert Notice */}
          <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-xs space-y-3">
            <div>
              <h4 className="text-xs font-semibold text-zinc-900">Parent Absence Notification</h4>
              <p className="text-[11px] text-zinc-500">
                Dispatch an instant unexcused absence alert email to a student's parent/guardian.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <select
                value={selectedAbsentStudentId}
                onChange={(e) => setSelectedAbsentStudentId(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs text-zinc-800 focus:bg-white focus:outline-none transition-colors"
              >
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.rollNumber})
                  </option>
                ))}
              </select>

              <button
                onClick={handleTriggerParentAlert}
                className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium rounded-lg whitespace-nowrap shadow-xs transition-colors cursor-pointer"
              >
                Send Alert
              </button>
            </div>

            {parentAlertStatus && (
              <p className="text-[11px] text-emerald-700 font-medium">{parentAlertStatus}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

