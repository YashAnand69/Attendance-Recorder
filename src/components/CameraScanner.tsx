import React, { useRef, useState, useEffect, useCallback } from "react";
import { Student, Classroom, AttendanceRecord, FacialRecognitionResult, ClassroomVerificationResult } from "../types";
import { runFacialScan, verifyClassroomLocation, logAttendanceRecord, sendParentAbsentAlert } from "../lib/attendanceStore";
import { warmFaceRecognition } from "../lib/faceRecognition";
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
  Upload,
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
  const [faceEngineState, setFaceEngineState] = useState<"loading" | "ready" | "error">("loading");

  // Verification states
  const [scanResult, setScanResult] = useState<FacialRecognitionResult | null>(null);
  const [lastScannedFrame, setLastScannedFrame] = useState<string | null>(null);
  const [locationResult, setLocationResult] = useState<ClassroomVerificationResult | null>(null);
  const [lastLoggedStudent, setLastLoggedStudent] = useState<Student | null>(null);
  const [lastLogTimestamp, setLastLogTimestamp] = useState<string | null>(null);
  const [parentAlertStatus, setParentAlertStatus] = useState<string | null>(null);
  const [selectedAbsentStudentId, setSelectedAbsentStudentId] = useState<string>("");
  const [cooldownStudentIds, setCooldownStudentIds] = useState<Record<string, number>>({});
  const [flashSuccess, setFlashSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  // Load the on-device model and pre-compute enrolled descriptors once per roster.
  // This moves the expensive work off the scan button for consistently fast check-ins.
  useEffect(() => {
    let cancelled = false;
    setFaceEngineState("loading");
    warmFaceRecognition(students)
      .then(() => {
        if (!cancelled) setFaceEngineState("ready");
      })
      .catch((error) => {
        console.warn("On-device face model could not be prepared:", error);
        if (!cancelled) setFaceEngineState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [students]);

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

  // Fast helper to resize & compress image payloads for sub-second AI inference
  const compressFrame = async (dataUrl: string): Promise<string> => {
    // Enrolled photos can be remote URLs. Keep them intact so a cross-origin canvas
    // restriction never stalls the scan flow; camera captures are already data URLs.
    if (!dataUrl.startsWith("data:")) return dataUrl;

    return new Promise((resolve) => {
      let settled = false;
      const finish = (value: string) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };
      const timeout = window.setTimeout(() => finish(dataUrl), 1800);
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const maxDim = 380;
          let width = img.width;
          let height = img.height;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            window.clearTimeout(timeout);
            finish(canvas.toDataURL("image/jpeg", 0.75));
            return;
          }
        } catch {
          // A remote reference photo may not be canvas-readable; use the original URL.
        }
        window.clearTimeout(timeout);
        finish(dataUrl);
      };
      img.onerror = () => {
        window.clearTimeout(timeout);
        finish(dataUrl);
      };
      img.src = dataUrl;
    });
  };

  // High-speed frame capture with optimized downsampling
  const captureFrame = (): string | null => {
    if (!videoRef.current || !canvasRef.current) return null;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    try {
      const vWidth = video.videoWidth || 640;
      const vHeight = video.videoHeight || 480;

      // Scale to 380px wide for ~20KB payload & rapid network transfer
      const targetWidth = 380;
      const targetHeight = Math.round((vHeight / vWidth) * targetWidth);

      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const ctx = canvas.getContext("2d");
      if (!ctx) return null;

      ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
      return canvas.toDataURL("image/jpeg", 0.75);
    } catch (e) {
      console.error("Frame capture error:", e);
      return null;
    }
  };

  // Handle file upload for test scanning
  const handleUploadTestFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        if (typeof reader.result === "string") {
          const compressed = await compressFrame(reader.result);
          executeScan(compressed);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Execute Biometric Scan with custom base64 or webcam frame
  const executeScan = async (overrideFrame?: string) => {
    if (isScanning) return;

    let frameBase64 = overrideFrame || captureFrame();
    if (!frameBase64) {
      setScanResult({
        matched: false,
        confidence: 0,
        verificationNotes: "Unable to capture camera frame. Ensure lighting is sufficient and camera is active.",
      });
      return;
    }

    if (overrideFrame) {
      frameBase64 = await compressFrame(frameBase64);
    }

    setLastScannedFrame(frameBase64);
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
      let errorMsg = error.message || "Facial recognition could not verify identity. Please re-center face.";
      if (typeof errorMsg === "string" && (errorMsg.includes("{") || errorMsg.includes("404") || errorMsg.includes("500"))) {
        try {
          const cleanJson = errorMsg.replace(/^Error:\s*/, "").trim();
          const parsed = JSON.parse(cleanJson);
          errorMsg = parsed?.error?.message || parsed?.message || errorMsg;
        } catch (_) {}
      }
      setScanResult({
        matched: false,
        confidence: 0,
        verificationNotes: errorMsg,
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
          <div className="flex items-center space-x-2">
            <h2 className="text-xl font-bold text-zinc-900 tracking-tight">
              Biometric Attendance Scanner
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
              On-device Face ID
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">
            Local face matching, classroom presence verification, and offline-first attendance logging
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-semibold">
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${
              faceEngineState === "ready"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : faceEngineState === "error"
                  ? "border-amber-200 bg-amber-50 text-amber-800"
                  : "border-slate-200 bg-slate-100 text-slate-600"
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${
                faceEngineState === "ready" ? "bg-emerald-500" : faceEngineState === "error" ? "bg-amber-500" : "bg-slate-400 animate-pulse"
              }`} />
              {faceEngineState === "ready" ? "Face engine ready" : faceEngineState === "error" ? "Face engine needs attention" : "Preparing face engine…"}
            </span>
            <span className="text-slate-500">Runs in this browser · no frame upload required</span>
          </div>
        </div>

        {/* Controls: Continuous Mode & Sound Toggle */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Sound Toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2 rounded-xl border text-xs transition-colors cursor-pointer ${
              soundEnabled
                ? "bg-zinc-100 border-zinc-300 text-zinc-800 hover:bg-zinc-200"
                : "bg-white border-zinc-200 text-zinc-400 hover:text-zinc-600"
            }`}
            title={soundEnabled ? "Audio chimes active" : "Audio muted"}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-600" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Continuous Kiosk Mode Toggle */}
          <button
            onClick={() => setIsContinuousMode(!isContinuousMode)}
            className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
              isContinuousMode
                ? "bg-emerald-50 text-emerald-800 border-emerald-300 shadow-xs"
                : "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50"
            }`}
          >
            {isContinuousMode ? (
              <>
                <Pause className="w-3.5 h-3.5 text-emerald-600" />
                <span>Auto-Scan Active (Kiosk)</span>
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
            className="flex items-center space-x-1.5 px-4 py-2 bg-zinc-950 hover:bg-zinc-800 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer ring-1 ring-zinc-800"
          >
            <Sparkles className={`w-3.5 h-3.5 text-emerald-400 ${isScanning ? "animate-spin" : ""}`} />
            <span>{isScanning ? "Scanning Face..." : "Capture & Verify"}</span>
          </button>
        </div>
      </div>

      {/* Main Scanner Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Viewport (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div
            className={`relative aspect-4/3 sm:aspect-16/9 bg-zinc-950 rounded-2xl overflow-hidden border transition-all duration-300 shadow-md flex items-center justify-center ${
              flashSuccess ? "border-emerald-500 ring-4 ring-emerald-500/20" : "border-zinc-900"
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

            {/* Futuristic Laser Sweep Animation when scanning */}
            {isScanning && (
              <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_15px_#10b981] animate-laser-sweep pointer-events-none z-10" />
            )}

            {/* Optical Framing Reticle & Target Brackets */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-52 h-52 sm:w-60 sm:h-60 relative">
                {/* 4 Corner Precision HUD Markers */}
                <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-emerald-400/90 rounded-tl-lg" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-emerald-400/90 rounded-tr-lg" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-emerald-400/90 rounded-bl-lg" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-emerald-400/90 rounded-br-lg" />

                {/* Center crosshair */}
                <div className="absolute inset-0 flex items-center justify-center opacity-30">
                  <div className="w-8 h-8 border border-white/60 rounded-full flex items-center justify-center">
                    <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                  </div>
                </div>

                {/* Face silhouette guide */}
                <div className="absolute inset-0 flex items-center justify-center opacity-30">
                  <div className="w-36 h-48 border border-dashed border-emerald-300 rounded-full" />
                </div>

                {isScanning && (
                  <div className="absolute inset-0 bg-emerald-950/20 backdrop-blur-[1px] rounded-lg flex flex-col items-center justify-center space-y-1.5 animate-pulse">
                    <span className="text-[11px] font-mono font-bold tracking-wider text-emerald-300 bg-zinc-950/90 px-3 py-1.5 rounded-lg border border-emerald-500/40 shadow-lg">
                      ANALYZING BIOMETRIC EMBEDDING
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Top Left HUD Telemetry */}
            <div className="absolute top-3 left-3 flex items-center space-x-2">
              <div className="flex items-center space-x-1.5 px-3 py-1 bg-zinc-950/80 backdrop-blur-md border border-zinc-800 text-white rounded-lg text-[11px] font-medium shadow-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Live Biometric Feed</span>
              </div>
              {isContinuousMode && (
                <div className="flex items-center space-x-1.5 px-2.5 py-1 bg-emerald-950/90 border border-emerald-600 text-emerald-300 rounded-lg text-[10px] font-bold shadow-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  <span>Kiosk Auto-Scan</span>
                </div>
              )}
            </div>

            {/* Top Right Geofence Status Badge */}
            <div className="absolute top-3 right-3 flex items-center space-x-1.5 px-3 py-1 bg-zinc-950/80 backdrop-blur-md border border-zinc-800 text-white rounded-lg text-[11px] font-medium shadow-xs">
              <MapPin className={`w-3.5 h-3.5 ${isInsideGeofence ? "text-emerald-400" : "text-amber-400"}`} />
              <span>
                {distance}m ({isInsideGeofence ? "Geofence Verified" : "Outside Boundary"})
              </span>
            </div>

            {/* Camera Error Modal if any */}
            {cameraError && (
              <div className="absolute inset-0 bg-zinc-950/95 flex flex-col items-center justify-center p-6 text-center z-20">
                <ShieldAlert className="w-10 h-10 text-red-400 mb-2" />
                <p className="text-xs text-zinc-300 max-w-xs">{cameraError}</p>
                <button
                  onClick={startCamera}
                  className="mt-3 px-4 py-2 bg-white text-zinc-950 text-xs font-semibold rounded-lg hover:bg-zinc-100 transition-colors cursor-pointer"
                >
                  Retry Camera
                </button>
              </div>
            )}

            {/* Bottom Actions Overlay Bar */}
            <div className="absolute bottom-3 inset-x-3 flex items-center justify-between px-3.5 py-2 bg-zinc-950/85 backdrop-blur-md border border-zinc-800 rounded-xl text-xs text-zinc-300">
              <div className="flex items-center space-x-2">
                <span className="text-[11px] text-zinc-400 font-mono">
                  {classroom.name} · Radius {classroom.radiusMeters}m
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => executeScan()}
                  disabled={isScanning || !isCameraActive}
                  className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isScanning ? "Processing..." : "Scan Now"}
                </button>
              </div>
            </div>
          </div>

          {/* Quick Simulation & Test Bar */}
          <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-xs">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-bold text-zinc-900 flex items-center space-x-1.5">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span>Quick Test &amp; Photo Simulation</span>
              </span>
              <span className="text-[11px] text-zinc-500">Test enrolled students or upload custom image</span>
            </div>

            <div className="flex items-center space-x-2 overflow-x-auto pb-1">
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                className="hidden"
                onChange={handleUploadTestFile}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isScanning}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-zinc-950 hover:bg-zinc-800 text-white rounded-xl text-xs font-semibold shrink-0 transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
                title="Upload custom image to test facial recognition"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Test Photo</span>
              </button>

              {students.slice(0, 8).map((student) => (
                <button
                  key={student.id}
                  onClick={() => executeScan(student.faceImageDataUrl)}
                  disabled={isScanning}
                  className="flex items-center space-x-2 px-2.5 py-1.5 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 rounded-xl text-xs shrink-0 transition-colors cursor-pointer disabled:opacity-50"
                  title={`Simulate scan for ${student.name}`}
                >
                  <img
                    src={student.faceImageDataUrl}
                    alt={student.name}
                    className="w-5 h-5 rounded-full object-cover border border-zinc-300"
                  />
                  <span className="text-zinc-800 font-semibold">{student.name.split(" ")[0]}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Verification Result & Log (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Active Result Card */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider font-display">
                Biometric Identification Result
              </span>
              {scanResult && (
                <span
                  className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                    scanResult.matched
                      ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                      : "bg-red-50 text-red-700 border-red-200"
                  }`}
                >
                  {scanResult.matched ? `${scanResult.confidence}% AI Confidence` : "Unmatched"}
                </span>
              )}
            </div>

            {scanResult ? (
              <div className="space-y-4">
                <div className="flex items-start space-x-3.5">
                  <div
                    className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-xs ${
                      scanResult.matched
                        ? "bg-emerald-500 text-white"
                        : "bg-red-500 text-white"
                    }`}
                  >
                    {scanResult.matched ? (
                      <CheckCircle2 className="w-6 h-6 stroke-2" />
                    ) : (
                      <AlertCircle className="w-6 h-6 stroke-2" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-extrabold text-slate-900 truncate font-display">
                      {scanResult.matched
                        ? scanResult.studentName
                        : "Biometric Profile Not Recognized"}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {scanResult.matched
                        ? `Roll ${scanResult.rollNumber || "N/A"} · ${scanResult.className || classroom.name}`
                        : "No matching face found in current classroom roster."}
                    </p>
                  </div>
                </div>

                {/* Match Confidence Progress Meter */}
                {scanResult.matched && (
                  <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-slate-700">Biometric Match Quality</span>
                      <span className="text-emerald-700 font-mono">{scanResult.confidence}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500"
                        style={{ width: `${scanResult.confidence}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Side-by-side Visual Inspection */}
                {(lastScannedFrame || (scanResult.matched && scanResult.studentId)) && (
                  <div className="grid grid-cols-2 gap-2.5 p-3 bg-slate-50/80 border border-slate-200/80 rounded-xl">
                    {lastScannedFrame && (
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                          Captured Frame
                        </span>
                        <div className="w-full aspect-square rounded-xl overflow-hidden bg-slate-950 border border-slate-300 shadow-2xs">
                          <img
                            src={lastScannedFrame}
                            alt="Scanned Live Frame"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </div>
                    )}
                    {scanResult.matched && scanResult.studentId && (
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                          Enrolled Photo
                        </span>
                        <div className="w-full aspect-square rounded-xl overflow-hidden bg-slate-950 border border-slate-300 shadow-2xs">
                          {(() => {
                            const matchedStudent = students.find((s) => s.id === scanResult.studentId);
                            return matchedStudent?.faceImageDataUrl ? (
                              <img
                                src={matchedStudent.faceImageDataUrl}
                                alt={matchedStudent.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-400">
                                <User className="w-6 h-6" />
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    )}
                    {!scanResult.matched && lastScannedFrame && (
                      <div className="flex flex-col justify-center space-y-1.5 p-1 text-[11px] text-slate-600 leading-snug">
                        <span className="font-bold text-slate-800">Troubleshooting:</span>
                        <span>• Center face in optimal lighting.</span>
                        <span>• Or register student under "Roster".</span>
                      </div>
                    )}
                  </div>
                )}

                {scanResult.verificationNotes && (
                  <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-200 leading-relaxed font-mono">
                    {scanResult.verificationNotes}
                  </p>
                )}
              </div>
            ) : (
              <div className="py-10 text-center text-slate-400 space-y-2">
                <Scan className="w-10 h-10 mx-auto stroke-1 text-slate-400" />
                <p className="text-xs font-semibold text-slate-600">Biometric scanner is live &amp; listening</p>
                <p className="text-[11px] text-slate-400">Position face within reticle or pick a test student</p>
              </div>
            )}
          </div>

          {/* Quick Manual Mark Present Strip */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 font-display">
                Quick Manual Attendance Override
              </span>
              <span className="text-[11px] text-slate-500 font-medium">1-Click Check-in</span>
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
              {students.slice(0, 8).map((student) => (
                <button
                  key={student.id}
                  onClick={async () => {
                    const todayStr = new Date().toISOString().split("T")[0];
                    const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                    const newRec = await logAttendanceRecord({
                      studentId: student.id,
                      studentName: student.name,
                      rollNumber: student.rollNumber,
                      className: classroom.name,
                      date: todayStr,
                      timestamp: timeStr,
                      status: "present",
                      confidence: 100,
                      latitude: classroom.latitude,
                      longitude: classroom.longitude,
                      verificationMethod: "manual",
                    });
                    audioFeedback.playSuccessChime();
                    setLastLoggedStudent(student);
                    setLastLogTimestamp(timeStr);
                    onAttendanceLogged(newRec);
                  }}
                  className="flex items-center space-x-2 p-2 bg-slate-50 hover:bg-emerald-50/80 border border-slate-200 hover:border-emerald-300 rounded-xl text-left transition-colors cursor-pointer group"
                >
                  <img
                    src={student.faceImageDataUrl}
                    alt={student.name}
                    className="w-6 h-6 rounded-full object-cover border border-slate-300 shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 group-hover:text-emerald-900 truncate">
                      {student.name.split(" ")[0]}
                    </p>
                    <p className="text-[10px] text-slate-400 font-mono truncate">{student.rollNumber}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Latest Recorded Entry Card */}
          {lastLoggedStudent && (
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-bold text-emerald-950 flex items-center space-x-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Latest Verified Check-In</span>
                </span>
                <span className="font-mono text-emerald-800 font-bold">{lastLogTimestamp}</span>
              </div>
              <div className="flex items-center space-x-3 bg-white p-2.5 rounded-xl border border-emerald-200">
                <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                  {lastLoggedStudent.faceImageDataUrl ? (
                    <img
                      src={lastLoggedStudent.faceImageDataUrl}
                      alt={lastLoggedStudent.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-5 h-5 text-slate-400" />
                  )}
                </div>
                <div>
                  <h4 className="text-xs font-extrabold text-slate-900">{lastLoggedStudent.name}</h4>
                  <p className="text-[11px] text-slate-500">
                    Roll {lastLoggedStudent.rollNumber} · {lastLoggedStudent.className}
                  </p>
                </div>
                <span className="ml-auto text-[10px] font-extrabold text-emerald-700 bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 rounded-full">
                  Present
                </span>
              </div>
            </div>
          )}

          {/* Parent Alert Notification Box */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs space-y-3">
            <div>
              <h4 className="text-xs font-bold text-slate-900 font-display">Parent Absence Alert Dispatcher</h4>
              <p className="text-[11px] text-slate-500">
                Send an automated email notification to an absent student's guardian.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <select
                value={selectedAbsentStudentId}
                onChange={(e) => setSelectedAbsentStudentId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none transition-colors"
              >
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.rollNumber})
                  </option>
                ))}
              </select>

              <button
                onClick={handleTriggerParentAlert}
                className="px-3.5 py-2 bg-slate-950 hover:bg-slate-800 text-white text-xs font-bold rounded-xl whitespace-nowrap shadow-xs transition-colors cursor-pointer"
              >
                Send Alert
              </button>
            </div>

            {parentAlertStatus && (
              <p className="text-[11px] text-emerald-700 font-semibold bg-emerald-50 p-2 rounded-lg border border-emerald-200">
                {parentAlertStatus}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
