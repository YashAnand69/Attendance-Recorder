import React, { useState, useRef } from "react";
import { Student } from "../types";
import { addStudent, deleteStudent } from "../lib/attendanceStore";
import { UserPlus, Camera, Upload, Trash2, CheckCircle, ShieldCheck, Mail, Phone, Hash, AlertTriangle, Loader2 } from "lucide-react";

interface StudentManagementProps {
  students: Student[];
  onStudentAdded: (student: Student) => void;
  onStudentDeleted?: (studentId: string) => void;
  className: string;
}

export const StudentManagement: React.FC<StudentManagementProps> = ({
  students,
  onStudentAdded,
  onStudentDeleted,
  className,
}) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [faceImageDataUrl, setFaceImageDataUrl] = useState<string | null>(null);

  // Camera capture modal state inside registration form
  const [useCamera, setUseCamera] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Compress Base64 image to prevent hitting Firestore/localStorage quotas
  const compressImage = (dataUrl: string, maxDim = 320, quality = 0.85): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", quality));
        } else {
          resolve(dataUrl);
        }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  };

  // Start Camera for facial photo capture
  const startCamera = async () => {
    try {
      setUseCamera(true);
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (e) {
      alert("Camera access denied or unavailable for registration photo.");
      setUseCamera(false);
    }
  };

  // Stop Camera
  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
    }
    setUseCamera(false);
  };

  // Capture Photo from Camera
  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 320;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, 320, 320);
      setFaceImageDataUrl(canvas.toDataURL("image/jpeg", 0.85));
    }
    stopCamera();
  };

  // Handle File Upload for Face Photo
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const compressed = await compressImage(reader.result as string);
        setFaceImageDataUrl(compressed);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle Submit Registration
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setStatusNotice(null);

    if (!faceImageDataUrl) {
      alert("Please capture or upload a facial photograph of the student.");
      return;
    }

    setIsSaving(true);
    try {
      const compressedFace = await compressImage(faceImageDataUrl);
      const newStudent = await addStudent({
        name,
        rollNumber,
        className,
        parentEmail,
        parentPhone,
        faceImageDataUrl: compressedFace,
      });

      onStudentAdded(newStudent);
      setStatusNotice(`Registered ${name} successfully! Face profile saved to cloud database.`);

      // Reset Form
      setName("");
      setRollNumber("");
      setParentEmail("");
      setParentPhone("");
      setFaceImageDataUrl(null);
      setIsRegistering(false);

      setTimeout(() => setStatusNotice(null), 5000);
    } catch (err: any) {
      console.error("Failed saving student profile:", err);
      setErrorMessage(err?.message || "Failed to save student profile. Please verify network/database connection.");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Delete Student
  const handleDeleteStudent = async (studentId: string, studentName: string) => {
    if (window.confirm(`Are you sure you want to delete ${studentName}'s biometric profile?`)) {
      try {
        await deleteStudent(studentId);
        if (onStudentDeleted) {
          onStudentDeleted(studentId);
        }
        setStatusNotice(`Deleted ${studentName}'s profile.`);
        setTimeout(() => setStatusNotice(null), 4000);
      } catch (e) {
        setErrorMessage("Failed to delete student profile.");
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center space-x-2">
            <UserPlus className="w-5 h-5 text-indigo-400" />
            <span>Student Biometric Profiles</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Register student faces once. The AI will recognize them automatically for every subsequent attendance scan.
          </p>
        </div>

        <button
          onClick={() => {
            setIsRegistering(!isRegistering);
            setErrorMessage(null);
          }}
          className="flex items-center space-x-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          <span>{isRegistering ? "Close Form" : "Register New Student"}</span>
        </button>
      </div>

      {statusNotice && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 p-4 rounded-xl text-xs font-semibold flex items-center space-x-2">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span>{statusNotice}</span>
        </div>
      )}

      {errorMessage && (
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 p-4 rounded-xl text-xs font-semibold flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 text-rose-400" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Registration Form Drawer */}
      {isRegistering && (
        <div className="bg-slate-900 border border-indigo-500/30 rounded-2xl p-6 shadow-2xl text-slate-200 animate-fade-in space-y-6">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="text-base font-bold text-white">New Student Enrollment &amp; Facial Indexing</h3>
            <p className="text-xs text-slate-400">
              Provide student details and facial profile image for real-time recognition.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            {/* Left Inputs */}
            <div className="space-y-4">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Jordan Miller"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Roll Number / Student ID</label>
                <input
                  type="text"
                  required
                  value={rollNumber}
                  onChange={(e) => setRollNumber(e.target.value)}
                  placeholder="e.g. CS2026-008"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Parent/Guardian Email (for Absent Alerts)</label>
                <input
                  type="email"
                  required
                  value={parentEmail}
                  onChange={(e) => setParentEmail(e.target.value)}
                  placeholder="parent.email@example.com"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Parent Phone Number</label>
                <input
                  type="tel"
                  value={parentPhone}
                  onChange={(e) => setParentPhone(e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Right Input: Facial Photo Capture */}
            <div className="space-y-4 flex flex-col justify-between">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Facial Recognition Reference Photo
                </label>

                <div className="aspect-square w-48 h-48 mx-auto bg-slate-950 rounded-2xl border-2 border-dashed border-slate-700 overflow-hidden flex items-center justify-center relative">
                  {useCamera ? (
                    <div className="relative w-full h-full">
                      <video ref={videoRef} className="w-full h-full object-cover transform -scale-x-100" />
                      <button
                        type="button"
                        onClick={capturePhoto}
                        className="absolute bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 bg-emerald-600 text-white font-bold text-[11px] rounded-lg shadow-lg"
                      >
                        Snap Photo
                      </button>
                    </div>
                  ) : faceImageDataUrl ? (
                    <img src={faceImageDataUrl} alt="Student Face" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center p-4 text-slate-500">
                      <ShieldCheck className="w-8 h-8 mx-auto mb-1 text-slate-600" />
                      <span>No Face Image Loaded</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-center space-x-3 mt-3">
                  <button
                    type="button"
                    onClick={startCamera}
                    className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-lg text-xs"
                  >
                    <Camera className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Use Camera</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-lg text-xs"
                  >
                    <Upload className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Upload Image</span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsRegistering(false)}
                  disabled={isSaving}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-lg disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg shadow-lg shadow-indigo-600/30 flex items-center space-x-2 disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving Profile...</span>
                    </>
                  ) : (
                    <span>Save Student Profile</span>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Enrolled Students Card Gallery */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {students.map((student) => (
          <div
            key={student.id}
            className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between hover:border-slate-700 transition-all relative group"
          >
            <button
              onClick={() => handleDeleteStudent(student.id, student.name)}
              title="Delete Profile"
              className="absolute top-3 right-3 p-1.5 text-slate-500 hover:text-rose-400 bg-slate-800/80 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer opacity-80 group-hover:opacity-100"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>

            <div className="space-y-3">
              <div className="relative w-20 h-20 mx-auto rounded-2xl overflow-hidden border-2 border-indigo-500/40 shadow-md">
                <img
                  src={student.faceImageDataUrl}
                  alt={student.name}
                  className="w-full h-full object-cover"
                />
                <span className="absolute bottom-1 right-1 w-3 h-3 rounded-full bg-emerald-500 border-2 border-slate-900" />
              </div>

              <div className="text-center">
                <h3 className="font-bold text-white text-sm">{student.name}</h3>
                <p className="text-[11px] font-mono text-indigo-300">{student.rollNumber}</p>
              </div>

              <div className="space-y-1 text-[11px] text-slate-400 pt-2 border-t border-slate-800">
                <div className="flex items-center space-x-1.5 truncate">
                  <Mail className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                  <span className="truncate">{student.parentEmail}</span>
                </div>
                {student.parentPhone && (
                  <div className="flex items-center space-x-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                    <span>{student.parentPhone}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-500">
              <span>Face Indexed</span>
              <span className="font-mono text-emerald-400">Active Profile</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
