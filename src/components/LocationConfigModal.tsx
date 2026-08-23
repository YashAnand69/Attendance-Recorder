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
          text: `Device coordinates acquired: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`,
          type: "success",
        });
      },
      (err) => {
        setIsDetectingGps(false);
        setStatusMessage({
          text: `GPS acquisition failed: ${err.message}. Please allow location access.`,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/40 backdrop-blur-xs">
      <div className="w-full max-w-lg bg-white border border-zinc-200 rounded-2xl shadow-xl overflow-hidden text-zinc-900">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 bg-zinc-50/50">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-800">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-zinc-900">Classroom Geofence Policy</h3>
              <p className="text-xs text-zinc-500">Physical presence boundary rules</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">
              Classroom Name / Room Number
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-xs text-zinc-900 focus:bg-white focus:border-zinc-900 focus:outline-none transition-colors"
              placeholder="e.g. CS-301 Lab"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">
              Teacher / Administrator Name
            </label>
            <input
              type="text"
              required
              value={teacherName}
              onChange={(e) => setTeacherName(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-xs text-zinc-900 focus:bg-white focus:border-zinc-900 focus:outline-none transition-colors"
              placeholder="e.g. Prof. Sarah Jenkins"
            />
          </div>

          {/* GPS Coordinates */}
          <div className="space-y-2 pt-2 border-t border-zinc-100">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-700">
                GPS Anchor Coordinates
              </span>
              <button
                type="button"
                onClick={handleGetCurrentGps}
                disabled={isDetectingGps}
                className="flex items-center space-x-1.5 px-2.5 py-1 text-xs font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 rounded-md transition-colors"
              >
                <Navigation className={`w-3 h-3 ${isDetectingGps ? "animate-spin" : ""}`} />
                <span>{isDetectingGps ? "Acquiring GPS..." : "Use Current Location"}</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-zinc-500 mb-1">Latitude</label>
                <input
                  type="number"
                  step="any"
                  required
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-xs text-zinc-900 font-mono focus:bg-white focus:border-zinc-900 focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-[11px] text-zinc-500 mb-1">Longitude</label>
                <input
                  type="number"
                  step="any"
                  required
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-xs text-zinc-900 font-mono focus:bg-white focus:border-zinc-900 focus:outline-none transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Max Physical Radius */}
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">
              Geofence Radius (Meters)
            </label>
            <div className="flex items-center space-x-3">
              <input
                type="number"
                min="5"
                max="500"
                required
                value={radiusMeters}
                onChange={(e) => setRadiusMeters(e.target.value)}
                className="w-24 px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-xs text-zinc-900 font-mono focus:bg-white focus:border-zinc-900 focus:outline-none transition-colors"
              />
              <span className="text-xs text-zinc-500">
                Maximum distance allowed from classroom anchor.
              </span>
            </div>
          </div>

          {/* Status Message */}
          {statusMessage && (
            <div
              className={`p-2.5 rounded-lg flex items-start space-x-2 text-xs ${
                statusMessage.type === "success"
                  ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                  : "bg-red-50 border border-red-200 text-red-800"
              }`}
            >
              {statusMessage.type === "success" ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end space-x-2 pt-3 border-t border-zinc-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-xs font-medium text-zinc-600 hover:text-zinc-900 rounded-lg hover:bg-zinc-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center space-x-1.5 px-4 py-2 text-xs font-medium text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg shadow-xs transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Policy</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
