import React, { useState } from "react";
import { Shield, Lock, KeyRound, Eye, EyeOff, AlertCircle, CheckCircle2, ArrowRight } from "lucide-react";

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
      setError("Invalid Administrator Password. Access Denied.");
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div
        className={`w-full max-w-md bg-slate-900 border border-indigo-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl text-slate-100 relative overflow-hidden transition-all ${
          shake ? "animate-bounce" : ""
        }`}
      >
        {/* Glow ambient decoration */}
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-6">
          {/* Header Icon */}
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 via-blue-600 to-cyan-500 p-0.5 shadow-xl shadow-indigo-500/25 flex items-center justify-center">
              <div className="w-full h-full bg-slate-900 rounded-[14px] flex items-center justify-center">
                <Lock className="w-8 h-8 text-indigo-400" />
              </div>
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">
                Admin Portal Access
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Enter master administrator security credentials to unlock management dashboards &amp; controls.
              </p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Admin Master Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="Enter admin password..."
                  autoFocus
                  required
                  className="w-full pl-10 pr-12 py-3 bg-slate-950/80 border border-slate-700/80 focus:border-indigo-500 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 flex items-center space-x-2.5 text-rose-300 text-xs animate-shake">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="pt-2 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700/80 text-slate-300 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Back to Kiosk Mode
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 flex items-center space-x-2 transition-all cursor-pointer"
              >
                <span>Unlock Portal</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
