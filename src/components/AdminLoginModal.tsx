import React, { useState } from "react";
import { Lock, KeyRound, Eye, EyeOff, AlertCircle, ArrowRight, X } from "lucide-react";

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.trim() === "YASHlovesbubs69") {
      setPassword("");
      onSuccess();
    } else {
      setError("Invalid administrator password. Access denied.");
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/40 backdrop-blur-xs">
      <div
        className={`w-full max-w-sm bg-white border border-zinc-200 rounded-2xl p-6 shadow-xl text-zinc-900 relative transition-transform ${
          shake ? "translate-x-1" : ""
        }`}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-600 p-1 rounded-md transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="space-y-5">
          {/* Header */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-900">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold tracking-tight text-zinc-900">
                Admin Authentication
              </h2>
              <p className="text-xs text-zinc-500">
                Enter master credentials to unlock controls
              </p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                Master Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="Enter administrator password..."
                  autoFocus
                  required
                  className="w-full pl-9 pr-10 py-2 bg-zinc-50 border border-zinc-200 focus:border-zinc-900 focus:bg-white rounded-lg text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-zinc-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 flex items-center space-x-2 text-red-700 text-xs">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-600" />
                <span>{error}</span>
              </div>
            )}

            <div className="pt-2 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-2 text-xs font-medium text-zinc-600 hover:text-zinc-900 rounded-lg hover:bg-zinc-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white font-medium text-xs rounded-lg shadow-xs flex items-center space-x-1.5 transition-colors"
              >
                <span>Unlock</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
