import React, { useState, useRef } from "react";
import { Student } from "../types";
import { addStudent, deleteStudent } from "../lib/attendanceStore";
import {
  UserPlus,
  Camera,
  Upload,
  Trash2,
  CheckCircle,
  Mail,
  Phone,
  AlertTriangle,
  Loader2,
  X,
  User,
  Search,
  Download,
  Eye,
  ShieldCheck,
} from "lucide-react";

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
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStudentModal, setSelectedStudentModal] = useState<Student | null>(null);
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);

  // Form states
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

  // Compress Base64 image
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
      setErrorMessage("Camera access denied or unavailable for registration photo.");
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
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    const vWidth = video.videoWidth || 640;
    const vHeight = video.videoHeight || 480;
    const minDim = Math.min(vWidth, vHeight);
    const sx = (vWidth - minDim) / 2;
    const sy = (vHeight - minDim) / 2;

    canvas.width = 440;
    canvas.height = 440;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      // Draw centered square crop preserving original natural facial proportions
      ctx.drawImage(video, sx, sy, minDim, minDim, 0, 0, 440, 440);
      setFaceImageDataUrl(canvas.toDataURL("image/jpeg", 0.9));
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
      setErrorMessage("Please capture or upload a facial photograph of the student.");
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
      setStatusNotice(`Enrolled ${name} successfully`);

      // Reset Form
      setName("");
      setRollNumber("");
      setParentEmail("");
      setParentPhone("");
      setFaceImageDataUrl(null);
      setIsRegistering(false);

      setTimeout(() => setStatusNotice(null), 4000);
    } catch (err: any) {
      console.error("Failed saving student profile:", err);
      setErrorMessage(err?.message || "Failed to save student profile. Please check connection.");
    } finally {
      setIsSaving(false);
    }
  };

  // Trigger Delete Confirmation Modal
  const handleRequestDelete = (student: Student, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    setStudentToDelete(student);
  };

  // Execute Confirmed Student Deletion
  const handleConfirmDelete = async () => {
    if (!studentToDelete) return;
    const targetStudent = studentToDelete;
    setIsDeleting(true);
    try {
      await deleteStudent(targetStudent.id);
      if (onStudentDeleted) {
        onStudentDeleted(targetStudent.id);
      }
      if (selectedStudentModal?.id === targetStudent.id) {
        setSelectedStudentModal(null);
      }
      setStudentToDelete(null);
      setStatusNotice(`Removed ${targetStudent.name} from class roster`);
      setTimeout(() => setStatusNotice(null), 3500);
    } catch (e) {
      console.error("Error deleting student:", e);
      setErrorMessage("Failed to remove student profile. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Export Roster CSV
  const handleExportRosterCSV = () => {
    const headers = ["ID", "Roll Number", "Full Name", "Class", "Parent Email", "Parent Phone", "Enrolled Date"];
    const rows = students.map((s) => [
      `"${s.id}"`,
      `"${s.rollNumber}"`,
      `"${s.name}"`,
      `"${s.className}"`,
      `"${s.parentEmail}"`,
      `"${s.parentPhone || ""}"`,
      `"${s.createdAt || ""}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Roster_${className.replace(/\s+/g, "_")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredStudents = students.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.rollNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.parentEmail.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200/90 gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight font-display">
            Student Profiles &amp; Roster
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage biometric face enrollment and student contact records for {className}.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportRosterCSV}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-bold transition-colors cursor-pointer shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export Roster</span>
          </button>

          <button
            onClick={() => {
              setIsRegistering(!isRegistering);
              setErrorMessage(null);
            }}
            className={`flex items-center space-x-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-sm ${
              isRegistering
                ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
                : "bg-slate-950 hover:bg-slate-800 text-white"
            }`}
          >
            {isRegistering ? (
              <>
                <X className="w-3.5 h-3.5" />
                <span>Cancel</span>
              </>
            ) : (
              <>
                <UserPlus className="w-3.5 h-3.5 text-emerald-400" />
                <span>Enroll Student</span>
              </>
            )}
          </button>
        </div>
      </div>

      {statusNotice && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-3.5 py-2.5 rounded-xl text-xs font-medium flex items-center space-x-2">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          <span>{statusNotice}</span>
        </div>
      )}

      {errorMessage && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-3.5 py-2.5 rounded-xl text-xs font-medium flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 text-red-600" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Registration Form */}
      {isRegistering && (
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs">
          <div className="border-b border-zinc-100 pb-3 mb-4">
            <h3 className="text-sm font-semibold text-zinc-900">New Student Enrollment</h3>
            <p className="text-xs text-zinc-500">
              Provide student details and reference photo for AI recognition.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            {/* Form Fields */}
            <div className="space-y-3.5">
              <div>
                <label className="block font-medium text-zinc-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Jordan Miller"
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-900 placeholder-zinc-400 focus:bg-white focus:outline-none focus:border-zinc-900 transition-colors"
                />
              </div>

              <div>
                <label className="block font-medium text-zinc-700 mb-1">Roll / Student ID</label>
                <input
                  type="text"
                  required
                  value={rollNumber}
                  onChange={(e) => setRollNumber(e.target.value)}
                  placeholder="e.g. CS-2026-042"
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-900 placeholder-zinc-400 focus:bg-white focus:outline-none focus:border-zinc-900 transition-colors"
                />
              </div>

              <div>
                <label className="block font-medium text-zinc-700 mb-1">Parent / Guardian Email</label>
                <input
                  type="email"
                  required
                  value={parentEmail}
                  onChange={(e) => setParentEmail(e.target.value)}
                  placeholder="parent@example.com"
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-900 placeholder-zinc-400 focus:bg-white focus:outline-none focus:border-zinc-900 transition-colors"
                />
              </div>

              <div>
                <label className="block font-medium text-zinc-700 mb-1">Parent Phone (Optional)</label>
                <input
                  type="tel"
                  value={parentPhone}
                  onChange={(e) => setParentPhone(e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-900 placeholder-zinc-400 focus:bg-white focus:outline-none focus:border-zinc-900 transition-colors"
                />
              </div>
            </div>

            {/* Photo Capture Section */}
            <div className="space-y-3 flex flex-col justify-between">
              <div>
                <label className="block font-medium text-zinc-700 mb-1">
                  Face Reference Photo
                </label>

                <div className="aspect-square w-40 h-40 mx-auto bg-zinc-100 rounded-xl border border-dashed border-zinc-300 overflow-hidden flex items-center justify-center relative">
                  {useCamera ? (
                    <div className="relative w-full h-full">
                      <video ref={videoRef} className="w-full h-full object-cover -scale-x-100" />
                      <button
                        type="button"
                        onClick={capturePhoto}
                        className="absolute bottom-2 left-1/2 -translate-x-1/2 px-2.5 py-1 bg-zinc-900 text-white font-medium text-[11px] rounded-md shadow-sm"
                      >
                        Capture
                      </button>
                    </div>
                  ) : faceImageDataUrl ? (
                    <img src={faceImageDataUrl} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center p-3 text-zinc-400">
                      <User className="w-8 h-8 mx-auto mb-1 text-zinc-300" />
                      <span className="text-[11px]">No photo loaded</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-center space-x-2 mt-3">
                  <button
                    type="button"
                    onClick={startCamera}
                    className="flex items-center space-x-1 px-2.5 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-md text-xs font-medium transition-colors"
                  >
                    <Camera className="w-3.5 h-3.5 text-zinc-500" />
                    <span>Camera</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center space-x-1 px-2.5 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-md text-xs font-medium transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5 text-zinc-500" />
                    <span>Upload</span>
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

              <div className="pt-3 border-t border-zinc-100 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsRegistering(false)}
                  disabled={isSaving}
                  className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-medium rounded-lg disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white font-medium rounded-lg flex items-center space-x-1.5 disabled:opacity-50 transition-colors"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Student</span>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Search Filter Bar */}
      <div className="relative max-w-sm">
        <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-zinc-400" />
        <input
          type="text"
          placeholder="Search students by name, roll, or parent email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-8 pr-3 py-1.5 bg-white border border-zinc-200 rounded-lg text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-900 transition-colors"
        />
      </div>

      {/* Enrolled Students Card Gallery */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
        {filteredStudents.map((student) => (
          <div
            key={student.id}
            onClick={() => setSelectedStudentModal(student)}
            className="bg-white border border-zinc-200 rounded-xl p-4 shadow-xs flex flex-col justify-between relative group hover:border-zinc-400 transition-colors cursor-pointer"
          >
            <button
              onClick={(e) => handleRequestDelete(student, e)}
              title="Remove student"
              className="absolute top-3 right-3 p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>

            <div className="space-y-3">
              <div className="relative w-16 h-16 mx-auto rounded-full overflow-hidden border border-zinc-200 shadow-xs">
                <img
                  src={student.faceImageDataUrl}
                  alt={student.name}
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="text-center">
                <h3 className="font-medium text-zinc-900 text-sm">{student.name}</h3>
                <p className="text-[11px] font-mono text-zinc-500">{student.rollNumber}</p>
              </div>

              <div className="space-y-1 text-[11px] text-zinc-500 pt-2 border-t border-zinc-100">
                <div className="flex items-center space-x-1.5 truncate">
                  <Mail className="w-3 h-3 text-zinc-400 shrink-0" />
                  <span className="truncate">{student.parentEmail}</span>
                </div>
                {student.parentPhone && (
                  <div className="flex items-center space-x-1.5">
                    <Phone className="w-3 h-3 text-zinc-400 shrink-0" />
                    <span>{student.parentPhone}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-zinc-100 flex items-center justify-between text-[11px] text-zinc-400">
              <span className="flex items-center space-x-1 text-zinc-500">
                <Eye className="w-3 h-3" />
                <span>View Profile</span>
              </span>
              <span className="font-mono text-emerald-600 font-medium">Active</span>
            </div>
          </div>
        ))}
      </div>

      {/* Student Profile Details Modal */}
      {selectedStudentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/40 backdrop-blur-xs">
          <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-xl max-w-md w-full space-y-4 text-zinc-900">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <div>
                <h4 className="text-base font-semibold">{selectedStudentModal.name}</h4>
                <p className="text-xs text-zinc-500 font-mono">Roll: {selectedStudentModal.rollNumber}</p>
              </div>
              <button
                onClick={() => setSelectedStudentModal(null)}
                className="text-zinc-400 hover:text-zinc-600 p-1 rounded-md text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex items-center space-x-4">
              <div className="w-24 h-24 rounded-2xl overflow-hidden border border-zinc-200 bg-zinc-100 shrink-0">
                <img
                  src={selectedStudentModal.faceImageDataUrl}
                  alt={selectedStudentModal.name}
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="space-y-1.5 text-xs text-zinc-600">
                <div className="flex items-center space-x-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="font-medium text-zinc-900">Biometric Profile Enrolled</span>
                </div>
                <p>
                  <strong className="text-zinc-700">Class:</strong> {selectedStudentModal.className}
                </p>
                <p className="truncate">
                  <strong className="text-zinc-700">Parent:</strong> {selectedStudentModal.parentEmail}
                </p>
                {selectedStudentModal.parentPhone && (
                  <p>
                    <strong className="text-zinc-700">Phone:</strong> {selectedStudentModal.parentPhone}
                  </p>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-zinc-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => handleRequestDelete(selectedStudentModal)}
                className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded-lg font-medium transition-colors cursor-pointer"
              >
                Delete Student
              </button>
              <button
                type="button"
                onClick={() => setSelectedStudentModal(null)}
                className="px-4 py-1.5 bg-zinc-900 text-white rounded-lg text-xs font-medium hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dedicated In-App Student Deletion Confirmation Modal */}
      {studentToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/50 backdrop-blur-xs">
          <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-2xl max-w-sm w-full space-y-4 text-zinc-900 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-zinc-900">Delete Student Profile</h4>
                <p className="text-xs text-zinc-500">Remove from classroom enrollment roster</p>
              </div>
            </div>

            {/* Student Preview Card */}
            <div className="bg-zinc-50 border border-zinc-200/80 rounded-xl p-3 flex items-center space-x-3">
              <div className="w-12 h-12 rounded-full overflow-hidden border border-zinc-200 bg-white shrink-0">
                <img
                  src={studentToDelete.faceImageDataUrl}
                  alt={studentToDelete.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-zinc-900 text-xs truncate">{studentToDelete.name}</p>
                <p className="text-[11px] font-mono text-zinc-500">Roll: {studentToDelete.rollNumber}</p>
                <p className="text-[11px] text-zinc-500">{studentToDelete.className}</p>
              </div>
            </div>

            <p className="text-xs text-zinc-600 leading-relaxed">
              Are you sure you want to delete this student? This action permanently removes their biometric facial template and unenrolls them from automated attendance scanning.
            </p>

            <div className="pt-2 flex items-center justify-end space-x-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setStudentToDelete(null)}
                className="px-3.5 py-1.5 bg-zinc-100 hover:bg-zinc-200 disabled:opacity-50 text-zinc-700 rounded-lg text-xs font-medium transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-xs font-medium flex items-center space-x-1.5 shadow-xs transition-colors cursor-pointer"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Student</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

