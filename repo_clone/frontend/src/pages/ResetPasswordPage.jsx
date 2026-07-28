import { useState } from "react";
import axios from "axios";
import { useToast, ToastContainer } from "../components/Toast";

const API_URL = import.meta.env.VITE_API_URL;

export default function ResetPasswordPage({ token, onDone }) {
  const { toasts, addToast } = useToast();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    if (!password || password.length < 6) {
      addToast("Password must be at least 6 characters", "error");
      return;
    }
    if (password !== confirm) {
      addToast("Passwords do not match", "error");
      return;
    }
    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/auth/reset-password`, { token, new_password: password });
      addToast(res.data.message || "Password updated successfully", "success");
      setSuccess(true);
    } catch (err) {
      addToast(err.response?.data?.detail || "Something went wrong. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50 flex items-center justify-center px-4">
      <ToastContainer toasts={toasts} />
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl shadow-lg mx-auto mb-3">
            AN
          </div>
          <h1 className="text-2xl font-bold text-gray-900">AskMyNotes</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          {success ? (
            <div className="text-center">
              <p className="text-4xl mb-3">✅</p>
              <h2 className="text-lg font-bold text-gray-900 mb-2">Password updated</h2>
              <p className="text-sm text-gray-400 mb-5">You can now sign in with your new password.</p>
              <button onClick={onDone}
                className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl py-3 font-semibold text-sm hover:opacity-90 transition shadow-md">
                Go to Sign In
              </button>
            </div>
          ) : (
            <>
              <h2 className="text-lg font-bold text-gray-900 mb-1">Set a new password</h2>
              <p className="text-sm text-gray-400 mb-4">Choose a new password for your account.</p>
              <div className="space-y-3">
                <input placeholder="New password" type="password" value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-indigo-400" />
                <input placeholder="Confirm new password" type="password" value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSubmit()}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-indigo-400" />
              </div>
              <button onClick={handleSubmit} disabled={loading}
                className="mt-4 w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl py-3 font-semibold text-sm hover:opacity-90 disabled:opacity-50 transition shadow-md">
                {loading ? "Updating..." : "Update Password"}
              </button>
              <button onClick={onDone} className="mt-3 w-full text-xs text-gray-400 hover:text-gray-600">
                ← Back to sign in
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
