import React, { useState } from "react";
import { Classroom } from "../types";
import { MapPin, Navigation, Save, X, CheckCircle2, AlertCircle } from "lucide-react";

interface LocationConfigModalProps {
  classroom: Classroom;
  isOpen: boolean;
  onClose: () => void;
  onSaveClassroom: (updatedClassroom: Classroom) => void;
}

export const LocationConfigModal: React.FC<LocationConfigModalProps> = ({
  classroom,
  isOpen,
  onClose,
  onSaveClassroom,
}) => {
  if (!isOpen) return null;

  const [name, setName] = useState(classroom.name);
  const [teacherName, setTeacherName] = useState(classroom.teacherName);
  const [latitude, setLatitude] = useState(classroom.latitude.toString());
  const [longitude, setLongitude] = useState(classroom.longitude.toString());
  const [radiusMeters, setRadiusMeters] = useState(classroom.radiusMeters.toString());
  const [isDetectingGps, setIsDetectingGps] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const handleGetCurrentGps = () => {
    if (!navigator.geolocation) {
      setStatusMessage({ text: "Geolocation is not supported by your browser.", type: "error" });
      return;
    }

    setIsDetectingGps(true);
    setStatusMessage(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude.toFixed(6));
        setLongitude(pos.coords.longitude.toFixed(6));
        setIsDetectingGps(false);
        setStatusMessage({
          text: `Current device coordinates locked: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`,
          type: "success",
        });
      },
      (err) => {
        setIsDetectingGps(false);
        setStatusMessage({
          text: `Failed to acquire GPS position: ${err.message}. Ensure location permissions are allowed in frame.`,
          type: "error",
        });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: Classroom = {
      ...classroom,
      name,
      teacherName,
      latitude: parseFloat(latitude) || classroom.latitude,
      longitude: parseFloat(longitude) || classroom.longitude,
      radiusMeters: parseInt(radiusMeters, 10) || 50,
    };

    onSaveClassroom(updated);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Classroom Geofence Policy</h3>
              <p className="text-xs text-slate-400">Strict physical presence boundary settings</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-sm">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Classroom Title / Room Number
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g. CS-301 Computer Science Lab"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Instructor / Administrator Name
            </label>
            <input
              type="text"
              required
              value={teacherName}
              onChange={(e) => setTeacherName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g. Prof. Sarah Jenkins"
            />
          </div>

          {/* GPS Coordinates & Auto-Detect Button */}
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300">
                Classroom GPS Anchor Coordinates
              </span>
              <button
                type="button"
                onClick={handleGetCurrentGps}
                disabled={isDetectingGps}
                className="flex items-center space-x-1.5 px-2.5 py-1 text-xs font-medium bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-md transition-colors"
              >
                <Navigation className={`w-3.5 h-3.5 ${isDetectingGps ? "animate-spin" : ""}`} />
                <span>{isDetectingGps ? "Detecting GPS..." : "Set to My Current Location"}</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Latitude</label>
                <input
                  type="number"
                  step="any"
                  required
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Longitude</label>
                <input
                  type="number"
                  step="any"
                  required
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Max Physical Radius */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Maximum Classroom Radius Tolerance (Meters)
            </label>
            <div className="flex items-center space-x-3">
              <input
                type="number"
                min="5"
                max="500"
                required
                value={radiusMeters}
                onChange={(e) => setRadiusMeters(e.target.value)}
                className="w-32 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <span className="text-xs text-slate-400">
                Students outside this radius will be flagged as remote and denied attendance.
              </span>
            </div>
          </div>

          {/* Status Alert Banner */}
          {statusMessage && (
            <div
              className={`p-3 rounded-lg flex items-start space-x-2 text-xs ${
                statusMessage.type === "success"
                  ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-300"
                  : "bg-rose-500/10 border border-rose-500/30 text-rose-300"
              }`}
            >
              {statusMessage.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center space-x-2 px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-lg shadow-indigo-600/20 transition-all"
            >
              <Save className="w-4 h-4" />
              <span>Save Geofence Policy</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
